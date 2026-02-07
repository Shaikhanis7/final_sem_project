"""
Complete Mental Health AI Agent System with LangGraph
Advanced Agentic RAG + State Management + Checkpointing
"""

import uuid
import asyncio
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple, TypedDict, Annotated, Literal
from pydantic import BaseModel, Field, ConfigDict
from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging
import traceback
import io
import os
import shutil
import time
import sys
import json
import re
from collections import defaultdict, deque
from enum import Enum
from dataclasses import dataclass
import pickle
import sqlite3

# Set up logging FIRST
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('agentic_workflow.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# Import dependencies
try:
    from dotenv import load_dotenv
    load_dotenv()
    logger.info("SUCCESS: Loaded environment variables")
except ImportError as e:
    logger.error(f"ERROR loading dotenv: {e}")

# Try to import LangGraph with fallbacks
try:
    from langgraph.graph import StateGraph, END
    from langgraph.graph.message import add_messages
    HAS_LANGGRAPH = True
    logger.info("SUCCESS: Imported LangGraph")
except ImportError as e:
    HAS_LANGGRAPH = False
    logger.warning(f"WARNING: LangGraph not available: {e}")

# Try to import checkpoint module with fallback
try:
    if HAS_LANGGRAPH:
        from langgraph.checkpoint.aiosqlite import AsyncSqliteSaver
        HAS_CHECKPOINTING = True
    else:
        HAS_CHECKPOINTING = False
except ImportError:
    HAS_CHECKPOINTING = False
    logger.warning("WARNING: LangGraph checkpoint module not available, using fallback")

# Import langchain modules
try:
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
    from langchain_core.documents import Document
    from langchain_core.tools import tool
    from langchain_core.output_parsers import JsonOutputParser
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain.agents import AgentExecutor, create_tool_calling_agent
    logger.info("SUCCESS: Imported langchain_core modules")
except ImportError as e:
    logger.error(f"ERROR importing langchain_core: {e}")
    raise

# Try to import ChatGroq
try:
    from langchain_groq import ChatGroq
    HAS_GROQ = True
    logger.info("SUCCESS: Imported ChatGroq")
except ImportError as e:
    HAS_GROQ = False
    logger.warning(f"WARNING: Could not import ChatGroq: {e}")

# Import vectorstore modules
try:
    from langchain_community.vectorstores import Chroma
    from langchain_huggingface import HuggingFaceEmbeddings
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain.retrievers.multi_query import MultiQueryRetriever
    logger.info("SUCCESS: Imported vectorstore modules")
except ImportError as e:
    logger.error(f"ERROR importing vectorstore modules: {e}")
    raise

class RAGPipelineLogger:
    def __init__(self):
        self.steps = []
        self.start_time = None
        
    def start_pipeline(self, operation: str):
        self.steps = []
        self.start_time = time.time()
        logger.info(f"STARTING RAG Pipeline: {operation}")
        self.log_step(f"START: {operation}", "info")
        
    def log_step(self, message: str, level: str = "info"):
        step_time = time.time() - self.start_time if self.start_time else 0
        formatted_message = f"[Step {len(self.steps)+1}] [{step_time:.2f}s] {message}"
        self.steps.append(formatted_message)
        
        if level == "info":
            logger.info(formatted_message)
        elif level == "warning":
            logger.warning(formatted_message)
        elif level == "error":
            logger.error(formatted_message)
        elif level == "success":
            logger.info(f"SUCCESS: {formatted_message}")
        
    def end_pipeline(self, status: str = "completed"):
        total_time = time.time() - self.start_time if self.start_time else 0
        logger.info(f"RAG Pipeline {status.upper()} in {total_time:.2f}s")
        logger.info(f"Total steps: {len(self.steps)}")

rag_logger = RAGPipelineLogger()

# Initialize FastAPI
app = FastAPI(title="Mental Health AI Agent API - Complete Agentic Workflow with LangGraph")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
CHROMA_PERSIST_DIR = "./chroma_db"
USER_PROFILES_DIR = "./user_profiles"
USER_TASKS_DIR = "./user_tasks"
CONVERSATION_HISTORY_DIR = "./conversation_history"
CHECKPOINT_DB_PATH = "./checkpoints.db"
AGENT_STATES_DIR = "./agent_states"

# Create directories
os.makedirs(USER_PROFILES_DIR, exist_ok=True)
os.makedirs(USER_TASKS_DIR, exist_ok=True)
os.makedirs(CONVERSATION_HISTORY_DIR, exist_ok=True)
os.makedirs(AGENT_STATES_DIR, exist_ok=True)

# Global variables
vectorstore = None
retriever = None
rag_stats = {
    "total_documents": 0,
    "total_chunks": 0,
    "csv_uploads": 0,
    "last_upload": None,
    "pipeline_logs": []
}

# Enums
class TaskStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"

class TaskCategory(str, Enum):
    SELF_CARE = "self-care"
    EXERCISE = "exercise"
    MINDFULNESS = "mindfulness"
    SOCIAL = "social"
    PROFESSIONAL = "professional"
    SLEEP = "sleep"
    NUTRITION = "nutrition"
    THERAPEUTIC = "therapeutic"

class AgentState(str, Enum):
    INITIAL = "initial"
    ANALYZING = "analyzing"
    RETRIEVING = "retrieving"
    DECIDING = "deciding"
    EXECUTING = "executing"
    RESPONDING = "responding"
    COMPLETED = "completed"

class EmotionalState(str, Enum):
    CALM = "calm"
    STRESSED = "stressed"
    ANXIOUS = "anxious"
    DEPRESSED = "depressed"
    ANGRY = "angry"
    HAPPY = "happy"
    NEUTRAL = "neutral"

# ========== FALLBACK CHECKPOINT SYSTEM ==========
if not HAS_CHECKPOINTING:
    class FallbackCheckpointer:
        """Simple file-based checkpointer when LangGraph checkpointing is not available"""
        def __init__(self, db_path: str):
            self.db_path = db_path
            self.checkpoints_dir = "./fallback_checkpoints"
            os.makedirs(self.checkpoints_dir, exist_ok=True)
            
        async def aget(self, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
            thread_id = config.get("configurable", {}).get("thread_id", "default")
            checkpoint_path = os.path.join(self.checkpoints_dir, f"{thread_id}.json")
            
            if os.path.exists(checkpoint_path):
                try:
                    with open(checkpoint_path, 'r', encoding='utf-8') as f:
                        return json.load(f)
                except:
                    return None
            return None
            
        async def aput(self, config: Dict[str, Any], checkpoint: Dict[str, Any]) -> None:
            thread_id = config.get("configurable", {}).get("thread_id", "default")
            checkpoint_path = os.path.join(self.checkpoints_dir, f"{thread_id}.json")
            
            # Add metadata
            checkpoint["_metadata"] = {
                "saved_at": datetime.now().isoformat(),
                "thread_id": thread_id
            }
            
            with open(checkpoint_path, 'w', encoding='utf-8') as f:
                json.dump(checkpoint, f, indent=2, default=str)
                
        async def adelete(self, config: Dict[str, Any]) -> None:
            thread_id = config.get("configurable", {}).get("thread_id", "default")
            checkpoint_path = os.path.join(self.checkpoints_dir, f"{thread_id}.json")
            if os.path.exists(checkpoint_path):
                os.remove(checkpoint_path)

# ========== LANGGRAPH STATE DEFINITION ==========
class AgentMemory(TypedDict):
    """State definition for LangGraph agent"""
    messages: List[Any]
    user_id: str
    conversation_id: str
    agent_state: AgentState
    profile: Dict[str, Any]
    tasks: List[Dict[str, Any]]
    analysis: Dict[str, Any]
    retrieved_docs: List[Document]
    decisions: List[Dict[str, Any]]
    available_tools: List[str]
    execution_results: Dict[str, Any]
    checkpoint_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    emotional_state: EmotionalState
    emotional_history: List[Dict[str, Any]]
    pending_tasks: int
    completed_tasks_today: int

# ========== PYDANTIC MODELS ==========
class WellnessTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = Field(description="User identifier")
    task: str = Field(description="Task description")
    category: TaskCategory = Field(description="Task category")
    status: TaskStatus = Field(default=TaskStatus.NOT_STARTED)
    solutions: List[str] = Field(default_factory=list, description="Suggested solutions")
    time_to_complete: int = Field(default=15, description="Estimated minutes to complete")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    due_date: Optional[datetime] = Field(default=None, description="Optional due date")
    completed_at: Optional[datetime] = Field(default=None, description="When task was completed")
    notes: Optional[str] = Field(default=None, description="User or agent notes")
    priority: int = Field(default=1, ge=1, le=5, description="Priority 1-5")
    conversation_context: Optional[str] = Field(default=None, description="What was discussed when task created")
    emotional_context: Optional[EmotionalState] = Field(default=None, description="Emotional state when created")
    
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )

class UserProfile(BaseModel):
    user_id: str = Field(description="User identifier")
    name: Optional[str] = Field(default=None, description="User name")
    age: Optional[int] = Field(default=None, description="User age")
    location: Optional[str] = Field(default=None, description="User location")
    job_profession: Optional[str] = Field(default=None, description="User's job or profession")
    interests: List[str] = Field(default_factory=list, description="User interests")
    mental_health_goals: List[str] = Field(default_factory=list, description="Mental health goals")
    coping_strategies: List[str] = Field(default_factory=list, description="Coping strategies")
    triggers: List[str] = Field(default_factory=list, description="Triggers")
    preferences: Dict[str, Any] = Field(default_factory=dict, description="User preferences")
    last_session: Optional[datetime] = Field(default=None, description="Last session time")
    emotional_state: Optional[EmotionalState] = Field(default=None, description="Current emotional state")
    conversation_memory: List[Dict[str, Any]] = Field(default_factory=list, description="Recent conversation memory")
    therapy_history: List[Dict[str, Any]] = Field(default_factory=list, description="Therapy session history")
    progress_metrics: Dict[str, float] = Field(default_factory=dict, description="Progress tracking metrics")
    
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )

class ChatRequest(BaseModel):
    message: str = Field(description="User message")
    user_id: str = Field(default="default_user", description="User identifier")
    conversation_id: Optional[str] = Field(default=None, description="Conversation identifier")
    reset_state: Optional[bool] = Field(default=False, description="Reset agent state")

class AgentDecision(BaseModel):
    action: str = Field(description="What action the agent should take")
    reasoning: str = Field(description="Reasoning for the decision")
    task_details: Optional[Dict[str, Any]] = Field(default=None, description="Task details if creating/updating task")
    profile_updates: Optional[Dict[str, Any]] = Field(default=None, description="Profile updates if updating profile")
    tool_calls: Optional[List[Dict[str, Any]]] = Field(default=None, description="Tool calls to make")
    
    model_config = ConfigDict(use_enum_values=True)

class ChatResponse(BaseModel):
    response: str = Field(description="AI response")
    conversation_id: str = Field(description="Conversation identifier")
    used_rag: bool = Field(default=False, description="Whether RAG was used")
    rag_sources: List[str] = Field(default_factory=list, description="RAG sources")
    agent_actions: List[AgentDecision] = Field(default_factory=list, description="Agent actions taken")
    new_tasks: List[WellnessTask] = Field(default_factory=list, description="New tasks created")
    updated_profile: Optional[UserProfile] = Field(default=None, description="Updated profile if changed")
    pipeline_logs: List[str] = Field(default_factory=list, description="RAG pipeline logs")
    agent_state: AgentState = Field(default=AgentState.COMPLETED, description="Current agent state")
    checkpoint_id: Optional[str] = Field(default=None, description="Checkpoint ID for resuming")

# ========== TOOL DEFINITIONS ==========
class AgentTools:
    """Collection of tools available to the agent"""
    
    @staticmethod
    @tool
    def search_knowledge_base(query: str) -> str:
        """Search the mental health knowledge base for information."""
        global retriever
        try:
            if retriever is None:
                return "Knowledge base not available."
            
            docs = retriever.invoke(query)
            if not docs:
                return "No relevant information found in knowledge base."
            
            # Format results
            results = []
            for i, doc in enumerate(docs[:3], 1):
                source = doc.metadata.get('source', 'unknown')
                content = doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content
                results.append(f"[{i}] Source: {source}\n{content}")
            
            return "\n\n".join(results)
        except Exception as e:
            return f"Error searching knowledge base: {str(e)}"
    
    @staticmethod
    @tool
    def create_wellness_task(
        user_id: str,
        task_description: str,
        category: TaskCategory,
        priority: int = 1,
        time_to_complete: int = 15
    ) -> Dict[str, Any]:
        """Create a new wellness task for the user."""
        try:
            task = WellnessTask(
                user_id=user_id,
                task=task_description,
                category=category,
                priority=priority,
                time_to_complete=time_to_complete,
                status=TaskStatus.NOT_STARTED,
                created_at=datetime.now(),
                due_date=datetime.now() + timedelta(days=2)
            )
            
            success = save_user_task(task)
            if success:
                return {
                    "success": True,
                    "message": f"Task created: {task_description}",
                    "task_id": task.id,
                    "task": task.model_dump()
                }
            else:
                return {"success": False, "message": "Failed to save task"}
        except Exception as e:
            return {"success": False, "message": f"Error creating task: {str(e)}"}
    
    @staticmethod
    @tool
    def update_task_status(
        user_id: str,
        task_id: str,
        status: TaskStatus,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update the status of a wellness task."""
        try:
            tasks = load_user_tasks(user_id)
            for task in tasks:
                if task.id == task_id:
                    task.status = status
                    task.updated_at = datetime.now()
                    if notes:
                        task.notes = notes
                    if status == TaskStatus.COMPLETED:
                        task.completed_at = datetime.now()
                    
                    save_user_tasks(user_id, tasks)
                    return {
                        "success": True,
                        "message": f"Task {task_id} updated to {status}",
                        "task": task.model_dump()
                    }
            
            return {"success": False, "message": f"Task {task_id} not found"}
        except Exception as e:
            return {"success": False, "message": f"Error updating task: {str(e)}"}
    
    @staticmethod
    @tool
    def get_user_tasks(user_id: str, status: Optional[TaskStatus] = None) -> Dict[str, Any]:
        """Get user's wellness tasks, optionally filtered by status."""
        try:
            tasks = load_user_tasks(user_id)
            if status:
                tasks = [t for t in tasks if t.status == status]
            
            return {
                "success": True,
                "count": len(tasks),
                "tasks": [t.model_dump() for t in tasks]
            }
        except Exception as e:
            return {"success": False, "message": f"Error getting tasks: {str(e)}"}
    
    @staticmethod
    @tool
    def update_user_profile(
        user_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update user profile information."""
        try:
            profile = load_user_profile(user_id)
            
            # Apply updates
            for key, value in updates.items():
                if hasattr(profile, key):
                    setattr(profile, key, value)
            
            profile.last_session = datetime.now()
            save_user_profile(profile)
            
            return {
                "success": True,
                "message": "Profile updated successfully",
                "profile": profile.model_dump()
            }
        except Exception as e:
            return {"success": False, "message": f"Error updating profile: {str(e)}"}
    
    @staticmethod
    @tool
    def analyze_emotional_state(text: str) -> Dict[str, Any]:
        """Analyze the emotional state from text."""
        try:
            # Simple keyword-based analysis (can be replaced with ML model)
            text_lower = text.lower()
            analysis = {
                "detected_emotions": [],
                "primary_emotion": EmotionalState.NEUTRAL.value,
                "confidence": 0.5,
                "keywords_found": []
            }
            
            emotion_keywords = {
                EmotionalState.STRESSED: ["stress", "overwhelmed", "pressure", "burnout", "tense"],
                EmotionalState.ANXIOUS: ["anxious", "worried", "nervous", "panic", "fear"],
                EmotionalState.DEPRESSED: ["depressed", "sad", "hopeless", "empty", "worthless"],
                EmotionalState.ANGRY: ["angry", "frustrated", "irritated", "mad", "annoyed"],
                EmotionalState.HAPPY: ["happy", "good", "great", "excited", "joy"],
                EmotionalState.CALM: ["calm", "peaceful", "relaxed", "content", "serene"]
            }
            
            detected_emotions = []
            for emotion, keywords in emotion_keywords.items():
                found_keywords = [k for k in keywords if k in text_lower]
                if found_keywords:
                    detected_emotions.append(emotion.value)
                    analysis["keywords_found"].extend(found_keywords)
            
            if detected_emotions:
                analysis["detected_emotions"] = detected_emotions
                analysis["primary_emotion"] = detected_emotions[0]
                analysis["confidence"] = min(0.9, 0.5 + (len(detected_emotions) * 0.1))
            
            return {"success": True, "analysis": analysis}
        except Exception as e:
            return {"success": False, "message": f"Error analyzing emotional state: {str(e)}"}
    
    @staticmethod
    @tool
    def suggest_coping_strategies(emotion: str) -> Dict[str, Any]:
        """Suggest coping strategies based on emotional state."""
        strategies = {
            "stressed": [
                "Practice deep breathing for 5 minutes",
                "Take a 15-minute walk in nature",
                "Write down your thoughts in a journal",
                "Try progressive muscle relaxation"
            ],
            "anxious": [
                "Grounding exercise: Name 5 things you can see, 4 things you can touch",
                "Focus on your breath, counting to 4 on inhale and exhale",
                "Write down your worries and challenge them logically",
                "Listen to calming music or nature sounds"
            ],
            "depressed": [
                "Reach out to a friend or family member",
                "Engage in a small, enjoyable activity",
                "Practice self-compassion meditation",
                "Create a small achievable goal for the day"
            ],
            "angry": [
                "Take a timeout and remove yourself from the situation",
                "Practice counting backwards from 10",
                "Engage in physical exercise",
                "Write a letter expressing your feelings (without sending it)"
            ]
        }
        
        if emotion.lower() in strategies:
            return {
                "success": True,
                "emotion": emotion,
                "strategies": strategies[emotion.lower()],
                "recommendation": f"For {emotion}, try starting with: {strategies[emotion.lower()][0]}"
            }
        else:
            return {
                "success": True,
                "emotion": emotion,
                "strategies": ["Practice mindfulness meditation", "Go for a walk", "Talk to someone you trust"],
                "recommendation": "General coping strategies recommended"
            }

# ========== DATA MANAGEMENT FUNCTIONS ==========
def load_user_profile(user_id: str) -> UserProfile:
    """Load user profile from file"""
    profile_path = os.path.join(USER_PROFILES_DIR, f"{user_id}.json")
    if os.path.exists(profile_path):
        try:
            with open(profile_path, 'r', encoding='utf-8') as f:
                profile_data = json.load(f)
                # Convert dates
                for date_field in ['last_session']:
                    if profile_data.get(date_field):
                        profile_data[date_field] = datetime.fromisoformat(profile_data[date_field])
                return UserProfile(**profile_data)
        except Exception as e:
            logger.error(f"Error loading profile for {user_id}: {e}")
    
    return UserProfile(
        user_id=user_id,
        mental_health_goals=["Improve mental wellbeing", "Build healthy habits"],
        coping_strategies=["Deep breathing", "Going for walks"],
        triggers=["Work stress", "Lack of sleep"],
        preferences={"task_reminders": True, "conversation_style": "empathetic"},
        progress_metrics={"wellness_score": 50.0, "consistency": 0.0}
    )

def save_user_profile(profile: UserProfile) -> bool:
    """Save user profile to file"""
    try:
        profile_path = os.path.join(USER_PROFILES_DIR, f"{profile.user_id}.json")
        with open(profile_path, 'w', encoding='utf-8') as f:
            json.dump(profile.model_dump(), f, indent=2, default=str)
        return True
    except Exception as e:
        logger.error(f"Error saving profile for {profile.user_id}: {e}")
        return False

def load_user_tasks(user_id: str) -> List[WellnessTask]:
    """Load user tasks from file"""
    tasks_path = os.path.join(USER_TASKS_DIR, f"{user_id}.json")
    if os.path.exists(tasks_path):
        try:
            with open(tasks_path, 'r', encoding='utf-8') as f:
                tasks_data = json.load(f)
                tasks = []
                for task_data in tasks_data:
                    # Convert dates
                    for date_field in ['created_at', 'updated_at', 'due_date', 'completed_at']:
                        if task_data.get(date_field):
                            task_data[date_field] = datetime.fromisoformat(task_data[date_field])
                    # Convert category and status
                    if 'category' in task_data:
                        task_data['category'] = TaskCategory(task_data['category'])
                    if 'status' in task_data:
                        task_data['status'] = TaskStatus(task_data['status'])
                    tasks.append(WellnessTask(**task_data))
                return tasks
        except Exception as e:
            logger.error(f"Error loading tasks for {user_id}: {e}")
            return []
    return []

def save_user_tasks(user_id: str, tasks: List[WellnessTask]) -> bool:
    """Save user tasks to file"""
    try:
        tasks_path = os.path.join(USER_TASKS_DIR, f"{user_id}.json")
        tasks_data = [task.model_dump() for task in tasks]
        with open(tasks_path, 'w', encoding='utf-8') as f:
            json.dump(tasks_data, f, indent=2, default=str)
        return True
    except Exception as e:
        logger.error(f"Error saving tasks for {user_id}: {e}")
        return False

def save_user_task(task: WellnessTask) -> bool:
    """Save a single task"""
    tasks = load_user_tasks(task.user_id)
    # Check if task already exists
    for i, existing_task in enumerate(tasks):
        if existing_task.id == task.id:
            tasks[i] = task
            break
    else:
        tasks.append(task)
    
    return save_user_tasks(task.user_id, tasks)

# ========== INITIALIZATION ==========
def initialize_embeddings():
    """Initialize the embedding model"""
    try:
        rag_logger.start_pipeline("Initialize Embeddings")
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        rag_logger.log_step(f"SUCCESS: Embeddings model loaded", "success")
        rag_logger.end_pipeline()
        return embeddings
    except Exception as e:
        rag_logger.log_step(f"ERROR loading embeddings: {e}", "error")
        return None

def initialize_vectorstore():
    """Initialize the vectorstore with advanced configuration"""
    global vectorstore, retriever
    
    try:
        rag_logger.start_pipeline("Initialize Advanced VectorStore")
        embeddings = initialize_embeddings()
        if embeddings is None:
            return None, None
        
        os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
        
        if os.path.exists(CHROMA_PERSIST_DIR) and os.listdir(CHROMA_PERSIST_DIR):
            vectorstore = Chroma(
                persist_directory=CHROMA_PERSIST_DIR,
                embedding_function=embeddings,
                collection_name="mental_health_kb"
            )
            rag_logger.log_step("SUCCESS: Loaded existing vectorstore", "success")
        else:
            default_docs = create_default_knowledge()
            
            # Create text splitter with optimal settings
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=500,
                chunk_overlap=50,
                length_function=len,
                separators=["\n\n", "\n", " ", ""]
            )
            
            # Split documents
            split_docs = text_splitter.split_documents(default_docs)
            
            vectorstore = Chroma.from_documents(
                documents=split_docs,
                embedding=embeddings,
                persist_directory=CHROMA_PERSIST_DIR,
                collection_name="mental_health_kb"
            )
            
            rag_stats["total_documents"] = len(default_docs)
            rag_stats["total_chunks"] = len(split_docs)
            rag_logger.log_step(f"SUCCESS: Created vectorstore with {len(default_docs)} documents", "success")
        
        # Create advanced retriever
        retriever = vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 5}
        )
        
        rag_logger.log_step("SUCCESS: Advanced VectorStore and retriever initialized", "success")
        rag_logger.end_pipeline()
        return vectorstore, retriever
    except Exception as e:
        rag_logger.log_step(f"ERROR initializing vectorstore: {e}", "error")
        return None, None

def create_default_knowledge():
    """Create comprehensive default knowledge base"""
    knowledge = [
        {
            "question": "What is anxiety and how can I manage it?",
            "answer": "Anxiety is a natural stress response characterized by feelings of worry, nervousness, or unease. Symptoms include rapid heartbeat, sweating, trembling, and difficulty concentrating. Management strategies include cognitive-behavioral techniques, mindfulness meditation, regular exercise, and in some cases, professional therapy or medication.",
            "category": "anxiety",
            "source": "default"
        },
        {
            "question": "What are common symptoms of depression?",
            "answer": "Depression symptoms include persistent sadness, loss of interest in activities, changes in appetite or weight, sleep disturbances, fatigue, feelings of worthlessness, difficulty concentrating, and recurrent thoughts of death or suicide. It's important to seek professional help if experiencing these symptoms.",
            "category": "depression",
            "source": "default"
        },
        {
            "question": "How to practice mindfulness effectively?",
            "answer": "Mindfulness involves paying attention to the present moment without judgment. Effective practices include: 1) Start with 5-10 minutes daily, 2) Focus on breath or bodily sensations, 3) Use guided meditations, 4) Practice mindful walking or eating, 5) Be patient and non-judgmental with yourself.",
            "category": "mindfulness",
            "source": "default"
        },
        {
            "question": "What is Cognitive Behavioral Therapy (CBT)?",
            "answer": "CBT is a structured, time-limited psychotherapy that focuses on identifying and changing negative thought patterns and behaviors. It's effective for anxiety, depression, and other mental health conditions. Techniques include cognitive restructuring, behavioral activation, and exposure therapy.",
            "category": "therapy",
            "source": "default"
        },
        {
            "question": "Sleep hygiene best practices",
            "answer": "Good sleep hygiene includes: 1) Consistent sleep schedule, 2) Cool, dark, quiet bedroom, 3) Avoid screens 1 hour before bed, 4) Limit caffeine and alcohol, 5) Regular exercise (not before bed), 6) Relaxation routine before sleep, 7) Comfortable bedding and mattress.",
            "category": "sleep",
            "source": "default"
        },
        {
            "question": "Effective stress management techniques",
            "answer": "Stress management techniques: 1) Deep breathing exercises, 2) Progressive muscle relaxation, 3) Time management skills, 4) Regular physical activity, 5) Healthy diet, 6) Adequate sleep, 7) Social support, 8) Hobbies and leisure activities, 9) Professional counseling if needed.",
            "category": "stress",
            "source": "default"
        }
    ]
    
    documents = []
    for idx, item in enumerate(knowledge, 1):
        doc = Document(
            page_content=f"Topic: {item['category']}\nQuestion: {item['question']}\n\nAnswer: {item['answer']}",
            metadata={
                "source": item['source'],
                "type": "qa_pair",
                "category": item['category'],
                "index": idx,
                "created_at": datetime.now().isoformat()
            }
        )
        documents.append(doc)
    
    return documents

# ========== SIMPLE AGENT PIPELINE ==========
class SimpleAgentPipeline:
    """Simplified agent pipeline when LangGraph is not available"""
    
    def __init__(self):
        self.tools = [
            AgentTools.search_knowledge_base,
            AgentTools.create_wellness_task,
            AgentTools.update_task_status,
            AgentTools.get_user_tasks,
            AgentTools.update_user_profile,
            AgentTools.analyze_emotional_state,
            AgentTools.suggest_coping_strategies
        ]
        
        # Initialize LLM
        if HAS_GROQ and os.getenv("GROQ_API_KEY"):
            from langchain_groq import ChatGroq
            self.llm = ChatGroq(
                model="llama-3.1-8b-instant",
                temperature=0.3,
                max_tokens=1000,
                api_key=os.getenv("GROQ_API_KEY")
            )
        else:
            # Fallback to OpenAI or local
            try:
                from langchain_openai import ChatOpenAI
                self.llm = ChatOpenAI(
                    model="gpt-3.5-turbo",
                    temperature=0.3,
                    max_tokens=1000
                )
            except:
                # Ultimate fallback
                class SimpleLLM:
                    def invoke(self, messages):
                        return AIMessage(content="I'm here to support you. Please install a proper LLM for better responses.")
                self.llm = SimpleLLM()
        
        # Create agent
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a compassionate Mental Health AI Assistant. 
             Be empathetic, supportive, and helpful. Use tools when appropriate."""),
            MessagesPlaceholder(variable_name="messages"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])
        
        self.agent = create_tool_calling_agent(self.llm, self.tools, prompt)
        self.agent_executor = AgentExecutor(agent=self.agent, tools=self.tools, verbose=True)
    
    async def process_message(self, user_id: str, conversation_id: str, message: str) -> Dict[str, Any]:
        """Process a message through the simplified pipeline"""
        try:
            rag_logger.start_pipeline(f"Simple Agent Pipeline: {user_id}")
            
            # Initialize state
            state = self._initialize_state(user_id, conversation_id)
            
            # Add user message
            state["messages"].append(HumanMessage(content=message))
            
            # Step 1: Analyze emotional state
            rag_logger.log_step("Analyzing emotional state...")
            emotional_result = AgentTools.analyze_emotional_state.func(message)
            state["analysis"] = emotional_result.get("analysis", {})
            state["emotional_state"] = EmotionalState(state["analysis"].get("primary_emotion", "neutral"))
            
            # Step 2: Retrieve knowledge if needed
            rag_keywords = ["what is", "how to", "symptoms", "treatment", "therapy",
                          "anxiety", "depression", "stress", "mental health"]
            
            used_rag = False
            rag_sources = []
            retrieved_docs = []
            
            if any(keyword in message.lower() for keyword in rag_keywords) and retriever:
                rag_logger.log_step("Retrieving knowledge...")
                try:
                    retrieved_docs = retriever.invoke(message)
                    if retrieved_docs:
                        used_rag = True
                        rag_sources = list(set([doc.metadata.get('source', 'unknown') for doc in retrieved_docs]))
                        
                        # Add context to messages
                        context = "\n\nRelevant information:\n" + "\n".join([
                            f"- {doc.page_content[:200]}..." for doc in retrieved_docs[:2]
                        ])
                        state["messages"].append(HumanMessage(content=context))
                except Exception as e:
                    logger.error(f"Error in RAG retrieval: {e}")
            
            # Step 3: Execute agent
            rag_logger.log_step("Executing agent...")
            response = self.agent_executor.invoke({
                "input": message,
                "messages": state["messages"]
            })
            
            response_text = response["output"] if isinstance(response, dict) and "output" in response else str(response)
            
            # Step 4: Check for task creation opportunities
            new_tasks = []
            if "task" in message.lower() or "todo" in message.lower():
                # Check if user needs tasks
                tasks_result = AgentTools.get_user_tasks.func(user_id)
                if tasks_result.get("success"):
                    tasks = tasks_result.get("tasks", [])
                    pending_tasks = [t for t in tasks if t.get("status") != TaskStatus.COMPLETED.value]
                    
                    if len(pending_tasks) < 2:
                        # Create a simple task
                        task_result = AgentTools.create_wellness_task.func(
                            user_id=user_id,
                            task_description="Practice 5 minutes of mindful breathing",
                            category=TaskCategory.MINDFULNESS,
                            priority=2,
                            time_to_complete=5
                        )
                        if task_result.get("success"):
                            new_tasks.append(WellnessTask(**task_result["task"]))
            
            # Step 5: Update profile if personal info found
            updated_profile = None
            if any(phrase in message.lower() for phrase in ["my name is", "i am", "i'm from"]):
                updates = {}
                if "my name is" in message.lower():
                    name_match = re.search(r"my name is (\w+)", message, re.IGNORECASE)
                    if name_match:
                        updates["name"] = name_match.group(1)
                
                if updates:
                    profile_result = AgentTools.update_user_profile.func(user_id, updates)
                    if profile_result.get("success"):
                        updated_profile = UserProfile(**profile_result["profile"])
            
            rag_logger.log_step("Pipeline completed", "success")
            rag_logger.end_pipeline()
            
            return {
                "response": response_text,
                "used_rag": used_rag,
                "rag_sources": rag_sources,
                "new_tasks": new_tasks,
                "updated_profile": updated_profile,
                "pipeline_logs": rag_logger.steps[-10:] if rag_logger.steps else [],
                "agent_state": AgentState.COMPLETED,
                "checkpoint_id": conversation_id
            }
            
        except Exception as e:
            logger.error(f"Error in simple agent pipeline: {e}")
            return {
                "response": "I'm here to listen and support you. Could you tell me more about what's on your mind?",
                "used_rag": False,
                "rag_sources": [],
                "new_tasks": [],
                "updated_profile": None,
                "pipeline_logs": [f"Error: {str(e)}"],
                "agent_state": AgentState.COMPLETED,
                "checkpoint_id": None
            }
    
    def _initialize_state(self, user_id: str, conversation_id: str) -> Dict[str, Any]:
        """Initialize a simple state dictionary"""
        profile = load_user_profile(user_id)
        tasks = load_user_tasks(user_id)
        
        return {
            "messages": [
                SystemMessage(content="You are a compassionate mental health assistant."),
                HumanMessage(content="Hello, I'm here to support your mental wellness.")
            ],
            "user_id": user_id,
            "conversation_id": conversation_id,
            "profile": profile.model_dump(),
            "tasks": [t.model_dump() for t in tasks],
            "analysis": {},
            "emotional_state": EmotionalState.NEUTRAL
        }

# ========== AGENT MANAGEMENT ==========
if HAS_LANGGRAPH and HAS_CHECKPOINTING:
    # Initialize proper checkpointer
    checkpointer = AsyncSqliteSaver.from_conn_string(f"sqlite:///{CHECKPOINT_DB_PATH}")
    
    # Define LangGraph node functions
    def analyze_state(state: AgentMemory) -> AgentMemory:
        """Analyze the conversation state and user message."""
        try:
            messages = state.get("messages", [])
            if not messages:
                return state
            
            last_message = messages[-1]
            user_input = ""
            
            if hasattr(last_message, 'content'):
                user_input = last_message.content
            elif isinstance(last_message, dict) and 'content' in last_message:
                user_input = last_message['content']
            
            # Update state
            state["agent_state"] = AgentState.ANALYZING
            
            # Perform emotional analysis
            emotional_analysis = AgentTools.analyze_emotional_state.func(user_input)
            
            # Update emotional state
            if emotional_analysis.get("success"):
                analysis = emotional_analysis["analysis"]
                state["emotional_state"] = EmotionalState(analysis["primary_emotion"])
                state["emotional_history"].append({
                    "timestamp": datetime.now().isoformat(),
                    "state": analysis["primary_emotion"],
                    "confidence": analysis["confidence"],
                    "keywords": analysis["keywords_found"]
                })
                
                # Keep only last 20 emotional states
                if len(state["emotional_history"]) > 20:
                    state["emotional_history"] = state["emotional_history"][-20:]
            
            # Store analysis
            state["analysis"] = {
                "emotional_analysis": emotional_analysis,
                "message_length": len(user_input),
                "has_task_reference": any(word in user_input.lower() for word in ["task", "todo", "remind", "complete"]),
                "has_question": "?" in user_input,
                "timestamp": datetime.now().isoformat()
            }
            
            state["updated_at"] = datetime.now()
            
            return state
        except Exception as e:
            logger.error(f"Error in analyze_state: {e}")
            state["analysis"] = {"error": str(e)}
            return state
    
    # ... [Other LangGraph node functions would go here] ...
    
    # Create the graph
    workflow = StateGraph(AgentMemory)
    workflow.add_node("analyze", analyze_state)
    # ... [Add other nodes and edges] ...
    workflow.set_entry_point("analyze")
    workflow.add_edge("analyze", END)  # Simplified for now
    
    agent_graph = workflow.compile(checkpointer=checkpointer)
    
    async def run_agent_pipeline(user_id: str, conversation_id: str, message: str, reset_state: bool = False) -> Dict[str, Any]:
        """Run the complete agent pipeline with LangGraph"""
        try:
            # Initialize state
            config = {"configurable": {"thread_id": conversation_id}}
            
            if reset_state:
                await checkpointer.adelete(config)
            
            existing_state = await checkpointer.aget(config)
            
            if existing_state and not reset_state:
                state = existing_state["values"]
                state["messages"].append(HumanMessage(content=message))
            else:
                profile = load_user_profile(user_id)
                tasks = load_user_tasks(user_id)
                
                state = AgentMemory(
                    messages=[
                        SystemMessage(content="You are a compassionate mental health assistant."),
                        HumanMessage(content=message)
                    ],
                    user_id=user_id,
                    conversation_id=conversation_id,
                    agent_state=AgentState.INITIAL,
                    profile=profile.model_dump(),
                    tasks=[t.model_dump() for t in tasks],
                    analysis={},
                    retrieved_docs=[],
                    decisions=[],
                    available_tools=[tool.__name__ for tool in AgentTools.__dict__.values() if callable(tool)],
                    execution_results={},
                    checkpoint_id=str(uuid.uuid4()),
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                    emotional_state=EmotionalState.NEUTRAL,
                    emotional_history=[],
                    pending_tasks=len([t for t in tasks if t.status != TaskStatus.COMPLETED]),
                    completed_tasks_today=0
                )
            
            # Run the graph
            final_state = await agent_graph.ainvoke(state, config=config)
            
            # Extract response
            messages = final_state.get("messages", [])
            response = ""
            for msg in reversed(messages):
                if isinstance(msg, AIMessage):
                    response = msg.content
                    break
            
            return {
                "response": response,
                "state": final_state,
                "agent_actions": [],
                "new_tasks": [],
                "updated_profile": None,
                "used_rag": False,
                "rag_sources": [],
                "pipeline_logs": ["LangGraph pipeline executed"],
                "agent_state": final_state.get("agent_state", AgentState.COMPLETED),
                "checkpoint_id": final_state.get("checkpoint_id")
            }
            
        except Exception as e:
            logger.error(f"Error in LangGraph pipeline: {e}")
            # Fall back to simple pipeline
            simple_pipeline = SimpleAgentPipeline()
            return await simple_pipeline.process_message(user_id, conversation_id, message)
            
else:
    # Use simple pipeline without LangGraph
    simple_pipeline = SimpleAgentPipeline()
    
    async def run_agent_pipeline(user_id: str, conversation_id: str, message: str, reset_state: bool = False) -> Dict[str, Any]:
        """Run the simplified agent pipeline"""
        return await simple_pipeline.process_message(user_id, conversation_id, message)

# ========== API ENDPOINTS ==========
@app.get("/")
async def root():
    return {
        "message": "Mental Health AI Agent API",
        "status": "online",
        "rag_initialized": vectorstore is not None,
        "agentic_workflow": True,
        "langgraph_enabled": HAS_LANGGRAPH,
        "checkpointing": HAS_CHECKPOINTING
    }

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Main chat endpoint"""
    try:
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        logger.info(f"Chat request: user={request.user_id}, conv={conversation_id[:8]}...")
        
        # Run the agent pipeline
        result = await run_agent_pipeline(
            request.user_id,
            conversation_id,
            request.message,
            request.reset_state
        )
        
        # Prepare response
        response = ChatResponse(
            response=result["response"],
            conversation_id=conversation_id,
            used_rag=result["used_rag"],
            rag_sources=result["rag_sources"],
            agent_actions=[],  # Simplified for now
            new_tasks=result["new_tasks"],
            updated_profile=result["updated_profile"],
            pipeline_logs=result["pipeline_logs"],
            agent_state=result["agent_state"],
            checkpoint_id=result["checkpoint_id"]
        )
        
        return response
        
    except Exception as e:
        logger.error(f"ERROR in chat endpoint: {e}")
        
        return ChatResponse(
            response="I'm having trouble processing your request. Please try again.",
            conversation_id=request.conversation_id or str(uuid.uuid4()),
            used_rag=False,
            agent_actions=[],
            pipeline_logs=[f"Error: {str(e)}"]
        )

@app.get("/api/profile/{user_id}")
async def get_profile(user_id: str):
    """Get user profile with current tasks"""
    try:
        profile = load_user_profile(user_id)
        tasks = load_user_tasks(user_id)
        
        active_tasks = [task for task in tasks if task.status != TaskStatus.COMPLETED]
        completed_tasks = [task for task in tasks if task.status == TaskStatus.COMPLETED]
        
        return {
            "profile": profile.model_dump(),
            "tasks": {
                "active": [task.model_dump() for task in active_tasks],
                "completed": [task.model_dump() for task in completed_tasks],
                "total": len(tasks),
                "active_count": len(active_tasks)
            }
        }
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tasks/{user_id}")
async def get_tasks(user_id: str, status: Optional[TaskStatus] = None):
    """Get user tasks"""
    try:
        tasks = load_user_tasks(user_id)
        
        if status:
            tasks = [task for task in tasks if task.status == status]
        
        return {
            "tasks": [task.model_dump() for task in tasks],
            "user_id": user_id,
            "count": len(tasks)
        }
    except Exception as e:
        logger.error(f"Error getting tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tasks/{user_id}/create")
async def create_task(user_id: str, task: WellnessTask):
    """Create a new task"""
    try:
        task.user_id = user_id
        if save_user_task(task):
            return {"success": True, "message": "Task created", "task": task.model_dump()}
        else:
            raise HTTPException(status_code=500, detail="Failed to create task")
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Upload CSV to knowledge base"""
    global vectorstore, retriever, rag_stats
    
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be CSV")
        
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Standardize columns
        if 'Question' in df.columns and 'Answer' in df.columns:
            df = df.rename(columns={'Question': 'question', 'Answer': 'answer'})
        elif 'question' not in df.columns or 'answer' not in df.columns:
            if len(df.columns) >= 2:
                df.columns = ['question', 'answer'] + list(df.columns[2:])
            else:
                raise HTTPException(status_code=400, detail="CSV must have 'question' and 'answer' columns")
        
        # Create documents
        documents = []
        for idx, row in df.iterrows():
            question = str(row['question']).strip() if pd.notna(row['question']) else ""
            answer = str(row['answer']).strip() if pd.notna(row['answer']) else ""
            
            if not question or not answer:
                continue
            
            doc = Document(
                page_content=f"Question: {question}\n\nAnswer: {answer}",
                metadata={
                    "source": file.filename,
                    "type": "qa_pair", 
                    "row_index": idx,
                    "upload_time": datetime.now().isoformat(),
                    "category": "user_uploaded"
                }
            )
            documents.append(doc)
        
        if not documents:
            raise HTTPException(status_code=400, detail="No valid Q&A pairs found")
        
        # Add to vectorstore
        embeddings = initialize_embeddings()
        if embeddings is None:
            raise HTTPException(status_code=500, detail="Failed to initialize embeddings")
        
        if vectorstore is None:
            vectorstore = Chroma.from_documents(
                documents=documents,
                embedding=embeddings,
                persist_directory=CHROMA_PERSIST_DIR,
                collection_name="mental_health_kb"
            )
        else:
            vectorstore.add_documents(documents)
        
        retriever = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 5})
        
        # Update stats
        rag_stats["total_documents"] += len(documents)
        rag_stats["total_chunks"] += len(documents)
        rag_stats["csv_uploads"] += 1
        rag_stats["last_upload"] = datetime.now().isoformat()
        
        return {
            "success": True, 
            "message": f"Uploaded {len(documents)} Q&A pairs", 
            "count": len(documents)
        }
        
    except Exception as e:
        logger.error(f"ERROR in upload_csv: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy" if vectorstore is not None else "degraded",
        "rag_stats": rag_stats,
        "agentic_workflow": True,
        "langgraph": HAS_LANGGRAPH,
        "checkpointing": HAS_CHECKPOINTING,
        "timestamp": datetime.now().isoformat()
    }

# ========== STARTUP ==========
@app.on_event("startup")
async def startup_event():
    """Initialize systems on startup"""
    logger.info("Starting up Mental Health AI Agent System...")
    
    # Initialize vectorstore
    global vectorstore, retriever
    vectorstore, retriever = initialize_vectorstore()
    
    if vectorstore is None:
        logger.error("Failed to initialize vectorstore")
    else:
        logger.info(f"Vectorstore initialized with {rag_stats['total_documents']} documents")
    
    logger.info(f"LangGraph available: {HAS_LANGGRAPH}")
    logger.info(f"Checkpointing available: {HAS_CHECKPOINTING}")
    logger.info("Startup completed successfully")

# ========== MAIN ==========
if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting Mental Health AI Agent...")
    logger.info(f"Directories: Profiles={USER_PROFILES_DIR}, Tasks={USER_TASKS_DIR}")
    logger.info(f"Model: {'Groq' if HAS_GROQ and os.getenv('GROQ_API_KEY') else 'OpenAI/Fallback'}")
    logger.info(f"RAG System: {'Active' if retriever else 'Inactive'}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")