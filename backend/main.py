"""
Integrated Mental Health AI Agent System
Combines: Agentic RAG + LangGraph + Crisis Detection + Risk Scoring + Auth + Mood Tracking
"""

import uuid
import asyncio
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple, TypedDict, Annotated, Literal
from pydantic import BaseModel, Field, ConfigDict
from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect, Depends
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
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from collections import defaultdict, deque
from enum import Enum
from dataclasses import dataclass
import numpy as np
import warnings
warnings.filterwarnings('ignore')

# SQLAlchemy
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Float, JSON, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, Session

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

# ===================== ENVIRONMENT SETUP =====================
try:
    from dotenv import load_dotenv
    load_dotenv()
    logger.info("SUCCESS: Loaded environment variables")
except ImportError as e:
    logger.error(f"ERROR loading dotenv: {e}")

# ===================== OPTIONAL IMPORTS =====================
try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False
    logger.warning("bcrypt not available, using PBKDF2")

try:
    from langgraph.graph import StateGraph, END
    HAS_LANGGRAPH = True
    logger.info("SUCCESS: LangGraph imported")
except ImportError:
    HAS_LANGGRAPH = False
    logger.warning("LangGraph not available")

try:
    from langgraph.checkpoint.aiosqlite import AsyncSqliteSaver
    HAS_CHECKPOINTING = True
except ImportError:
    HAS_CHECKPOINTING = False

try:
    from langchain_groq import ChatGroq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.documents import Document
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_classic.agents import AgentExecutor, create_tool_calling_agent
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ===================== PASSWORD UTILS =====================
def hash_password(password: str) -> str:
    if HAS_BCRYPT:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return f"{salt}${pw_hash}"

def verify_password(password: str, hashed: str) -> bool:
    try:
        if HAS_BCRYPT and (hashed.startswith('$2a$') or hashed.startswith('$2b$')):
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
        if '$' in hashed:
            parts = hashed.split('$')
            if len(parts) == 2:
                salt, pw_hash = parts
                new_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
                return new_hash == pw_hash
        return password == hashed
    except Exception:
        return False

# ===================== EMAIL UTILS =====================
def send_emergency_email(recipient_email, contact_name, user_name, risk_level,
                         detected_keywords, message_text, user_email="", user_phone=""):
    try:
        smtp_server    = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port      = int(os.getenv("SMTP_PORT", 587))
        sender_email   = os.getenv("SENDER_EMAIL", "")
        sender_password= os.getenv("SENDER_PASSWORD", "")
        if not sender_password:
            logger.warning("SENDER_PASSWORD not configured. Email skipped.")
            return False
        subject  = f"URGENT: Mental Health Crisis Alert for {user_name}"
        html_body= f"""
        <html><body style="font-family: Arial; color: #333;">
        <div style="background:#ff6b6b;color:white;padding:20px;border-radius:5px;margin-bottom:20px;">
            <h2>MENTAL HEALTH CRISIS ALERT</h2>
        </div>
        <h3>Dear {contact_name},</h3>
        <p>An emergency alert has been triggered for <strong>{user_name}</strong>.
           Risk level: <strong style="color:#ff6b6b;">{risk_level.upper()}</strong></p>
        <div style="background:#f0f0f0;padding:15px;border-left:4px solid #ff6b6b;margin:20px 0;">
            <p><strong>Indicators:</strong> {', '.join(detected_keywords) if detected_keywords else 'Multiple detected'}</p>
            <p><strong>Time:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
        </div>
        <h4>IMMEDIATE ACTIONS:</h4>
        <ol>
            <li>Contact {user_name} immediately</li>
            <li>If immediate danger, call 911</li>
            <li>Suicide Prevention Lifeline: <strong>988</strong></li>
            <li>Crisis Text Line: Text HOME to 741741</li>
        </ol>
        </body></html>"""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = sender_email
        msg["To"]      = recipient_email
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipient_email, msg.as_string())
        logger.info(f"Emergency email sent to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Error sending emergency email: {e}")
        return False

# ===================== DATABASE SETUP =====================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mental_health.db")
engine       = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


class DBUser(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String, unique=True, index=True, nullable=False)
    # FIX: email is nullable — users can register with just username + password
    email         = Column(String, unique=True, index=True, nullable=True)
    # FIX: full_name column added to match the frontend signup form
    full_name     = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    phone         = Column(String, nullable=True)
    is_admin      = Column(Boolean, default=False)
    created_at    = Column(DateTime, default=datetime.utcnow)


class DBMoodEntry(Base):
    __tablename__ = "mood_entries"
    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, index=True)
    # FIX: column renamed to `score` to match frontend payload
    score     = Column(Float)
    notes     = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


class DBConversation(Base):
    __tablename__ = "conversations"
    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, index=True)
    message   = Column(Text)
    response  = Column(Text)
    language  = Column(String, default="en")
    timestamp = Column(DateTime, default=datetime.utcnow)
    context   = Column(JSON, nullable=True)


class DBCrisisEvent(Base):
    __tablename__     = "crisis_events"
    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(Integer, index=True)
    message_content   = Column(Text)
    risk_level        = Column(String)
    detected_keywords = Column(JSON)
    timestamp         = Column(DateTime, default=datetime.utcnow)
    escalated         = Column(Boolean, default=False)


class DBCrisisContact(Base):
    __tablename__                   = "crisis_contacts"
    id                              = Column(Integer, primary_key=True, index=True)
    user_id                         = Column(Integer, unique=True, index=True)
    emergency_contact_name          = Column(String)
    emergency_contact_phone         = Column(String, nullable=True)
    emergency_contact_email         = Column(String, nullable=True)
    # FIX: relationship field added to match the frontend emergency contact form
    emergency_contact_relationship  = Column(String, nullable=True)
    preferred_escalation            = Column(String, default="email")
    consent_given                   = Column(Boolean, default=False)


class DBUserProfile(Base):
    __tablename__        = "user_profiles_db"
    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, unique=True, index=True)
    preferences          = Column(JSON, default=dict)
    mental_health_history= Column(JSON, default=dict)
    updated_at           = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ===================== DIRECTORIES & GLOBALS =====================
CHROMA_PERSIST_DIR = "./chroma_db"
USER_PROFILES_DIR  = "./user_profiles"
USER_TASKS_DIR     = "./user_tasks"
CHECKPOINT_DB_PATH = "./checkpoints.db"
for d in [USER_PROFILES_DIR, USER_TASKS_DIR, CHROMA_PERSIST_DIR]:
    os.makedirs(d, exist_ok=True)

vectorstore = None
retriever   = None
rag_stats   = {"total_documents": 0, "total_chunks": 0, "csv_uploads": 0, "last_upload": None}

# ===================== ENUMS =====================
class TaskStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS  = "in_progress"
    COMPLETED    = "completed"
    SKIPPED      = "skipped"

class TaskCategory(str, Enum):
    SELF_CARE    = "self-care"
    EXERCISE     = "exercise"
    MINDFULNESS  = "mindfulness"
    SOCIAL       = "social"
    PROFESSIONAL = "professional"
    SLEEP        = "sleep"
    NUTRITION    = "nutrition"
    THERAPEUTIC  = "therapeutic"

class AgentState(str, Enum):
    INITIAL    = "initial"
    ANALYZING  = "analyzing"
    RETRIEVING = "retrieving"
    DECIDING   = "deciding"
    EXECUTING  = "executing"
    RESPONDING = "responding"
    COMPLETED  = "completed"

class EmotionalState(str, Enum):
    CALM      = "calm"
    STRESSED  = "stressed"
    ANXIOUS   = "anxious"
    DEPRESSED = "depressed"
    ANGRY     = "angry"
    HAPPY     = "happy"
    NEUTRAL   = "neutral"

# ===================== PYDANTIC MODELS =====================
class WellnessTask(BaseModel):
    # FIX: `title` added — frontend reads task.title / task.name
    id                  : str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id             : str
    title               : str = ""
    task                : str = ""
    description         : Optional[str] = None
    duration            : Optional[str] = None
    category            : TaskCategory
    status              : TaskStatus = TaskStatus.NOT_STARTED
    solutions           : List[str] = []
    time_to_complete    : int = 15
    created_at          : datetime = Field(default_factory=datetime.now)
    updated_at          : datetime = Field(default_factory=datetime.now)
    due_date            : Optional[datetime] = None
    completed_at        : Optional[datetime] = None
    notes               : Optional[str] = None
    # FIX: priority is "high"|"medium"|"low" string (frontend reads it as string)
    priority            : str = "medium"
    conversation_context: Optional[str] = None
    emotional_context   : Optional[EmotionalState] = None
    model_config = ConfigDict(json_encoders={datetime: lambda v: v.isoformat()})


class UserProfileModel(BaseModel):
    user_id            : str
    name               : Optional[str] = None
    age                : Optional[int] = None
    location           : Optional[str] = None
    job_profession     : Optional[str] = None
    interests          : List[str] = []
    mental_health_goals: List[str] = ["Improve mental wellbeing", "Build healthy habits"]
    # FIX: `goals` alias so the Profile view can read profile.goals directly
    goals              : List[str] = []
    coping_strategies  : List[str] = ["Deep breathing", "Going for walks"]
    triggers           : List[str] = ["Work stress", "Lack of sleep"]
    preferences        : Dict[str, Any] = {}
    last_session       : Optional[datetime] = None
    emotional_state    : Optional[EmotionalState] = None
    emotional_state_str: str = ""
    conversation_memory: List[Dict[str, Any]] = []
    progress_metrics   : Dict[str, float] = {"wellness_score": 50.0}
    model_config = ConfigDict(json_encoders={datetime: lambda v: v.isoformat()})


class ChatRequest(BaseModel):
    message        : str
    user_id        : str = "default_user"
    conversation_id: Optional[str] = None
    reset_state    : Optional[bool] = False
    language       : str = "en"


class ChatResponse(BaseModel):
    response            : str
    conversation_id     : str
    used_rag            : bool = False
    rag_sources         : List[str] = []
    agent_actions       : List[Dict[str, Any]] = []
    new_tasks           : List[WellnessTask] = []
    updated_profile     : Optional[UserProfileModel] = None
    pipeline_logs       : List[str] = []
    agent_state         : AgentState = AgentState.COMPLETED
    checkpoint_id       : Optional[str] = None
    crisis_detected     : bool = False
    risk_level          : Optional[str] = None
    harm_indicators     : List[str] = []
    escalation_triggered: bool = False


# ---- Auth Models ----

class UserCreate(BaseModel):
    """FIX: now matches exactly what the frontend sends on /users/ POST"""
    username                      : str
    password                      : str
    email                         : Optional[str] = None
    full_name                     : Optional[str] = None   # FIX: added
    phone                         : Optional[str] = None
    # Emergency contact sent as flat fields (not nested object)
    emergency_contact_name        : Optional[str] = None
    emergency_contact_phone       : Optional[str] = None
    emergency_contact_email       : Optional[str] = None
    emergency_contact_relationship: Optional[str] = None


class UserLogin(BaseModel):
    """FIX: authenticate by `username` (not email) to match the frontend"""
    username: str
    password: str


class MoodEntryCreate(BaseModel):
    """FIX: frontend sends `score` not `mood_score`"""
    user_id: int
    score  : float
    notes  : Optional[str] = None


class MessageRequest(BaseModel):
    user_id : int
    message : str
    language: str = "en"


class CrisisDetectionRequest(BaseModel):
    user_id: int
    message: str


class CrisisContactCreate(BaseModel):
    user_id                       : int
    emergency_contact_name        : str
    emergency_contact_phone       : Optional[str] = None
    emergency_contact_email       : Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    preferred_escalation          : str = "email"
    consent_given                 : bool = True

# ===================== RAG PIPELINE LOGGER =====================
class RAGPipelineLogger:
    def __init__(self):
        self.steps      = []
        self.start_time = None

    def start_pipeline(self, op):
        self.steps      = []
        self.start_time = time.time()

    def log_step(self, msg, level="info"):
        step_time = time.time() - self.start_time if self.start_time else 0
        formatted = f"[Step {len(self.steps)+1}] [{step_time:.2f}s] {msg}"
        self.steps.append(formatted)
        getattr(logger, level if level in ["info","warning","error"] else "info")(formatted)

    def end_pipeline(self, status="completed"):
        total = time.time() - self.start_time if self.start_time else 0
        logger.info(f"Pipeline {status} in {total:.2f}s")

rag_logger = RAGPipelineLogger()

# ===================== FILE-BASED DATA MANAGEMENT =====================
def load_user_profile(user_id: str) -> UserProfileModel:
    path = os.path.join(USER_PROFILES_DIR, f"{user_id}.json")
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if data.get('last_session'):
                data['last_session'] = datetime.fromisoformat(data['last_session'])
            return UserProfileModel(**data)
        except Exception as e:
            logger.error(f"Error loading profile {user_id}: {e}")
    return UserProfileModel(user_id=user_id)

def save_user_profile(profile: UserProfileModel) -> bool:
    try:
        path = os.path.join(USER_PROFILES_DIR, f"{profile.user_id}.json")
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(profile.model_dump(), f, indent=2, default=str)
        return True
    except Exception as e:
        logger.error(f"Error saving profile: {e}")
        return False

def load_user_tasks(user_id: str) -> List[WellnessTask]:
    path = os.path.join(USER_TASKS_DIR, f"{user_id}.json")
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            tasks = []
            for td in data:
                for df in ['created_at','updated_at','due_date','completed_at']:
                    if td.get(df):
                        td[df] = datetime.fromisoformat(td[df])
                if 'category' in td:
                    td['category'] = TaskCategory(td['category'])
                if 'status' in td:
                    td['status'] = TaskStatus(td['status'])
                tasks.append(WellnessTask(**td))
            return tasks
        except Exception as e:
            logger.error(f"Error loading tasks {user_id}: {e}")
    return []

def save_user_tasks(user_id: str, tasks: List[WellnessTask]) -> bool:
    try:
        path = os.path.join(USER_TASKS_DIR, f"{user_id}.json")
        with open(path, 'w', encoding='utf-8') as f:
            json.dump([t.model_dump() for t in tasks], f, indent=2, default=str)
        return True
    except Exception as e:
        logger.error(f"Error saving tasks: {e}")
        return False

def save_user_task(task: WellnessTask) -> bool:
    tasks = load_user_tasks(task.user_id)
    for i, t in enumerate(tasks):
        if t.id == task.id:
            tasks[i] = task
            break
    else:
        tasks.append(task)
    return save_user_tasks(task.user_id, tasks)

# ===================== CRISIS DETECTION =====================
CRISIS_KEYWORDS = {
    "critical": ["kill myself","suicide","want to die","end my life","hang myself","overdose","jump off","no point living"],
    "high":     ["self harm","cutting","hurting myself","don't want to live","worthless","burden","better off dead","want to hurt myself"],
    "medium":   ["depressed","anxious","panic","overwhelmed","can't cope","desperate","alone","breaking down"]
}

def analyze_harm_intent(message: str, llm=None) -> dict:
    if llm:
        try:
            prompt = f"""Analyze for harmful intent. Message: "{message}"
Respond ONLY with JSON (no markdown):
{{"risk_level":"critical|high|medium|low","confidence":0.0-1.0,"has_harm_intent":true|false,"indicators":[],"reason":""}}"""
            response = llm.invoke([HumanMessage(content=prompt)])
            text     = response.content.strip()
            j_start  = text.find('{')
            j_end    = text.rfind('}') + 1
            if j_start != -1:
                result = json.loads(text[j_start:j_end])
                return {
                    "risk_level"     : result.get("risk_level","low"),
                    "harm_indicators": result.get("indicators",[]),
                    "confidence"     : result.get("confidence",0.0),
                    "reason"         : result.get("reason","")
                }
        except Exception as e:
            logger.error(f"LLM harm analysis failed: {e}")

    msg_lower = message.lower()
    detected  = []
    max_risk  = "low"
    confidence= 0.0
    for risk, keywords in CRISIS_KEYWORDS.items():
        for kw in keywords:
            if kw in msg_lower:
                detected.append(kw)
                if risk == "critical":
                    max_risk   = "critical"
                    confidence = min(0.95, 0.8 + len(detected)*0.05)
                elif risk == "high" and max_risk != "critical":
                    max_risk   = "high"
                    confidence = min(0.85, 0.6 + len(detected)*0.05)
                elif risk == "medium" and max_risk == "low":
                    max_risk   = "medium"
                    confidence = min(0.75, 0.4 + len(detected)*0.05)
    return {"risk_level": max_risk, "harm_indicators": list(set(detected)), "confidence": confidence, "reason": f"Keywords: {', '.join(detected)}"}

def get_crisis_response(risk_level: str) -> str:
    responses = {
        "critical": "I'm very concerned about your safety. Please contact emergency services immediately (911) or Suicide Prevention Lifeline: 988.",
        "high"    : "I hear you're in significant pain. Crisis resources: Lifeline 988, Crisis Text Line: Text HOME to 741741.",
        "medium"  : "You're going through a tough time. A counselor or therapist can help. Would you like support resources?",
        "low"     : "I'm here to listen. Let's talk through what you're experiencing."
    }
    return responses.get(risk_level, responses["low"])

# ===================== RISK PREDICTOR =====================
class RiskPredictor:
    def predict_risk(self, mood_history: List[float], days_active: int = 7) -> Dict:
        if len(mood_history) < 2:
            return {"risk_score": 0.3, "risk_level": "low", "recommendations": ["Keep logging your mood daily."]}
        recent_avg = np.mean(mood_history[-7:]) if len(mood_history) >= 7 else np.mean(mood_history)
        hist_avg   = np.mean(mood_history)
        decline    = max(0, (hist_avg - recent_avg) / 10.0)
        std        = np.std(mood_history) / 10.0
        risk       = min(decline * 0.6 + std * 0.4, 1.0)
        level      = "high" if risk > 0.6 else ("medium" if risk > 0.3 else "low")
        recs       = []
        if level == "high":
            recs = ["Consider reaching out to a mental health professional.", "Suicide Prevention Lifeline: 988"]
        elif level == "medium":
            recs = ["Try mindfulness or breathing exercises.", "Maintain consistent sleep schedule."]
        else:
            recs = ["Keep up positive momentum!", "Stay connected with supportive people."]
        return {"risk_score": float(risk), "risk_level": level, "recommendations": recs}

risk_predictor = RiskPredictor()

# ===================== VECTORSTORE INIT =====================
def initialize_embeddings():
    try:
        return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    except Exception as e:
        logger.error(f"Error loading embeddings: {e}")
        return None

def create_default_knowledge():
    knowledge = [
        {"category": "anxiety",     "question": "What is anxiety and how can I manage it?",
         "answer": "Anxiety is a natural stress response with symptoms like rapid heartbeat, sweating. Management: CBT, mindfulness, regular exercise, professional therapy."},
        {"category": "depression",  "question": "What are symptoms of depression?",
         "answer": "Persistent sadness, loss of interest, appetite/sleep changes, fatigue, worthlessness. Seek professional help."},
        {"category": "mindfulness", "question": "How to practice mindfulness effectively?",
         "answer": "Be present without judgment. Start 5-10 minutes daily, focus on breath, use guided meditations."},
        {"category": "therapy",     "question": "What is CBT?",
         "answer": "Cognitive Behavioral Therapy identifies and changes negative thought patterns. Effective for anxiety and depression."},
        {"category": "sleep",       "question": "What are sleep hygiene best practices?",
         "answer": "Consistent schedule, dark/quiet room, avoid screens 1hr before bed, limit caffeine, relaxation routine."},
        {"category": "stress",      "question": "Effective stress management techniques?",
         "answer": "Deep breathing, progressive muscle relaxation, time management, exercise, healthy diet, social support."},
        {"category": "crisis",      "question": "What to do in a mental health crisis?",
         "answer": "Call 911 if immediate danger. Lifeline: 988. Crisis Text Line: Text HOME to 741741. Listen without judgment."},
        {"category": "coping",      "question": "What are healthy coping strategies?",
         "answer": "Exercise, journaling, talking to trusted friends, creative outlets, nature walks, meditation, breathing exercises."},
    ]
    return [Document(
        page_content=f"Topic: {k['category']}\nQuestion: {k['question']}\nAnswer: {k['answer']}",
        metadata={"source": "default", "category": k['category']}
    ) for k in knowledge]

def initialize_vectorstore():
    global vectorstore, retriever, rag_stats
    try:
        embeddings = initialize_embeddings()
        if not embeddings:
            return None, None
        os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
        if os.path.exists(CHROMA_PERSIST_DIR) and os.listdir(CHROMA_PERSIST_DIR):
            vs = Chroma(persist_directory=CHROMA_PERSIST_DIR, embedding_function=embeddings, collection_name="mental_health_kb")
            logger.info("Loaded existing vectorstore")
        else:
            docs       = create_default_knowledge()
            splitter   = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
            split_docs = splitter.split_documents(docs)
            vs         = Chroma.from_documents(documents=split_docs, embedding=embeddings, persist_directory=CHROMA_PERSIST_DIR, collection_name="mental_health_kb")
            rag_stats["total_documents"] = len(docs)
            rag_stats["total_chunks"]    = len(split_docs)
            logger.info(f"Created vectorstore with {len(docs)} docs, {len(split_docs)} chunks")
        ret = vs.as_retriever(search_type="similarity", search_kwargs={"k": 5})
        return vs, ret
    except Exception as e:
        logger.error(f"Error initializing vectorstore: {e}")
        return None, None

# ===================== LLM INIT =====================
def init_llm():
    if HAS_GROQ and os.getenv("GROQ_API_KEY"):
        return ChatGroq(model="llama-3.1-8b-instant", temperature=0.3, max_tokens=1000, api_key=os.getenv("GROQ_API_KEY"))
    try:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model="gpt-3.5-turbo", temperature=0.3, max_tokens=1000)
    except:
        class FallbackLLM:
            def invoke(self, messages):
                return AIMessage(content="I'm here to support you. Please configure an LLM API key for better responses.")
        return FallbackLLM()

llm = init_llm()

# ===================== AGENT TOOLS =====================
@tool
def search_knowledge_base(query: str) -> str:
    """Search the mental health knowledge base for relevant information."""
    global retriever
    if not retriever:
        return "Knowledge base not available."
    try:
        docs = retriever.invoke(query)
        if not docs:
            return "No relevant information found."
        results = []
        for i, doc in enumerate(docs[:3], 1):
            content = doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content
            results.append(f"[{i}] {content}")
        return "\n\n".join(results)
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def analyze_emotional_state(text: str) -> str:
    """Analyze emotional state from text."""
    text_lower       = text.lower()
    emotion_keywords = {
        "stressed"  : ["stress","overwhelmed","pressure","burnout","tense"],
        "anxious"   : ["anxious","worried","nervous","panic","fear"],
        "depressed" : ["depressed","sad","hopeless","empty","worthless"],
        "angry"     : ["angry","frustrated","irritated","mad","annoyed"],
        "happy"     : ["happy","good","great","excited","joy"],
        "calm"      : ["calm","peaceful","relaxed","content","serene"]
    }
    detected = [e for e, kws in emotion_keywords.items() if any(k in text_lower for k in kws)]
    primary  = detected[0] if detected else "neutral"
    return json.dumps({"primary_emotion": primary, "detected_emotions": detected, "confidence": min(0.9, 0.5 + len(detected)*0.1)})

@tool
def suggest_coping_strategies(emotion: str) -> str:
    """Suggest coping strategies based on emotional state."""
    strategies = {
        "stressed"  : ["Practice deep breathing for 5 minutes","Take a 15-minute walk","Journal your thoughts","Progressive muscle relaxation"],
        "anxious"   : ["Grounding: Name 5 things you can see","Breathe in for 4 counts, out for 4","Listen to calming music","Challenge anxious thoughts"],
        "depressed" : ["Reach out to a friend or family member","Engage in a small enjoyable activity","Practice self-compassion meditation","Set one small achievable goal"],
        "angry"     : ["Take a timeout","Count backwards from 10","Exercise","Write out your feelings"],
    }
    chosen = strategies.get(emotion.lower(), ["Practice mindfulness meditation","Go for a walk","Talk to someone you trust"])
    return json.dumps({"emotion": emotion, "strategies": chosen, "recommendation": chosen[0]})

# ===================== AGENT PIPELINE =====================
class AgentPipeline:
    def __init__(self):
        self.tools = [search_knowledge_base, analyze_emotional_state, suggest_coping_strategies]
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a compassionate Mental Health AI Assistant.
Be empathetic, supportive, and use tools when appropriate.
Always prioritize user safety. Keep responses warm, professional, and actionable."""),
            MessagesPlaceholder(variable_name="messages"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])
        try:
            agent         = create_tool_calling_agent(llm, self.tools, prompt)
            self.executor = AgentExecutor(agent=agent, tools=self.tools, verbose=False, handle_parsing_errors=True)
        except Exception as e:
            logger.error(f"Error creating agent: {e}")
            self.executor = None

    async def process(self, user_id: str, conv_id: str, message: str, language: str = "en") -> Dict[str, Any]:
        try:
            rag_logger.start_pipeline(f"Agent Pipeline: {user_id}")
            profile = load_user_profile(user_id)
            tasks   = load_user_tasks(user_id)

            rag_logger.log_step("Analyzing emotional state...")
            try:
                emotional_result = json.loads(analyze_emotional_state.func(message))
                primary_emotion  = emotional_result.get("primary_emotion","neutral")
            except:
                primary_emotion = "neutral"

            used_rag         = False
            rag_sources      = []
            context_addition = ""
            rag_keywords     = ["what is","how to","symptoms","treatment","therapy","anxiety",
                                "depression","stress","mental health","help","coping","crisis"]
            if any(kw in message.lower() for kw in rag_keywords) and retriever:
                rag_logger.log_step("Retrieving from knowledge base...")
                try:
                    docs = retriever.invoke(message)
                    if docs:
                        used_rag        = True
                        rag_sources     = list(set([d.metadata.get('source','unknown') for d in docs]))
                        context_addition= "\n\nRelevant knowledge:\n" + "\n".join([f"- {d.page_content[:200]}" for d in docs[:2]])
                except Exception as e:
                    logger.error(f"RAG error: {e}")

            pending        = [t for t in tasks if t.status != TaskStatus.COMPLETED]
            system_context = f"""User Profile:
- Name: {profile.name or 'Unknown'}
- Goals: {', '.join(profile.mental_health_goals[:2])}
- Current emotion: {primary_emotion}
- Active tasks: {len(pending)}
{context_addition}"""

            rag_logger.log_step("Running agent...")
            response_text = ""
            agent_actions = []
            if self.executor:
                try:
                    result        = self.executor.invoke({"input": message + f"\n\n[Context: {system_context}]", "messages": []})
                    response_text = result.get("output","")
                    for step in result.get("intermediate_steps",[]):
                        if len(step) >= 2:
                            action = step[0]
                            agent_actions.append({"action": str(action.tool), "reasoning": str(action.tool_input)[:100]})
                except Exception as e:
                    logger.error(f"Agent executor error: {e}")

            if not response_text:
                response_text = await self._fallback_response(message, primary_emotion, system_context, language)

            # Auto task creation
            new_tasks    = []
            task_triggers= ["task","remind me","help me","practice","exercise","meditate","sleep better"]
            if any(t in message.lower() for t in task_triggers):
                pending_count = len([t for t in tasks if t.status != TaskStatus.COMPLETED])
                if pending_count < 3:
                    task_map = {
                        "anxious"  : ("Practice 5 minutes of mindful breathing", TaskCategory.MINDFULNESS),
                        "stressed" : ("Take a 15-minute nature walk",             TaskCategory.EXERCISE),
                        "depressed": ("Connect with a friend or family member",   TaskCategory.SOCIAL),
                        "sleep"    : ("Establish a consistent bedtime routine",   TaskCategory.SLEEP),
                    }
                    task_desc, task_cat = task_map.get(primary_emotion, ("Practice daily mindfulness", TaskCategory.MINDFULNESS))
                    new_task = WellnessTask(
                        user_id=user_id, task=task_desc, title=task_desc,
                        category=task_cat, priority="medium", time_to_complete=10,
                        due_date=datetime.now() + timedelta(days=2),
                        emotional_context=EmotionalState(primary_emotion) if primary_emotion in [e.value for e in EmotionalState] else None
                    )
                    save_user_task(new_task)
                    new_tasks.append(new_task)

            updated_profile = None
            name_match      = re.search(r"my name is (\w+)", message, re.IGNORECASE)
            if name_match:
                profile.name         = name_match.group(1)
                profile.last_session = datetime.now()
                save_user_profile(profile)
                updated_profile = profile

            rag_logger.log_step("Pipeline completed")
            rag_logger.end_pipeline()

            return {
                "response"       : response_text,
                "used_rag"       : used_rag,
                "rag_sources"    : rag_sources,
                "agent_actions"  : agent_actions,
                "new_tasks"      : new_tasks,
                "updated_profile": updated_profile,
                "pipeline_logs"  : rag_logger.steps[-10:],
                "agent_state"    : AgentState.COMPLETED,
                "checkpoint_id"  : conv_id,
                "primary_emotion": primary_emotion,
            }
        except Exception as e:
            logger.error(f"Pipeline error: {e}")
            return {
                "response": "I'm here to support you. Could you tell me more about what's on your mind?",
                "used_rag": False, "rag_sources": [], "agent_actions": [], "new_tasks": [],
                "updated_profile": None, "pipeline_logs": [f"Error: {str(e)}"],
                "agent_state": AgentState.COMPLETED, "checkpoint_id": None, "primary_emotion": "neutral"
            }

    async def _fallback_response(self, message: str, emotion: str, context: str, language: str) -> str:
        try:
            lang_prompts = {
                "en": "You are a compassionate mental health assistant.",
                "es": "Eres un asistente compasivo de salud mental.",
                "fr": "Vous êtes un assistant compatissant en santé mentale.",
                "de": "Sie sind ein mitfühlender Assistent für psychische Gesundheit.",
                "hi": "आप एक दयालु मानसिक स्वास्थ्य सहायक हैं।"
            }
            sys_prompt = lang_prompts.get(language, lang_prompts["en"])
            prompt     = ChatPromptTemplate.from_messages([
                ("system", f"{sys_prompt}\n\nContext: {context}"),
                ("human",  "{input}")
            ])
            response = llm.invoke(prompt.format_messages(input=message))
            return response.content
        except Exception:
            return "I hear you and I'm here to support you. What's been on your mind lately?"

agent_pipeline = AgentPipeline()

# ===================== FASTAPI APP =====================
app = FastAPI(title="Mental Health AI - Integrated System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================== ENDPOINTS: AUTH =====================

@app.post("/users/")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    FIX: accepts `username` (not just email), stores `full_name`,
    handles emergency contact fields sent flat (not nested).
    """
    # Duplicate username check
    if db.query(DBUser).filter(DBUser.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already taken.")
    # Duplicate email check (only when provided)
    if user.email and db.query(DBUser).filter(DBUser.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")

    db_user = DBUser(
        username     = user.username,
        email        = user.email or None,
        full_name    = user.full_name or None,   # FIX
        password_hash= hash_password(user.password),
        phone        = user.phone or None,
        is_admin     = False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Always create a blank DB profile row
    db.add(DBUserProfile(user_id=db_user.id, preferences={}, mental_health_history={}))
    db.commit()

    # Save emergency contact if any details were provided
    if user.emergency_contact_name:
        ec = DBCrisisContact(
            user_id                       = db_user.id,
            emergency_contact_name        = user.emergency_contact_name,
            emergency_contact_phone       = user.emergency_contact_phone or "",
            emergency_contact_email       = user.emergency_contact_email or "",
            emergency_contact_relationship= user.emergency_contact_relationship or "",
            preferred_escalation          = "email",
            consent_given                 = True,
        )
        db.add(ec)
        db.commit()

    return {
        "id"       : db_user.id,
        "username" : db_user.username,
        "email"    : db_user.email,
        "full_name": db_user.full_name,
        "is_admin" : db_user.is_admin,
        "message"  : "Account created successfully.",
    }


@app.post("/login/")
def login(creds: UserLogin, db: Session = Depends(get_db)):
    """
    FIX: authenticate by `username` (not email) — matches the frontend login form.
    Returns `full_name` and `is_admin` so the UI can greet the user and show/hide admin nav.
    """
    user = db.query(DBUser).filter(DBUser.username == creds.username).first()
    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    return {
        "id"       : user.id,
        "username" : user.username,
        "email"    : user.email,
        "full_name": user.full_name,
        "is_admin" : user.is_admin,
        "message"  : "Login successful.",
    }

# ===================== ENDPOINTS: PROFILE =====================

@app.get("/profile/{user_id}")
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile      = db.query(DBUserProfile).filter(DBUserProfile.user_id == user_id).first()
    ec           = db.query(DBCrisisContact).filter(DBCrisisContact.user_id == user_id).first()
    # Merge with the file-based profile for goals/triggers/coping_strategies
    file_profile = load_user_profile(f"db_user_{user_id}")
    return {
        "user_id"          : user_id,
        "username"         : user.username,
        "email"            : user.email,
        "full_name"        : user.full_name,
        "phone"            : user.phone,
        "is_admin"         : user.is_admin,
        # FIX: fields the Profile view looks for
        "goals"            : file_profile.mental_health_goals,
        "coping_strategies": file_profile.coping_strategies,
        "triggers"         : file_profile.triggers,
        "emotional_state"  : file_profile.emotional_state.value if file_profile.emotional_state else None,
        "profile"          : {
            "preferences"          : profile.preferences           if profile else {},
            "mental_health_history": profile.mental_health_history if profile else {},
        },
        "emergency_contact": {
            "emergency_contact_name"        : ec.emergency_contact_name,
            "emergency_contact_email"       : ec.emergency_contact_email,
            "emergency_contact_phone"       : ec.emergency_contact_phone,
            "emergency_contact_relationship": ec.emergency_contact_relationship,
            "preferred_escalation"          : ec.preferred_escalation,
            "consent_given"                 : ec.consent_given,
        } if ec else None,
    }

@app.put("/profile/{user_id}")
def update_user_profile(user_id: int, data: dict, db: Session = Depends(get_db)):
    profile = db.query(DBUserProfile).filter(DBUserProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if "emergency_contact" in data:
        cd = data["emergency_contact"]
        ec = db.query(DBCrisisContact).filter(DBCrisisContact.user_id == user_id).first()
        if ec:
            for k, v in cd.items():
                setattr(ec, k, v)
        else:
            ec = DBCrisisContact(user_id=user_id, **cd)
            db.add(ec)
        db.commit()
    return {"message": "Profile updated"}

# ===================== ENDPOINTS: MOOD =====================

@app.post("/mood/")
def log_mood(mood: MoodEntryCreate, db: Session = Depends(get_db)):
    """FIX: frontend sends `score` not `mood_score`"""
    entry = DBMoodEntry(user_id=mood.user_id, score=mood.score, notes=mood.notes)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    # Return the shape the frontend expects
    return {"id": entry.id, "score": entry.score, "notes": entry.notes, "timestamp": entry.timestamp}

@app.get("/mood/{user_id}")
def get_mood_history(user_id: int, limit: int = 30, db: Session = Depends(get_db)):
    entries = (
        db.query(DBMoodEntry)
          .filter(DBMoodEntry.user_id == user_id)
          .order_by(DBMoodEntry.timestamp.desc())
          .limit(limit)
          .all()
    )
    return [{"id": e.id, "score": e.score, "notes": e.notes, "timestamp": e.timestamp} for e in entries]

# ===================== ENDPOINTS: CHAT =====================

@app.post("/chat/")
async def chat_db(request: MessageRequest, db: Session = Depends(get_db)):
    """Chat endpoint for authenticated (integer user_id) users."""
    recent_mood  = (db.query(DBMoodEntry)
                     .filter(DBMoodEntry.user_id == request.user_id)
                     .order_by(DBMoodEntry.timestamp.desc())
                     .first())
    mood_context = {"mood_score": recent_mood.score if recent_mood else None}

    str_user_id  = f"db_user_{request.user_id}"
    result       = await agent_pipeline.process(str_user_id, str(uuid.uuid4()), request.message, request.language)

    crisis_result        = analyze_harm_intent(request.message, llm if HAS_GROQ else None)
    crisis_detected      = False
    escalation_triggered = False

    if crisis_result["risk_level"].lower() in ["high","critical"]:
        crisis_detected = True
        ce = DBCrisisEvent(
            user_id=request.user_id, message_content=request.message,
            risk_level=crisis_result["risk_level"], detected_keywords=crisis_result["harm_indicators"]
        )
        db.add(ce)
        db.commit()
        ec   = db.query(DBCrisisContact).filter(DBCrisisContact.user_id == request.user_id).first()
        user = db.query(DBUser).filter(DBUser.id == request.user_id).first()
        if ec and ec.emergency_contact_email and user:
            escalation_triggered = send_emergency_email(
                ec.emergency_contact_email, ec.emergency_contact_name,
                user.full_name or user.username, crisis_result["risk_level"],
                crisis_result["harm_indicators"], request.message,
                user.email or "", user.phone or ""
            )

    conv = DBConversation(
        user_id=request.user_id, message=request.message,
        response=result["response"], language=request.language,
        context={"mood_context": mood_context}
    )
    db.add(conv)
    db.commit()

    # FIX: shape the crisis object so the frontend can read data.crisis.risk_level
    response_data = {
        "response"             : result["response"],
        "understanding_complete": True,
        "rag_used"             : result["used_rag"],
        "tools_used"           : [a["action"] for a in result["agent_actions"]],
        "crisis"               : None,
    }
    if crisis_detected:
        response_data["crisis"] = {
            "risk_level"         : crisis_result["risk_level"],
            "harm_indicators"    : crisis_result["harm_indicators"],
            "crisis_confidence"  : crisis_result["confidence"],
            "escalation_triggered": escalation_triggered,
            "crisis_response"    : get_crisis_response(crisis_result["risk_level"]),
        }
    return response_data

# ===================== ENDPOINTS: HISTORY =====================

@app.get("/history/{user_id}")
def get_history(user_id: int, db: Session = Depends(get_db)):
    return (
        db.query(DBConversation)
          .filter(DBConversation.user_id == user_id)
          .order_by(DBConversation.timestamp.desc())
          .limit(50)
          .all()
    )

# ===================== ENDPOINTS: AGENTIC CHAT (string user_id) =====================

@app.post("/api/chat", response_model=ChatResponse)
async def agentic_chat(request: ChatRequest):
    """Agentic RAG chat for anonymous/string user IDs."""
    conv_id       = request.conversation_id or str(uuid.uuid4())
    result        = await agent_pipeline.process(request.user_id, conv_id, request.message, request.language)
    crisis_result = analyze_harm_intent(request.message, llm if HAS_GROQ else None)
    crisis_detected = crisis_result["risk_level"].lower() in ["high","critical"]

    return ChatResponse(
        response            =result["response"],
        conversation_id     =conv_id,
        used_rag            =result["used_rag"],
        rag_sources         =result["rag_sources"],
        agent_actions       =result["agent_actions"],
        new_tasks           =result["new_tasks"],
        updated_profile     =result["updated_profile"],
        pipeline_logs       =result["pipeline_logs"],
        agent_state         =result["agent_state"],
        checkpoint_id       =result["checkpoint_id"],
        crisis_detected     =crisis_detected,
        risk_level          =crisis_result["risk_level"] if crisis_detected else None,
        harm_indicators     =crisis_result["harm_indicators"],
        escalation_triggered=False
    )

# ===================== ENDPOINTS: TASKS =====================

@app.get("/api/tasks/{user_id}")
async def get_tasks(user_id: str, status: Optional[TaskStatus] = None):
    tasks = load_user_tasks(user_id)
    if status:
        tasks = [t for t in tasks if t.status == status]
    # Ensure title is always set (frontend reads task.title)
    for t in tasks:
        if not t.title:
            t.title = t.task
    return {"tasks": [t.model_dump() for t in tasks], "user_id": user_id, "count": len(tasks)}

@app.post("/api/tasks/{user_id}/create")
async def create_task(user_id: str, task: WellnessTask):
    task.user_id = user_id
    if not task.title:
        task.title = task.task
    if save_user_task(task):
        return {"success": True, "message": "Task created", "task": task.model_dump()}
    raise HTTPException(status_code=500, detail="Failed to create task")

@app.put("/api/tasks/{user_id}/{task_id}")
async def update_task(user_id: str, task_id: str, updates: dict):
    tasks = load_user_tasks(user_id)
    for t in tasks:
        if t.id == task_id:
            if "status" in updates:
                t.status = TaskStatus(updates["status"])
            if "notes" in updates:
                t.notes = updates["notes"]
            t.updated_at = datetime.now()
            if t.status == TaskStatus.COMPLETED:
                t.completed_at = datetime.now()
            save_user_tasks(user_id, tasks)
            return {"success": True, "task": t.model_dump()}
    raise HTTPException(status_code=404, detail="Task not found")

# ===================== ENDPOINTS: CRISIS =====================

@app.post("/crisis-detect/")
def detect_crisis(request: CrisisDetectionRequest, db: Session = Depends(get_db)):
    result = analyze_harm_intent(request.message, llm if HAS_GROQ else None)
    ce     = DBCrisisEvent(
        user_id=request.user_id, message_content=request.message,
        risk_level=result["risk_level"], detected_keywords=result["harm_indicators"]
    )
    db.add(ce)
    db.commit()
    db.refresh(ce)
    escalation_triggered = False
    if result["risk_level"].lower() in ["critical","high"]:
        ec   = db.query(DBCrisisContact).filter(DBCrisisContact.user_id == request.user_id).first()
        user = db.query(DBUser).filter(DBUser.id == request.user_id).first()
        if ec and ec.emergency_contact_email and user:
            escalation_triggered = send_emergency_email(
                ec.emergency_contact_email, ec.emergency_contact_name,
                user.full_name or user.username, result["risk_level"],
                result["harm_indicators"], request.message, user.email or "", user.phone or ""
            )
    return {
        "risk_level"          : result["risk_level"],
        # FIX: both `indicators` (what the UI reads) and `harm_indicators` returned
        "indicators"          : result["harm_indicators"],
        "harm_indicators"     : result["harm_indicators"],
        "confidence"          : result["confidence"],
        "reason"              : result["reason"],
        "response"            : get_crisis_response(result["risk_level"]),
        "event_id"            : ce.id,
        "escalation_triggered": escalation_triggered,
        "escalation_message"  : "Emergency contact notified!" if escalation_triggered else "Below escalation threshold"
    }

@app.post("/crisis-contact/")
def set_crisis_contact(contact: CrisisContactCreate, db: Session = Depends(get_db)):
    existing = db.query(DBCrisisContact).filter(DBCrisisContact.user_id == contact.user_id).first()
    if existing:
        for k, v in contact.model_dump().items():
            setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing
    c = DBCrisisContact(**contact.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@app.get("/crisis-events/{user_id}")
def get_crisis_events(user_id: int, limit: int = 10, db: Session = Depends(get_db)):
    return (
        db.query(DBCrisisEvent)
          .filter(DBCrisisEvent.user_id == user_id)
          .order_by(DBCrisisEvent.timestamp.desc())
          .limit(limit)
          .all()
    )

# ===================== ENDPOINTS: RISK SCORING =====================

@app.get("/api/risk/{user_id}")
def get_risk_score(user_id: int, db: Session = Depends(get_db)):
    moods       = db.query(DBMoodEntry).filter(DBMoodEntry.user_id == user_id).order_by(DBMoodEntry.timestamp.asc()).all()
    mood_scores = [m.score for m in moods]
    user        = db.query(DBUser).filter(DBUser.id == user_id).first()
    days_active = (datetime.utcnow() - user.created_at).days if user else 7
    return risk_predictor.predict_risk(mood_scores, days_active)

# ===================== ENDPOINTS: ADMIN =====================

@app.post("/api/admin/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    global vectorstore, retriever, rag_stats
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV")
    contents = await file.read()
    df       = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    if 'Question' in df.columns and 'Answer' in df.columns:
        df = df.rename(columns={'Question': 'question', 'Answer': 'answer'})
    elif 'question' not in df.columns or 'answer' not in df.columns:
        if len(df.columns) >= 2:
            df.columns = ['question', 'answer'] + list(df.columns[2:])
        else:
            raise HTTPException(status_code=400, detail="CSV must have 'question' and 'answer' columns")
    docs = [
        Document(
            page_content=f"Question: {str(row['question']).strip()}\nAnswer: {str(row['answer']).strip()}",
            metadata={"source": file.filename, "type": "qa_pair"}
        )
        for _, row in df.iterrows()
        if pd.notna(row['question']) and pd.notna(row['answer'])
    ]
    if not docs:
        raise HTTPException(status_code=400, detail="No valid Q&A pairs found")
    embeddings = initialize_embeddings()
    if not embeddings:
        raise HTTPException(status_code=500, detail="Failed to initialize embeddings")
    if vectorstore is None:
        vectorstore = Chroma.from_documents(documents=docs, embedding=embeddings, persist_directory=CHROMA_PERSIST_DIR, collection_name="mental_health_kb")
    else:
        vectorstore.add_documents(docs)
    retriever                    = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 5})
    rag_stats["total_documents"] += len(docs)
    rag_stats["csv_uploads"]     += 1
    rag_stats["last_upload"]      = datetime.now().isoformat()
    return {"success": True, "message": f"Uploaded {len(docs)} Q&A pairs", "count": len(docs)}

@app.get("/api/admin/rag-stats")
async def get_rag_stats():
    return {**rag_stats, "vectorstore_initialized": vectorstore is not None}

@app.delete("/api/admin/clear-knowledge")
async def clear_knowledge():
    global vectorstore, retriever
    if os.path.exists(CHROMA_PERSIST_DIR):
        shutil.rmtree(CHROMA_PERSIST_DIR)
    vectorstore, retriever = initialize_vectorstore()
    return {"success": True, "message": "Knowledge base cleared and reinitialized"}

# ===================== ENDPOINTS: HEALTH =====================

@app.get("/")
def root():
    return {
        "message"          : "Mental Health AI - Integrated System",
        "status"           : "online",
        "rag_initialized"  : vectorstore is not None,
        "langgraph_enabled": HAS_LANGGRAPH,
    }

@app.get("/api/health")
def health():
    return {
        "status"                : "healthy" if vectorstore is not None else "degraded",
        "rag_stats"             : rag_stats,
        "langgraph"             : HAS_LANGGRAPH,
        "checkpointing"         : HAS_CHECKPOINTING,
        "timestamp"             : datetime.now().isoformat(),
        "vectorstore_initialized": vectorstore is not None,
    }

# ===================== STARTUP =====================

@app.on_event("startup")
async def startup():
    global vectorstore, retriever
    logger.info("Starting Integrated Mental Health AI System...")
    vectorstore, retriever = initialize_vectorstore()
    if vectorstore:
        logger.info(f"Vectorstore ready with {rag_stats['total_documents']} docs")
    else:
        logger.error("Vectorstore initialization failed")
    logger.info("Startup complete.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")