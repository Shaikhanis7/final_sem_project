# MindfulAI — Full-Stack Mental Wellness Platform

<div align="center">

![MindfulAI](https://img.shields.io/badge/MindfulAI-React%2018-61dafb?style=for-the-badge&logo=react)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Vite](https://img.shields.io/badge/Vite-Build%20Tool-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic%20AI-orange?style=for-the-badge)](https://www.langchain.com/langgraph)
[![Groq](https://img.shields.io/badge/Groq-LLM-red?style=for-the-badge)](https://groq.com)

**A compassionate AI-powered mental wellness companion with multilingual support, emotion detection, voice I/O, crisis detection, and an agentic RAG chat interface.**

</div>

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
  - [Frontend](#frontend-tech-stack)
  - [Backend](#backend-tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Backend — Deep Dive](#backend--deep-dive)
  - [Core Components](#core-components)
  - [Database Models](#database-models)
  - [API Endpoints](#api-endpoints)
  - [Agentic RAG Pipeline](#agentic-rag-pipeline)
  - [Crisis Detection System](#crisis-detection-system)
  - [Multilingual Pipeline](#multilingual-pipeline)
  - [Emotion Detection](#emotion-detection)
  - [Email Alerting](#email-alerting)
- [Frontend — Deep Dive](#frontend--deep-dive)
  - [Component Architecture](#component-architecture)
  - [Voice System](#voice-system)
  - [Views](#views)
- [Getting Started](#getting-started)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [Supported Languages](#supported-languages)
- [Crisis Resources](#crisis-resources-built-into-app)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                   │
│  Chat · Mood · Tasks · Crisis · Profile · RAG · Admin        │
│  Voice I/O · 12-Language Support · Emotion Detection UI      │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP / REST (fetch API)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                       │
│                                                             │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │ Auth + Users │  │  Agentic RAG    │  │ Crisis Detect │  │
│  │  (SQLite)    │  │ (LangGraph+Groq)│  │ + Email Alert │  │
│  └──────────────┘  └────────┬────────┘  └───────────────┘  │
│                             │                               │
│  ┌──────────────┐  ┌────────▼────────┐  ┌───────────────┐  │
│  │  IndicTrans2 │  │   ChromaDB      │  │   DeepFace    │  │
│  │ (Translation)│  │  (VectorStore)  │  │(Emotion Detect│  │
│  └──────────────┘  └─────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | React 18 + Vite | UI rendering and build tooling |
| Icons | Lucide React | UI icon set |
| Animations | Framer Motion | Smooth UI transitions |
| Styling | Custom CSS (`App.css`) | Dark/light theming via `data-theme` |
| Voice Input | Web Speech API (STT) | Browser-native speech-to-text |
| Voice Output | Web Speech API (TTS) | Browser-native text-to-speech |
| Camera | MediaDevices API | Webcam capture for emotion analysis |
| Routing | Single-page view state | No router library needed |
| HTTP | Native `fetch` API | REST calls to FastAPI backend |
| Geolocation | Navigator Geolocation API | User location for crisis alerts |
| Reverse Geocoding | Nominatim (OpenStreetMap) | Location name from coordinates |

### Backend Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Web Framework | **FastAPI** | REST API, async support, auto-docs |
| ASGI Server | **Uvicorn** | High-performance async server |
| LLM | **Groq (llama-3.1-8b-instant)** | Core language model for AI responses |
| Agent Framework | **LangGraph** | Stateful agentic workflow orchestration |
| Agent Tools | **LangChain Tools** | `search_knowledge_base`, `analyze_emotional_state`, `suggest_coping_strategies` |
| Embeddings | **HuggingFace** `sentence-transformers/all-MiniLM-L6-v2` | Semantic search embeddings |
| Vector Store | **ChromaDB** | Persistent RAG knowledge base |
| Translation | **IndicTrans2** (`ai4bharat`) | EN↔Indic bidirectional translation |
| Emotion Detection | **DeepFace** | Facial emotion analysis from images |
| ORM | **SQLAlchemy** | Database models and queries |
| Database | **SQLite** (default) / configurable | User data, moods, crisis events |
| Validation | **Pydantic v2** | Request/response model validation |
| Password Hashing | **bcrypt** (fallback: PBKDF2) | Secure password storage |
| Email | **smtplib + MIME** | Crisis alert HTML emails |
| Data Processing | **Pandas** | CSV parsing for admin knowledge upload |
| Numerical | **NumPy** | Risk scoring, emotion confidence calculations |
| Image Processing | **OpenCV + Pillow** | Image preprocessing for DeepFace |
| Deep Learning | **PyTorch + HuggingFace Transformers** | IndicTrans2 model inference |
| Environment | **python-dotenv** | `.env` config loading |
| CORS | FastAPI CORSMiddleware | Cross-origin requests from frontend |

---

## Features

### 💬 Agentic RAG Chat
- Conversational AI powered by LangGraph + Groq LLM
- Real-time typing indicators and message streaming
- Tool-use badges show when the AI used knowledge retrieval or emotional analysis tools
- Shift+Enter for new lines, Enter to send

### 🌐 12-Language Support (IndicTrans2)
- English + 11 Indian languages: Hindi, Tamil, Telugu, Bengali, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia, Assamese
- Per-language placeholders in native script
- Responses automatically translated back to selected language
- Original English response shown inline for reference

### 🎙️ Voice I/O
- **Speech-to-Text** — Browser Web Speech API, attempts native language first, falls back to English
- **Text-to-Speech** — Auto-reads AI responses using best available OS voice
- Live visual indicators for listening/speaking states
- STT error toasts with human-readable explanations
- Per-language TTS capability detection (shows badge if no voice installed)

### 📸 Emotion Detection (DeepFace)
- Upload or capture image via webcam
- Detects 7 emotions: happy, sad, angry, fear, neutral, disgust, surprise
- Shows confidence %, dominant emotion, and stress level
- Attach image to chat message — AI adapts response to detected emotion
- Emotion bars visualization panel

### 🚨 Crisis Detection & Safety
- Every message analyzed for harm intent (keyword + LLM scoring)
- Risk levels: `low` → `medium` → `high` → `critical`
- Crisis banner with direct links to 988 Lifeline and Crisis Text Line
- Emergency contact auto-notified by HTML email (with Google Maps location link) on high/critical risk

### 📊 Mood Tracking
- Slider-based mood logging (1–10 scale with emoji labels)
- Optional notes per entry
- Mood history list with timestamps
- Sidebar mini-tracker for quick access

### ✅ Wellness Tasks
- AI generates personalized tasks based on conversation context
- Task categories: Exercise, Mindfulness, Social, Sleep, Nutrition, Therapeutic
- Status workflow: `not_started` → `in_progress` → `completed` / `skipped`

### 🛡️ Emergency Contact
- Added during sign-up or from Crisis Detection view
- Notified automatically with a rich HTML email including a Google Maps location link
- Relationship, phone, and email stored per user

### 🔑 Admin Portal
- CSV upload for knowledge base expansion (`question, answer` format)
- RAG stats dashboard (document count, collection count, query volume)
- One-click knowledge base clear with confirmation guard
- Sample CSV download

---

## Project Structure

```
project-root/
├── backend/
│   └── main.py               # Entire FastAPI application (single-file)
│       ├── EmotionDetector        — DeepFace wrapper with base64 + file upload support
│       ├── AgentPipeline          — LangGraph agent with tool calling
│       ├── RiskPredictor          — Mood-history-based risk scoring
│       ├── RAGPipelineLogger      — Step-by-step pipeline logging
│       ├── translate_*            — IndicTrans2 EN↔Indic helpers
│       ├── analyze_harm_intent    — Keyword + LLM crisis detection
│       ├── send_emergency_email   — Rich HTML crisis alert mailer
│       ├── DB Models              — User, MoodEntry, Conversation, CrisisEvent, CrisisContact, UserProfile
│       └── FastAPI Endpoints      — Auth, Chat, Mood, Tasks, Crisis, Admin, Health
│
├── frontend/
│   └── src/
│       ├── App.jsx           # Entire application (single-file architecture)
│       │   ├── useVoice          — STT / TTS hook with language-aware fallback
│       │   ├── LanguageDropdown  — 12-language picker with TTS/STT badges
│       │   ├── ImageEmotionPanel — Upload/camera emotion detection panel
│       │   ├── EmotionBadge      — Compact emotion display chip
│       │   ├── TaskCard          — Wellness task item with status controls
│       │   ├── VoiceSidebarSection — Voice status + TTS toggle in sidebar
│       │   ├── AuthScreen        — Login + Sign Up with emergency contact form
│       │   └── App (main)        — Sidebar + Chat/Mood/Tasks/Crisis/Profile/RAG/Admin views
│       ├── App.css           # All styles (dark/light theme via data-theme)
│       └── main.jsx          # React entry point
│
├── chroma_db/                # Persistent ChromaDB vector store
├── user_profiles/            # JSON files per user (goals, coping strategies)
├── user_tasks/               # JSON files per user (wellness tasks)
├── mental_health.db          # SQLite database
├── agentic_workflow.log      # Backend log file
└── .env                      # Environment secrets (not committed)
```

---

## Backend — Deep Dive

### Core Components

#### 1. FastAPI Application (`main.py`)
The entire backend lives in a single `main.py` file. It uses FastAPI's async capabilities, SQLAlchemy ORM, and a startup event to initialize the vector store.

#### 2. Password Security
Uses **bcrypt** (rounds=12) when available, with PBKDF2-HMAC-SHA256 as a fallback. Passwords are never stored in plaintext.

#### 3. Numpy Serialization
A custom `NumpyJSONEncoder` and `convert_numpy()` utility recursively converts all NumPy types (`np.integer`, `np.floating`, `np.ndarray`, `np.bool_`) to native Python before JSON serialization — preventing `TypeError` crashes in API responses.

---

### Database Models

All models use **SQLAlchemy** with a SQLite backend by default (configurable via `DATABASE_URL` env var).

| Model | Table | Key Fields |
|---|---|---|
| `DBUser` | `users` | `username`, `email`, `password_hash`, `phone`, `is_admin` |
| `DBMoodEntry` | `mood_entries` | `user_id`, `score` (float), `notes`, `timestamp` |
| `DBConversation` | `conversations` | `user_id`, `message`, `response`, `language`, `context` (JSON) |
| `DBCrisisEvent` | `crisis_events` | `user_id`, `message_content`, `risk_level`, `detected_keywords` (JSON), `escalated` |
| `DBCrisisContact` | `crisis_contacts` | `user_id`, `emergency_contact_name/phone/email/relationship`, `consent_given` |
| `DBUserProfile` | `user_profiles_db` | `user_id`, `preferences` (JSON), `mental_health_history` (JSON) |

Additionally, user profiles and tasks are stored as **flat JSON files** in `user_profiles/` and `user_tasks/` for fast file-based access without DB overhead.

---

### API Endpoints

#### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/users/` | Register new user (with optional emergency contact) |
| `POST` | `/login/` | Authenticate and return user object |

#### Profile & Mood
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/profile/{user_id}` | Load full profile including emergency contact |
| `PUT` | `/profile/{user_id}` | Update phone, emergency contact |
| `POST` | `/mood/` | Log a mood entry (1–10 score + optional notes) |
| `GET` | `/mood/{user_id}` | Fetch mood history (default: last 30 entries) |

#### Chat
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat/` | Full pipeline: translate → agent → crisis check → translate back |
| `POST` | `/api/chat` | Agentic chat endpoint (string user_id, returns `ChatResponse` model) |

#### Wellness Tasks
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks/{user_id}` | Fetch tasks (optional `?status=` filter) |
| `POST` | `/api/tasks/{user_id}/create` | Create a new task |
| `PUT` | `/api/tasks/{user_id}/{task_id}` | Update task status or notes |

#### Crisis & Safety
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/crisis-detect/` | Analyze message risk and optionally alert emergency contact |
| `POST` | `/crisis-contact/` | Save or update emergency contact |
| `GET` | `/crisis-events/{user_id}` | Fetch crisis event history |
| `GET` | `/api/risk/{user_id}` | Get mood-based predictive risk score |

#### Emotion Detection
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/analyze-emotion/` | Analyze base64 image, return emotion breakdown |
| `POST` | `/upload-image/` | Analyze uploaded image file (multipart) |

#### Admin
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/upload-csv` | Parse CSV and add Q&A pairs to ChromaDB |
| `GET` | `/api/admin/rag-stats` | Return document/collection counts |
| `DELETE` | `/api/admin/clear-knowledge` | Wipe and reinitialize ChromaDB |

#### Utilities
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/languages/` | Return supported language config + `HAS_TRANSLATION` flag |
| `GET` | `/` | Root health check with feature flags |
| `GET` | `/api/health` | Detailed health: RAG, LangGraph, translation, emotion status |
| `GET` | `/history/{user_id}` | Fetch last 50 conversation records |

---

### Agentic RAG Pipeline

The `AgentPipeline` class orchestrates a multi-step process on every chat message:

```
User Message
     │
     ▼
[1] Emotional State Analysis
     │  analyze_emotional_state tool → primary_emotion
     ▼
[2] RAG Keyword Check
     │  If query matches mental-health keywords → ChromaDB similarity search
     │  Retriever: top-5 docs via sentence-transformers embeddings
     ▼
[3] Context Fusion
     │  User profile + active tasks + RAG docs + emotion context
     ▼
[4] LangGraph Agent Execution
     │  create_tool_calling_agent (Groq llama-3.1-8b-instant)
     │  AgentExecutor with tools: search_knowledge_base,
     │  analyze_emotional_state, suggest_coping_strategies
     ▼
[5] Task Generation (conditional)
     │  If "task/remind/exercise…" keyword → generate WellnessTask
     │  Save to user_tasks/ JSON file
     ▼
[6] Profile Update (conditional)
     │  Extract name from "my name is X" pattern → save to user_profiles/
     ▼
[7] Response
     └── response + used_rag + agent_actions + new_tasks + pipeline_logs
```

**ChromaDB Initialization:** On startup, if no persisted DB exists, 8 default mental-health Q&A documents are embedded and stored. Admin CSV uploads extend this at runtime.

**Agent Tools:**

| Tool | Function |
|---|---|
| `search_knowledge_base` | Queries ChromaDB retriever, returns top-3 doc excerpts |
| `analyze_emotional_state` | Keyword-based emotion classifier, returns JSON with primary emotion + confidence |
| `suggest_coping_strategies` | Returns evidence-based coping strategies mapped to detected emotion |

---

### Crisis Detection System

Every message goes through `analyze_harm_intent()`:

**Step 1 — LLM Analysis (if Groq available):**
Sends a structured prompt to the LLM requesting JSON output with `risk_level`, `confidence`, `has_harm_intent`, `indicators`, and `reason`.

**Step 2 — Keyword Fallback:**
If LLM fails, scans against a curated keyword dictionary:

| Risk Level | Example Keywords |
|---|---|
| `critical` | "kill myself", "end my life", "hang myself", "overdose" |
| `high` | "self harm", "cutting", "worthless", "better off dead" |
| `medium` | "depressed", "anxious", "panic", "can't cope" |
| `low` | No matches |

**Escalation Logic:**
- Risk `high` or `critical` → log `DBCrisisEvent` → look up `DBCrisisContact` → send HTML email alert
- Email includes: risk badge, detected keywords, user's message, timestamp, Google Maps link (if location available), immediate action checklist, emergency resource links

---

### Multilingual Pipeline

Uses **IndicTrans2** models from `ai4bharat`:

| Model | Direction | HuggingFace ID |
|---|---|---|
| EN → Indic | English to 11 Indian languages | `ai4bharat/indictrans2-en-indic-dist-200M` |
| Indic → EN | 11 Indian languages to English | `ai4bharat/indictrans2-indic-en-dist-200M` |

**Flow for non-English messages:**
```
User message (Hindi) → translate_indic_to_english()
                     → Agent pipeline (English)
                     → translate_to_indic() → Response (Hindi)
```

Models load lazily on first translation request (`initialize_translation_models()`). Uses `torch.float16` on CUDA, `float32` on CPU. Beam search (5 beams) for high-quality output.

---

### Emotion Detection

`EmotionDetector` class wraps **DeepFace** with a multi-backend fallback chain:

**Detection backends tried in order:** `mtcnn` → `opencv` → `ssd` → `retinaface`

**Processing pipeline:**
1. Decode base64 / read uploaded bytes → PIL Image
2. Convert to OpenCV BGR format
3. Apply CLAHE contrast enhancement (LAB color space)
4. Run DeepFace analysis (`emotion` action only)
5. Normalize confidence scores from 0–100% to 0.0–1.0 fractions
6. Compute `stress_level` from angry + fear + sad + disgust weighted sum
7. Compute `engagement_score` from happy + surprise minus sadness/anger dampening
8. Generate JPEG thumbnail preview (base64, max 200px)

**Detected emotions:** happy, sad, angry, fear, neutral, disgust, surprise

**Fallback:** If all backends fail, returns `neutral` with 100% confidence.

---

### Email Alerting

`send_emergency_email()` generates a fully self-contained HTML email:

**Email sections:**
- **Banner** — color-coded by risk level (red = critical, orange = high)
- **Person in Crisis** — name, email, phone
- **Location Block** (if coordinates provided) — Google Maps link + Get Directions button
- **Crisis Details** — risk badge, detected keywords, verbatim message, timestamp
- **Immediate Actions** — numbered 6-step checklist (call, stay with them, etc.)
- **Emergency Resources** — 988 Lifeline, Crisis Text Line, NAMI, IASP

Email is sent via SMTP with `X-Priority: 1` and `Importance: High` headers for inbox prioritization.

---

## Frontend — Deep Dive

### Component Architecture

All components live in `src/App.jsx` (single-file architecture for portability).

| Component | Description |
|---|---|
| `AuthScreen` | Login + signup with emergency contact form, animated orb background |
| `useVoice` | Custom hook for STT (Web Speech API) + TTS with language-aware fallback chain |
| `LanguageDropdown` | 12-language picker showing TTS/STT capability badges per language |
| `ImageEmotionPanel` | Modal with upload/webcam tabs, emotion analysis, and "attach to message" |
| `EmotionBadge` | Compact emotion chip showing emoji, dominant emotion, confidence, stress level |
| `TaskCard` | Wellness task item with start/complete/skip controls and category color coding |
| `VoiceSidebarSection` | Voice status dot, TTS capability info, auto-read toggle |
| `App` (main) | Sidebar + view router for all 7 views |

### Voice System

The `useVoice` hook implements a sophisticated fallback chain:

**STT (Speech-to-Text):**
```
Try: primary lang code (e.g. "hi-IN")
  → If language-not-supported: try speechAlts (e.g. "hi")
  → If still fails: fall back to "en-US"
  → Show human-readable error toast for 4 seconds
```

**TTS (Text-to-Speech):**
```
On mount: load speechSynthesis.getVoices()
  → Retry at 500ms + 1500ms (Chrome loads voices async)
  → Build ttsSupportedLangs Set from exact + prefix voice matching
  → findBestVoice(): exact match → prefix match → null
  → Show "No voice installed" badge if null
```

**Key design decisions:**
- `locationRef` (not state) ensures latest coordinates are always used in crisis API calls even across re-renders
- TTS is auto-disabled (UI shows OFF) when no voice is installed for the current language
- Voice button cycles: idle → listening → speaking → idle

### Views

| View | State Key | Description |
|---|---|---|
| Chat | `chat` | Main AI conversation with emotion attachment, voice, crisis banner |
| Mood History | `mood` | Log and review mood entries with stats |
| Wellness Tasks | `tasks` | AI-generated activity tracker with status workflow |
| Crisis Detection | `crisis` | Manual risk test + emergency contact setup |
| My Profile | `profile` | Account info, language prefs, voice capability summary |
| RAG Pipeline | `rag` | 7-step visual explanation of the AI pipeline |
| Admin Portal | `admin` | Knowledge CSV upload + system stats (admin only) |

---

## Getting Started

### Backend Setup

```bash
# 1. Create a virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install fastapi uvicorn sqlalchemy pydantic python-dotenv \
            langchain langchain-groq langchain-community langchain-huggingface \
            langgraph chromadb sentence-transformers pandas numpy \
            bcrypt pillow opencv-python deepface \
            torch transformers IndicTransToolkit \
            smtplib  # stdlib, no install needed

# 3. Copy and fill in your .env file
cp .env.example .env

# 4. Start the backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# → http://localhost:8000
# → Docs: http://localhost:8000/docs
```

> **Optional:** If IndicTrans2 or DeepFace are not installed, the app degrades gracefully — multilingual and emotion features are disabled, but core chat and crisis detection still work.

### Frontend Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
# → http://localhost:5173

# 3. Build for production
npm run build
```

> Make sure the FastAPI backend is running on `http://localhost:8000` before starting the frontend. The API base URL is set at the top of `App.jsx`:
> ```js
> const API = 'http://localhost:8000';
> ```

---

## Environment Variables

Create a `.env` file in the backend directory:

```env
# ── LLM ───────────────────────────────────────────
GROQ_API_KEY=your_groq_api_key_here

# ── Database ───────────────────────────────────────
# Default: SQLite (no config needed)
DATABASE_URL=sqlite:///./mental_health.db
# For PostgreSQL:
# DATABASE_URL=postgresql://user:password@localhost/mindfulai

# ── Email (Crisis Alerts) ──────────────────────────
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your_alert_email@gmail.com
SENDER_PASSWORD=your_app_password_here
# Use a Gmail App Password, not your main Gmail password
```

---

## Supported Languages

| Code | Language | Native | Speech Code | TTS Support |
|---|---|---|---|---|
| `eng_Latn` | English | English | `en-US` | ✅ All browsers |
| `hin_Deva` | Hindi | हिन्दी | `hi-IN` | ✅ Chrome/Edge |
| `tam_Taml` | Tamil | தமிழ் | `ta-IN` | ✅ Chrome/Edge |
| `tel_Telu` | Telugu | తెలుగు | `te-IN` | ✅ Chrome/Edge |
| `ben_Beng` | Bengali | বাংলা | `bn-IN` | ⚠️ Varies |
| `kan_Knda` | Kannada | ಕನ್ನಡ | `kn-IN` | ⚠️ Varies |
| `mal_Mlym` | Malayalam | മലയാളം | `ml-IN` | ⚠️ Varies |
| `mar_Deva` | Marathi | मराठी | `mr-IN` | ⚠️ Varies |
| `guj_Gujr` | Gujarati | ગુજરાતી | `gu-IN` | ⚠️ Varies |
| `pan_Guru` | Punjabi | ਪੰਜਾਬੀ | `pa-IN` | ⚠️ Varies |
| `ory_Orya` | Odia | ଓଡ଼ିଆ | `or-IN` | ❌ Rare |
| `asm_Beng` | Assamese | অসমীয়া | `as-IN` | ❌ Rare |

**To enable Indic TTS voices:**
- **Windows:** Settings → Time & Language → Speech → Add voices
- **macOS:** System Settings → Accessibility → Spoken Content → System Voice
- **Chrome/Edge** have the broadest Indic voice coverage out of the box

---

## Crisis Resources (Built into App)

| Resource | Details |
|---|---|
| 988 Suicide & Crisis Lifeline | Call or text **988** (US) |
| Crisis Text Line | Text **HOME** to **741741** |
| NAMI Helpline | **1-800-950-6264** |
| Online Chat | [988lifeline.org/chat](https://988lifeline.org/chat) |
| International | [iasp.info/resources/Crisis_Centres](https://www.iasp.info/resources/Crisis_Centres/) |

---

## Key Design Decisions

**Single-file architecture (both frontend and backend)** — All components live in `App.jsx` and all backend logic lives in `main.py` for simplicity and portability. Split into separate modules as the project scales.

**Ref-based location** — `locationRef` stores geolocation separately from React state to ensure the latest coordinates are always sent in the crisis API call, even if the component re-renders between location resolution and message send.

**Voice fallback chain** — STT tries the primary language code, then `speechAlts`, then `en-US` to maximize success across browsers without silent failure.

**TTS capability detection** — `getSupportedTTSCodes` checks `speechSynthesis.getVoices()` at mount and on `voiceschanged` with two retry timers to handle slow-loading browsers (Chrome loads voices asynchronously).

**Numpy safety** — All DeepFace and NumPy outputs are run through `convert_numpy()` before being returned in JSON responses to prevent serialization errors from numpy scalar types.

**Graceful degradation** — IndicTrans2, DeepFace, LangGraph, and bcrypt are all optional. The app checks `HAS_TRANSLATION`, `HAS_EMOTION`, `HAS_LANGGRAPH`, `HAS_BCRYPT` flags at startup and adjusts behavior accordingly.

---

<div align="center">

Built with FastAPI · LangGraph · React · IndicTrans2 · DeepFace · ChromaDB · Groq

Part of the MindfulAI system — a compassionate AI for mental wellness

</div>
