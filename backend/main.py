"""
Integrated Mental Health AI Agent System
Combines: Agentic RAG + LangGraph + Crisis Detection + Risk Scoring + Auth + Mood Tracking
+ Multilingual Support (IndicTrans2) + Emotion Detection (DeepFace)
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
import base64
warnings.filterwarnings('ignore')

# ===================== NUMPY SERIALIZATION UTILS =====================
import json as _json

def convert_numpy(obj):
    """Recursively convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: convert_numpy(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [convert_numpy(i) for i in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj

class NumpyJSONEncoder(_json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):  return int(obj)
        if isinstance(obj, np.floating): return float(obj)
        if isinstance(obj, np.ndarray):  return obj.tolist()
        if isinstance(obj, np.bool_):    return bool(obj)
        return super().default(obj)

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

# ===================== MULTILINGUAL SUPPORT =====================
try:
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    from IndicTransToolkit import IndicProcessor
    HAS_TRANSLATION = True
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Translation support available. Device: {DEVICE}")
except ImportError:
    HAS_TRANSLATION = False
    DEVICE = "cpu"
    logger.warning("IndicTrans2 not available. Multilingual support disabled.")

# ===================== EMOTION DETECTION =====================
try:
    import cv2
    from PIL import Image
    from deepface import DeepFace
    HAS_EMOTION = True
    logger.info("Emotion detection (DeepFace) available.")
except ImportError:
    HAS_EMOTION = False
    logger.warning("DeepFace not available. Emotion detection disabled.")

# ===================== TRANSLATION GLOBALS =====================
translation_model_en_indic = None
translation_model_indic_en = None
translation_tokenizer_en_indic = None
translation_tokenizer_indic_en = None
indic_processor = None

SUPPORTED_LANGUAGES = {
    "eng_Latn": {"name": "English",    "native": "English",    "speech_code": "en-US"},
    "hin_Deva": {"name": "Hindi",      "native": "हिन्दी",       "speech_code": "hi-IN"},
    "ben_Beng": {"name": "Bengali",    "native": "বাংলা",        "speech_code": "bn-IN"},
    "tam_Taml": {"name": "Tamil",      "native": "தமிழ்",        "speech_code": "ta-IN"},
    "tel_Telu": {"name": "Telugu",     "native": "తెలుగు",       "speech_code": "te-IN"},
    "mar_Deva": {"name": "Marathi",    "native": "मराठी",        "speech_code": "mr-IN"},
    "guj_Gujr": {"name": "Gujarati",   "native": "ગુજરાતી",      "speech_code": "gu-IN"},
    "kan_Knda": {"name": "Kannada",    "native": "ಕನ್ನಡ",        "speech_code": "kn-IN"},
    "mal_Mlym": {"name": "Malayalam",  "native": "മലയാളം",       "speech_code": "ml-IN"},
    "pan_Guru": {"name": "Punjabi",    "native": "ਪੰਜਾਬੀ",       "speech_code": "pa-IN"},
    "ory_Orya": {"name": "Odia",       "native": "ଓଡ଼ିଆ",        "speech_code": "or-IN"},
    "asm_Beng": {"name": "Assamese",   "native": "অসমীয়া",      "speech_code": "as-IN"},
}

def initialize_translation_models():
    global translation_model_en_indic, translation_model_indic_en
    global translation_tokenizer_en_indic, translation_tokenizer_indic_en, indic_processor
    if not HAS_TRANSLATION:
        return
    if translation_model_en_indic is None:
        logger.info("Loading IndicTrans2 EN->Indic model...")
        mn = "ai4bharat/indictrans2-en-indic-dist-200M"
        translation_tokenizer_en_indic = AutoTokenizer.from_pretrained(mn, trust_remote_code=True)
        translation_model_en_indic = AutoModelForSeq2SeqLM.from_pretrained(
            mn, trust_remote_code=True,
            dtype=torch.float16 if DEVICE == "cuda" else torch.float32
        ).to(DEVICE)
    if translation_model_indic_en is None:
        logger.info("Loading IndicTrans2 Indic->EN model...")
        mn = "ai4bharat/indictrans2-indic-en-dist-200M"
        translation_tokenizer_indic_en = AutoTokenizer.from_pretrained(mn, trust_remote_code=True)
        translation_model_indic_en = AutoModelForSeq2SeqLM.from_pretrained(
            mn, trust_remote_code=True,
            dtype=torch.float16 if DEVICE == "cuda" else torch.float32
        ).to(DEVICE)
    if indic_processor is None:
        indic_processor = IndicProcessor(inference=True)

def translate_indic_to_english(text: str, source_lang: str) -> str:
    if source_lang == "eng_Latn" or not text.strip():
        return text
    if not HAS_TRANSLATION:
        return text
    try:
        initialize_translation_models()
        batch = indic_processor.preprocess_batch([text.strip()], src_lang=source_lang, tgt_lang="eng_Latn")
        inputs = translation_tokenizer_indic_en(batch, truncation=True, padding="longest",
            max_length=256, return_tensors="pt", return_attention_mask=True).to(DEVICE)
        with torch.no_grad():
            generated = translation_model_indic_en.generate(**inputs, use_cache=False,
                max_length=256, num_beams=5, num_return_sequences=1)
        decoded = translation_tokenizer_indic_en.batch_decode(generated, skip_special_tokens=True,
            clean_up_tokenization_spaces=True)
        result = indic_processor.postprocess_batch(decoded, lang="eng_Latn")
        return result[0] if result else text
    except Exception as e:
        logger.error(f"Indic->EN translation error: {e}")
        return text

def translate_to_indic(text: str, target_lang: str) -> str:
    if target_lang == "eng_Latn" or not text.strip():
        return text
    if not HAS_TRANSLATION:
        return text
    try:
        initialize_translation_models()
        batch = indic_processor.preprocess_batch([text.strip()], src_lang="eng_Latn", tgt_lang=target_lang)
        inputs = translation_tokenizer_en_indic(batch, truncation=True, padding="longest",
            max_length=256, return_tensors="pt", return_attention_mask=True).to(DEVICE)
        with torch.no_grad():
            generated = translation_model_en_indic.generate(**inputs, use_cache=False,
                max_length=256, num_beams=5, num_return_sequences=1)
        decoded = translation_tokenizer_en_indic.batch_decode(generated, skip_special_tokens=True,
            clean_up_tokenization_spaces=True)
        result = indic_processor.postprocess_batch(decoded, lang=target_lang)
        return result[0] if result else text
    except Exception as e:
        logger.error(f"EN->Indic translation error: {e}")
        return text

# ===================== EMOTION DETECTION =====================
class EmotionDetector:
    def analyze_from_base64(self, image_data: str) -> dict:
        if not HAS_EMOTION:
            return self._neutral()
        try:
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            frame = self._enhance(frame)
            return self._analyze(frame)
        except Exception as e:
            logger.error(f"Emotion analysis error: {e}")
            return self._neutral()

    def analyze_from_bytes(self, file_bytes: bytes) -> dict:
        if not HAS_EMOTION:
            return self._neutral()
        try:
            image = Image.open(io.BytesIO(file_bytes))
            frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            frame = self._enhance(frame)
            return self._analyze(frame)
        except Exception as e:
            logger.error(f"Emotion analysis (upload) error: {e}")
            return self._neutral()

    def _analyze(self, frame) -> dict:
        for backend in ['mtcnn', 'opencv', 'ssd', 'retinaface']:
            try:
                result = DeepFace.analyze(img_path=frame, actions=['emotion'],
                    enforce_detection=True, detector_backend=backend, align=True, silent=True)
                if isinstance(result, list):
                    result = result[0]
                # DeepFace returns emotion scores as percentages (0-100).
                # Normalize to fractions (0.0-1.0) so the frontend's *100 display is correct.
                raw_emotions = result['emotion']
                emotions = {k: float(v) / 100.0 for k, v in raw_emotions.items()}
                dominant = str(result['dominant_emotion'])
                confidence = float(max(emotions.values()))
                return {
                    "emotions"        : emotions,
                    "dominant_emotion": dominant,
                    "confidence"      : confidence,
                    "stress_level"    : self._stress(emotions),
                    "engagement_score": self._engagement(emotions, dominant),
                    "image_preview"   : self._preview(frame)
                }
            except Exception:
                continue
        return self._neutral()

    def _neutral(self):
        # All emotion values are fractions (0.0-1.0) to match normalized DeepFace output.
        # Frontend multiplies by 100 to display percentages.
        return {
            "emotions": {
                "neutral" : 1.0,
                "happy"   : 0.0,
                "sad"     : 0.0,
                "angry"   : 0.0,
                "fear"    : 0.0,
                "disgust" : 0.0,
                "surprise": 0.0
            },
            "dominant_emotion": "neutral",
            "confidence"      : 1.0,   # 1.0 = 100% — correct
            "stress_level"    : "low",
            "engagement_score": 0.5,
            "image_preview"   : None
        }

    def _stress(self, emotions: dict) -> str:
        # emotions values are normalized fractions (0.0-1.0)
        score = (emotions.get('angry', 0.0) + emotions.get('fear', 0.0) +
                 emotions.get('sad', 0.0) * 0.8 + emotions.get('disgust', 0.0) * 0.6)
        # score max theoretical ~3.4, practical threshold kept as fractions
        return "high" if score > 0.7 else ("medium" if score > 0.4 else "low")

    def _engagement(self, emotions: dict, dominant: str) -> float:
        # FIX: return native float
        pos = emotions.get('happy', 0.0) + emotions.get('surprise', 0.0) * 0.7
        neg = emotions.get('sad', 0.0) * 0.3 + emotions.get('angry', 0.0) * 0.2
        return float(min(1.0, max(0.0, pos - neg)))

    def _enhance(self, frame):
        try:
            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            limg = cv2.merge((clahe.apply(l), a, b))
            return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        except:
            return frame

    def _preview(self, frame, max_size=200):
        try:
            h, w = frame.shape[:2]
            scale = max_size / max(h, w)
            resized = cv2.resize(frame, (int(w * scale), int(h * scale)))
            rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(rgb)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=70)
            return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        except:
            return None

emotion_detector = EmotionDetector()

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
                          detected_keywords, message_text,
                          user_email="", user_phone="",
                          latitude=None, longitude=None, location_name=None):
    try:
        smtp_server     = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port       = int(os.getenv("SMTP_PORT", 587))
        sender_email    = os.getenv("SENDER_EMAIL", "")
        sender_password = os.getenv("SENDER_PASSWORD", "")
        if not sender_password:
            logger.warning("SENDER_PASSWORD not configured. Email skipped.")
            return False

        subject = "URGENT - Mental Health Crisis Alert for " + user_name

        risk_bg = {"critical":"#dc2626","high":"#ea580c","medium":"#d97706","low":"#16a34a"}
        risk_bd = {"critical":"#991b1b","high":"#9a3412","medium":"#92400e","low":"#14532d"}
        risk_lb = {"critical":"#fee2e2","high":"#ffedd5","medium":"#fef3c7","low":"#dcfce7"}
        risk_lt = {"critical":"#991b1b","high":"#9a3412","medium":"#92400e","low":"#14532d"}
        rl   = risk_level.lower()
        rbg  = risk_bg.get(rl, "#dc2626")
        rbd  = risk_bd.get(rl, "#991b1b")
        rlb  = risk_lb.get(rl, "#fee2e2")
        rlt  = risk_lt.get(rl, "#991b1b")

        now_utc = datetime.utcnow().strftime("%B %d, %Y at %H:%M:%S UTC")

        # ── Location block ──
        logger.info(f"[EMAIL] location args: lat={latitude} lng={longitude} name={location_name}")
        location_section = ""
        if latitude is not None and longitude is not None:
            maps_url   = "https://www.google.com/maps?q={lat},{lng}".format(lat=latitude, lng=longitude)
            dir_url    = "https://www.google.com/maps/dir/?api=1&destination={lat},{lng}".format(lat=latitude, lng=longitude)
            loc_label  = location_name if location_name else "{:.5f}, {:.5f}".format(latitude, longitude)
            location_section = """
            <tr><td style="padding:0 28px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8fafc;border:2px solid #334155;border-radius:12px;overflow:hidden;">
                <tr><td style="background:#1e293b;padding:12px 18px;">
                  <span style="color:#94a3b8;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">
                    LOCATION TRACKED
                  </span>
                </td></tr>
                <tr><td style="padding:16px 18px;">
                  <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#0f172a;">&#128205; """ + loc_label + """</p>
                  <p style="margin:0 0 14px;font-size:12px;color:#64748b;">
                    GPS: """ + "{:.6f}".format(latitude) + """, """ + "{:.6f}".format(longitude) + """
                  </p>
                  <a href=\"""" + maps_url + """\" target="_blank"
                     style="display:inline-block;padding:9px 18px;background:#2563eb;color:#fff;
                            text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;margin-right:8px;">
                    &#128506; Open in Google Maps
                  </a>
                  <a href=\"""" + dir_url + """\" target="_blank"
                     style="display:inline-block;padding:9px 18px;background:#0f172a;color:#fff;
                            text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;">
                    &#129517; Get Directions
                  </a>
                </td></tr>
              </table>
            </td></tr>"""
        elif location_name:
            location_section = """
            <tr><td style="padding:0 28px 20px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;">
                <span style="font-size:13px;color:#64748b;">&#128205; Location: <strong style="color:#1e293b;">""" + location_name + """</strong></span>
              </div>
            </td></tr>"""

        # ── Contact rows ──
        e_row = ""
        p_row = ""
        if user_email:
            e_row = '<tr><td style="padding:5px 14px 5px 0;font-size:13px;color:#64748b;white-space:nowrap;">Email:</td><td style="padding:5px 0;font-size:14px;font-weight:700;"><a href="mailto:' + user_email + '" style="color:#2563eb;">' + user_email + '</a></td></tr>'
        if user_phone:
            p_row = '<tr><td style="padding:5px 14px 5px 0;font-size:13px;color:#64748b;white-space:nowrap;">Phone:</td><td style="padding:5px 0;font-size:14px;font-weight:700;"><a href="tel:' + user_phone + '" style="color:#2563eb;">' + user_phone + '</a></td></tr>'

        # ── Keywords ──
        kw_html = ""
        for kw in (detected_keywords or []):
            kw_html += '<span style="display:inline-block;padding:3px 10px;margin:3px;background:#fee2e2;color:#991b1b;border-radius:16px;font-size:12px;font-weight:700;">' + kw + '</span>'
        if not kw_html:
            kw_html = '<span style="font-size:13px;color:#64748b;">Multiple indicators detected</span>'

        # ── Action items ──
        actions = [
            "Contact <strong>" + user_name + "</strong> immediately by phone or visit in person.",
            "Check on their physical safety and emotional wellbeing right now.",
            "If they are in immediate danger &mdash; call <strong>911 (US) / 999 (UK) / 112 (EU)</strong>.",
            "Encourage them to call <strong>988</strong> (Suicide &amp; Crisis Lifeline, call or text).",
            "Stay with them or arrange for a trusted person to remain with them.",
            "Do <u>not</u> leave them alone if they express intent to harm themselves.",
        ]
        actions_html = ""
        for i, act in enumerate(actions, 1):
            actions_html += (
                '<tr>'
                '<td style="padding:7px 12px 7px 0;vertical-align:top;">'
                '<span style="display:inline-flex;align-items:center;justify-content:center;'
                'width:24px;height:24px;background:' + rbg + ';color:#fff;border-radius:50%;'
                'font-size:12px;font-weight:900;">' + str(i) + '</span>'
                '</td>'
                '<td style="padding:7px 0;font-size:14px;color:#1e293b;line-height:1.55;">' + act + '</td>'
                '</tr>'
            )

        html_body = """<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Mental Health Crisis Alert</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;width:100%;background:#fff;border-radius:16px;
              box-shadow:0 4px 32px rgba(0,0,0,.13);overflow:hidden;">

  <!-- BANNER -->
  <tr><td style="background:""" + rbg + """;padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:26px 28px;">
          <p style="margin:0 0 5px;font-size:11px;font-weight:800;letter-spacing:.12em;
                    text-transform:uppercase;color:rgba(255,255,255,.75);">
            URGENT &mdash; IMMEDIATE ACTION REQUIRED
          </p>
          <h1 style="margin:0;font-size:24px;font-weight:900;color:#fff;line-height:1.2;">
            Mental Health Crisis Alert
          </h1>
        </td>
        <td style="padding:26px 28px 26px 0;text-align:right;vertical-align:top;">
          <span style="display:inline-block;padding:5px 14px;background:rgba(255,255,255,.2);
                       border:2px solid rgba(255,255,255,.5);border-radius:20px;
                       font-size:12px;font-weight:900;color:#fff;letter-spacing:.06em;">
            """ + risk_level.upper() + """ RISK
          </span>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- GREETING -->
  <tr><td style="padding:24px 28px 12px;">
    <p style="margin:0;font-size:16px;color:#334155;">
      Dear <strong style="color:#0f172a;">""" + contact_name + """</strong>,
    </p>
    <p style="margin:12px 0 0;font-size:15px;color:#475569;line-height:1.65;">
      Our AI system has detected a
      <strong style="color:""" + rbg + """;">""" + risk_level.upper() + """ RISK</strong>
      mental health crisis for <strong style="color:#0f172a;">""" + user_name + """</strong>.
      Please act immediately.
    </p>
  </td></tr>

  <!-- PERSON IN CRISIS -->
  <tr><td style="padding:12px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f8fafc;border:2px solid """ + rbd + """;border-radius:12px;overflow:hidden;">
      <tr><td style="background:""" + rbg + """;padding:12px 18px;">
        <span style="color:#fff;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">
          PERSON IN CRISIS
        </span>
      </td></tr>
      <tr><td style="padding:16px 18px;">
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:5px 14px 5px 0;font-size:13px;color:#64748b;white-space:nowrap;">Name:</td>
              <td style="padding:5px 0;font-size:15px;font-weight:800;color:#0f172a;">""" + user_name + """</td></tr>
          """ + e_row + """
          """ + p_row + """
        </table>
      </td></tr>
    </table>
  </td></tr>

  """ + location_section + """

  <!-- CRISIS DETAILS -->
  <tr><td style="padding:12px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#fff5f5;border:2px solid """ + rbd + """;border-radius:12px;overflow:hidden;">
      <tr><td style="background:""" + rbg + """;padding:12px 18px;">
        <span style="color:#fff;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">
          CRISIS DETAILS
        </span>
      </td></tr>
      <tr><td style="padding:16px 18px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top;">Risk Level:</td>
            <td style="padding:6px 0;">
              <span style="display:inline-block;padding:3px 12px;background:""" + rlb + """;color:""" + rlt + """;
                           border-radius:16px;font-size:12px;font-weight:800;letter-spacing:.05em;">
                """ + risk_level.upper() + """
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#64748b;vertical-align:top;">Indicators:</td>
            <td style="padding:8px 0;">""" + kw_html + """</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#64748b;vertical-align:top;">Message:</td>
            <td style="padding:6px 0;">
              <div style="background:#fff;border-left:4px solid """ + rbg + """;padding:10px 14px;
                          border-radius:0 8px 8px 0;font-size:14px;color:#1e293b;
                          font-style:italic;line-height:1.6;">
                &ldquo;""" + message_text + """&rdquo;
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#64748b;">Time:</td>
            <td style="padding:6px 0;font-size:13px;color:#1e293b;font-weight:700;">""" + now_utc + """</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- IMMEDIATE ACTIONS -->
  <tr><td style="padding:12px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#fffbeb;border:2px solid #f59e0b;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#f59e0b;padding:12px 18px;">
        <span style="color:#fff;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">
          IMMEDIATE ACTIONS REQUIRED
        </span>
      </td></tr>
      <tr><td style="padding:16px 18px;">
        <table cellpadding="0" cellspacing="0">""" + actions_html + """</table>
      </td></tr>
    </table>
  </td></tr>

  <!-- EMERGENCY RESOURCES -->
  <tr><td style="padding:12px 28px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#16a34a;padding:12px 18px;">
        <span style="color:#fff;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">
          EMERGENCY RESOURCES
        </span>
      </td></tr>
      <tr><td style="padding:16px 18px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;font-size:13px;color:#166534;border-bottom:1px solid #bbf7d0;">
            &#128222; <strong>988</strong> &mdash; Suicide &amp; Crisis Lifeline (US, call or text)
          </td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#166534;border-bottom:1px solid #bbf7d0;">
            &#128172; <strong>Text HOME to 741741</strong> &mdash; Crisis Text Line
          </td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#166534;border-bottom:1px solid #bbf7d0;">
            &#128657; <strong>911 / 999 / 112</strong> &mdash; Emergency Services (US / UK / EU)
          </td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#166534;border-bottom:1px solid #bbf7d0;">
            &#127973; <strong>1-800-950-6264</strong> &mdash; NAMI Mental Health Helpline
          </td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#166534;border-bottom:1px solid #bbf7d0;">
            &#127760; <a href="https://988lifeline.org/chat" style="color:#15803d;font-weight:700;">988lifeline.org/chat</a>
            &mdash; Online Crisis Chat
          </td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#166534;">
            &#127760; <a href="https://www.iasp.info/resources/Crisis_Centres/" style="color:#15803d;font-weight:700;">iasp.info</a>
            &mdash; International Crisis Centres Directory
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;line-height:1.6;">
      This alert was automatically generated by <strong>MindfulAI</strong> crisis detection system.<br/>
      You are receiving this because you are listed as an emergency contact.
    </p>
    <p style="margin:0;font-size:11px;color:#cbd5e1;">Alert time: """ + now_utc + """ &nbsp;&middot;&nbsp; Do not reply to this email</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>"""

        msg = MIMEMultipart("alternative")
        msg["Subject"]          = subject
        msg["From"]             = "MindfulAI Crisis Alert <" + sender_email + ">"
        msg["To"]               = recipient_email
        msg["X-Priority"]       = "1"
        msg["X-MSMail-Priority"] = "High"
        msg["Importance"]       = "High"
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipient_email, msg.as_string())
        logger.info("Emergency email sent to " + recipient_email)
        return True
    except Exception as e:
        logger.error("Error sending emergency email: " + str(e))
        return False

# ===================== DATABASE SETUP =====================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mental_health.db")
engine       = create_engine(DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()

class DBUser(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String, unique=True, index=True, nullable=False)
    email         = Column(String, unique=True, index=True, nullable=True)
    full_name     = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    phone         = Column(String, nullable=True)
    is_admin      = Column(Boolean, default=False)
    created_at    = Column(DateTime, default=datetime.utcnow)

class DBMoodEntry(Base):
    __tablename__ = "mood_entries"
    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, index=True)
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
    __tablename__                  = "crisis_contacts"
    id                             = Column(Integer, primary_key=True, index=True)
    user_id                        = Column(Integer, unique=True, index=True)
    emergency_contact_name         = Column(String)
    emergency_contact_phone        = Column(String, nullable=True)
    emergency_contact_email        = Column(String, nullable=True)
    emergency_contact_relationship = Column(String, nullable=True)
    preferred_escalation           = Column(String, default="email")
    consent_given                  = Column(Boolean, default=False)

class DBUserProfile(Base):
    __tablename__         = "user_profiles_db"
    id                    = Column(Integer, primary_key=True, index=True)
    user_id               = Column(Integer, unique=True, index=True)
    preferences           = Column(JSON, default=dict)
    mental_health_history = Column(JSON, default=dict)
    updated_at            = Column(DateTime, default=datetime.utcnow)

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
    language       : str = "eng_Latn"

class ChatResponse(BaseModel):
    response            : str
    original_response   : Optional[str] = None
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
    language_code       : Optional[str] = None
    emotion_detected    : Optional[str] = None
    emotion_confidence  : Optional[float] = None

# ---- Auth Models ----
class UserCreate(BaseModel):
    username                      : str
    password                      : str
    email                         : Optional[str] = None
    full_name                     : Optional[str] = None
    phone                         : Optional[str] = None
    emergency_contact_name        : Optional[str] = None
    emergency_contact_phone       : Optional[str] = None
    emergency_contact_email       : Optional[str] = None
    emergency_contact_relationship: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class MoodEntryCreate(BaseModel):
    user_id: int
    score  : float
    notes  : Optional[str] = None

class MessageRequest(BaseModel):
    user_id       : int
    message       : str
    language      : str = "eng_Latn"
    image_data    : Optional[str] = None
    latitude      : Optional[float] = None
    longitude     : Optional[float] = None
    location_name : Optional[str] = None

class CrisisDetectionRequest(BaseModel):
    user_id       : int
    message       : str
    latitude      : Optional[float] = None
    longitude     : Optional[float] = None
    location_name : Optional[str] = None

class CrisisContactCreate(BaseModel):
    user_id                       : int
    emergency_contact_name        : str
    emergency_contact_phone       : Optional[str] = None
    emergency_contact_email       : Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    preferred_escalation          : str = "email"
    consent_given                 : bool = True

class EmotionAnalysisRequest(BaseModel):
    image_data: str   # base64

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
    "high"    : ["self harm","cutting","hurting myself","don't want to live","worthless","burden","better off dead","want to hurt myself"],
    "medium"  : ["depressed","anxious","panic","overwhelmed","can't cope","desperate","alone","breaking down"]
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
                    "risk_level"     : str(result.get("risk_level", "low")),
                    "harm_indicators": list(result.get("indicators", [])),
                    "confidence"     : float(result.get("confidence", 0.0)),
                    "reason"         : str(result.get("reason", ""))
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
                    confidence = float(min(0.95, 0.8 + len(detected) * 0.05))
                elif risk == "high" and max_risk != "critical":
                    max_risk   = "high"
                    confidence = float(min(0.85, 0.6 + len(detected) * 0.05))
                elif risk == "medium" and max_risk == "low":
                    max_risk   = "medium"
                    confidence = float(min(0.75, 0.4 + len(detected) * 0.05))
    return {
        "risk_level"     : max_risk,
        "harm_indicators": list(set(detected)),
        "confidence"     : confidence,
        "reason"         : f"Keywords: {', '.join(detected)}"
    }

def get_crisis_response(risk_level: str) -> str:
    responses = {
        "critical": "I'm very concerned about your safety. Please contact emergency services (911) or Suicide Prevention Lifeline: 988.",
        "high"    : "I hear you're in significant pain. Crisis resources: Lifeline 988, Crisis Text Line: Text HOME to 741741.",
        "medium"  : "You're going through a tough time. A counselor or therapist can help. Would you like support resources?",
        "low"     : "I'm here to listen. Let's talk through what you're experiencing."
    }
    return responses.get(risk_level, responses["low"])

# ===================== RISK PREDICTOR =====================
class RiskPredictor:
    def predict_risk(self, mood_history: List[float], days_active: int = 7) -> Dict:
        if len(mood_history) < 2:
            return {
                "risk_score"     : 0.3,
                "risk_level"     : "low",
                "recommendations": ["Keep logging your mood daily."]
            }
        # FIX: Cast all numpy results to native Python types immediately
        recent_avg = float(np.mean(mood_history[-7:]) if len(mood_history) >= 7 else np.mean(mood_history))
        hist_avg   = float(np.mean(mood_history))
        std        = float(np.std(mood_history) / 10.0)
        decline    = float(max(0.0, (hist_avg - recent_avg) / 10.0))
        risk       = float(min(decline * 0.6 + std * 0.4, 1.0))
        level      = "high" if risk > 0.6 else ("medium" if risk > 0.3 else "low")
        recs = (
            ["Consider reaching out to a mental health professional.", "Lifeline: 988"]
            if level == "high"
            else ["Try mindfulness or breathing exercises.", "Maintain consistent sleep."]
            if level == "medium"
            else ["Keep up positive momentum!", "Stay connected with supportive people."]
        )
        return {
            "risk_score"     : risk,   # already native float
            "risk_level"     : level,
            "recommendations": recs
        }

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
         "answer": "Anxiety is a natural stress response. Management: CBT, mindfulness, regular exercise, professional therapy."},
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
         "answer": "Call 911 if immediate danger. Lifeline: 988. Crisis Text Line: Text HOME to 741741."},
        {"category": "coping",      "question": "What are healthy coping strategies?",
         "answer": "Exercise, journaling, talking to trusted friends, creative outlets, nature walks, meditation."},
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
            vs = Chroma(persist_directory=CHROMA_PERSIST_DIR, embedding_function=embeddings,
                        collection_name="mental_health_kb")
        else:
            docs       = create_default_knowledge()
            splitter   = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
            split_docs = splitter.split_documents(docs)
            vs         = Chroma.from_documents(documents=split_docs, embedding=embeddings,
                            persist_directory=CHROMA_PERSIST_DIR, collection_name="mental_health_kb")
            rag_stats["total_documents"] = len(docs)
            rag_stats["total_chunks"]    = len(split_docs)
        ret = vs.as_retriever(search_type="similarity", search_kwargs={"k": 5})
        return vs, ret
    except Exception as e:
        logger.error(f"Error initializing vectorstore: {e}")
        return None, None

# ===================== LLM INIT =====================
def init_llm():
    if HAS_GROQ and os.getenv("GROQ_API_KEY"):
        return ChatGroq(model="llama-3.1-8b-instant", temperature=0.3, max_tokens=1000,
                        api_key=os.getenv("GROQ_API_KEY"))
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
    # FIX: ensure confidence is a native Python float
    return json.dumps({
        "primary_emotion"  : primary,
        "detected_emotions": detected,
        "confidence"       : float(min(0.9, 0.5 + len(detected) * 0.1))
    })

@tool
def suggest_coping_strategies(emotion: str) -> str:
    """Suggest coping strategies based on emotional state."""
    strategies = {
        "stressed"  : ["Practice deep breathing for 5 minutes","Take a 15-minute walk",
                        "Journal your thoughts","Progressive muscle relaxation"],
        "anxious"   : ["Grounding: Name 5 things you can see","Breathe in for 4 counts, out for 4",
                        "Listen to calming music","Challenge anxious thoughts"],
        "depressed" : ["Reach out to a friend or family member","Engage in a small enjoyable activity",
                        "Practice self-compassion meditation","Set one small achievable goal"],
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
            self.executor = AgentExecutor(agent=agent, tools=self.tools, verbose=False,
                                          handle_parsing_errors=True)
        except Exception as e:
            logger.error(f"Error creating agent: {e}")
            self.executor = None

    async def process(self, user_id: str, conv_id: str, message: str,
                      language: str = "eng_Latn", emotion_context: str = "") -> Dict[str, Any]:
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
                        context_addition= "\n\nRelevant knowledge:\n" + "\n".join(
                            [f"- {d.page_content[:200]}" for d in docs[:2]])
                except Exception as e:
                    logger.error(f"RAG error: {e}")

            pending        = [t for t in tasks if t.status != TaskStatus.COMPLETED]
            system_context = f"""User Profile:
- Name: {profile.name or 'Unknown'}
- Goals: {', '.join(profile.mental_health_goals[:2])}
- Current emotion: {primary_emotion}
- Active tasks: {len(pending)}
{context_addition}
{emotion_context}"""

            rag_logger.log_step("Running agent...")
            response_text = ""
            agent_actions = []
            if self.executor:
                try:
                    result        = self.executor.invoke(
                        {"input": message + f"\n\n[Context: {system_context}]", "messages": []})
                    response_text = result.get("output","")
                    for step in result.get("intermediate_steps",[]):
                        if len(step) >= 2:
                            action = step[0]
                            agent_actions.append({"action": str(action.tool),
                                                  "reasoning": str(action.tool_input)[:100]})
                except Exception as e:
                    logger.error(f"Agent executor error: {e}")

            if not response_text:
                response_text = await self._fallback_response(message, primary_emotion, system_context, language)

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
                    task_desc, task_cat = task_map.get(primary_emotion,
                        ("Practice daily mindfulness", TaskCategory.MINDFULNESS))
                    new_task = WellnessTask(
                        user_id=user_id, task=task_desc, title=task_desc,
                        category=task_cat, priority="medium", time_to_complete=10,
                        due_date=datetime.now() + timedelta(days=2),
                        emotional_context=EmotionalState(primary_emotion)
                            if primary_emotion in [e.value for e in EmotionalState] else None
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
                "eng_Latn": "You are a compassionate mental health assistant.",
                "hin_Deva": "Eres un asistente compasivo de salud mental.",
                "tam_Taml": "You are a compassionate mental health assistant. Respond thoughtfully.",
            }
            sys_prompt = lang_prompts.get(language, lang_prompts["eng_Latn"])
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
app = FastAPI(title="Mental Health AI - Integrated System with Multilingual & Emotion Detection")

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
    if db.query(DBUser).filter(DBUser.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already taken.")
    if user.email and db.query(DBUser).filter(DBUser.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")
    db_user = DBUser(username=user.username, email=user.email or None,
        full_name=user.full_name or None, password_hash=hash_password(user.password),
        phone=user.phone or None, is_admin=False)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    db.add(DBUserProfile(user_id=db_user.id, preferences={}, mental_health_history={}))
    db.commit()
    if user.emergency_contact_name:
        ec = DBCrisisContact(user_id=db_user.id,
            emergency_contact_name=user.emergency_contact_name,
            emergency_contact_phone=user.emergency_contact_phone or "",
            emergency_contact_email=user.emergency_contact_email or "",
            emergency_contact_relationship=user.emergency_contact_relationship or "",
            preferred_escalation="email", consent_given=True)
        db.add(ec)
        db.commit()
    return {"id": db_user.id, "username": db_user.username, "email": db_user.email,
            "full_name": db_user.full_name, "phone": db_user.phone, "is_admin": db_user.is_admin,
            "message": "Account created successfully."}

@app.post("/login/")
def login(creds: UserLogin, db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.username == creds.username).first()
    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    return {"id": user.id, "username": user.username, "email": user.email,
            "full_name": user.full_name, "phone": user.phone, "is_admin": user.is_admin,
            "message": "Login successful."}

# ===================== ENDPOINTS: PROFILE =====================
@app.get("/profile/{user_id}")
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile      = db.query(DBUserProfile).filter(DBUserProfile.user_id == user_id).first()
    ec           = db.query(DBCrisisContact).filter(DBCrisisContact.user_id == user_id).first()
    file_profile = load_user_profile(f"db_user_{user_id}")
    return {
        "user_id"   : user_id,
        "username"  : user.username,
        "email"     : user.email,
        "full_name" : user.full_name,
        "phone"     : user.phone,
        "is_admin"  : user.is_admin,
        "goals"             : file_profile.mental_health_goals,
        "coping_strategies" : file_profile.coping_strategies,
        "triggers"          : file_profile.triggers,
        "emotional_state"   : file_profile.emotional_state.value if file_profile.emotional_state else None,
        "profile": {
            "preferences"          : profile.preferences if profile else {},
            "mental_health_history": profile.mental_health_history if profile else {}
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
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if "phone" in data:
        user.phone = data["phone"]
        db.commit()
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
    entry = DBMoodEntry(user_id=mood.user_id, score=mood.score, notes=mood.notes)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "score": entry.score, "notes": entry.notes, "timestamp": entry.timestamp}

@app.get("/mood/{user_id}")
def get_mood_history(user_id: int, limit: int = 30, db: Session = Depends(get_db)):
    entries = (db.query(DBMoodEntry).filter(DBMoodEntry.user_id == user_id)
               .order_by(DBMoodEntry.timestamp.desc()).limit(limit).all())
    return [{"id": e.id, "score": e.score, "notes": e.notes, "timestamp": e.timestamp} for e in entries]

# ===================== ENDPOINTS: EMOTION DETECTION =====================
@app.post("/analyze-emotion/")
async def analyze_emotion(request: EmotionAnalysisRequest):
    """Analyze emotion from base64 image."""
    # FIX: wrap with convert_numpy to sanitize any remaining numpy types
    result = emotion_detector.analyze_from_base64(request.image_data)
    return convert_numpy(result)

@app.post("/upload-image/")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image for emotion analysis."""
    allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB).")
    # FIX: wrap with convert_numpy to sanitize any remaining numpy types
    result = convert_numpy(emotion_detector.analyze_from_bytes(contents))
    return {
        "message"         : "Image analyzed successfully",
        "filename"        : file.filename,
        "emotion_analysis": result,
        "image_preview"   : result.get("image_preview")
    }

# ===================== ENDPOINTS: LANGUAGES =====================
@app.get("/languages/")
def get_languages():
    return {"supported_languages": SUPPORTED_LANGUAGES, "has_translation": HAS_TRANSLATION}

# ===================== ENDPOINTS: CHAT (DB-based with multilingual + emotion) =====================
@app.post("/chat/")
async def chat_db(request: MessageRequest, db: Session = Depends(get_db)):
    # Emotion detection if image provided
    emotion_result_data = None
    emotion_context     = ""
    if request.image_data:
        # FIX: sanitize emotion result
        emotion_result_data = convert_numpy(emotion_detector.analyze_from_base64(request.image_data))
        dom    = emotion_result_data.get("dominant_emotion", "neutral")
        conf   = emotion_result_data.get("confidence", 0.0)
        stress = emotion_result_data.get("stress_level", "low")
        emotion_context = f"\nUser's detected emotion: {dom} (confidence: {conf:.2f}, stress: {stress})"

    # Translate incoming message to English if needed
    source_lang     = request.language or "eng_Latn"
    english_message = translate_indic_to_english(request.message, source_lang)

    recent_mood  = (db.query(DBMoodEntry).filter(DBMoodEntry.user_id == request.user_id)
                    .order_by(DBMoodEntry.timestamp.desc()).first())
    mood_context = {"mood_score": recent_mood.score if recent_mood else None}

    str_user_id = f"db_user_{request.user_id}"
    result      = await agent_pipeline.process(str_user_id, str(uuid.uuid4()),
                       english_message, source_lang, emotion_context)

    # Translate response back to target language
    english_response    = result["response"]
    translated_response = translate_to_indic(english_response, source_lang)

    # Crisis detection on original English message
    crisis_result        = analyze_harm_intent(english_message, llm if HAS_GROQ else None)
    crisis_detected      = False
    escalation_triggered = False

    if crisis_result["risk_level"].lower() in ["high","critical"]:
        crisis_detected = True
        ce = DBCrisisEvent(user_id=request.user_id, message_content=request.message,
                           risk_level=crisis_result["risk_level"],
                           detected_keywords=crisis_result["harm_indicators"])
        db.add(ce)
        db.commit()
        ec   = db.query(DBCrisisContact).filter(DBCrisisContact.user_id == request.user_id).first()
        user = db.query(DBUser).filter(DBUser.id == request.user_id).first()
        if ec and ec.emergency_contact_email and user:
            logger.info(f"[CRISIS] Sending alert. lat={getattr(request,'latitude',None)} lng={getattr(request,'longitude',None)} loc={getattr(request,'location_name',None)}")
            escalation_triggered = send_emergency_email(
                recipient_email    =ec.emergency_contact_email,
                contact_name       =ec.emergency_contact_name,
                user_name          =user.full_name or user.username,
                risk_level         =crisis_result["risk_level"],
                detected_keywords  =crisis_result["harm_indicators"],
                message_text       =request.message,
                user_email         =user.email or "",
                user_phone         =user.phone or "",
                latitude           =getattr(request, "latitude", None),
                longitude          =getattr(request, "longitude", None),
                location_name      =getattr(request, "location_name", None))

    conv = DBConversation(user_id=request.user_id, message=request.message,
                          response=english_response, language=source_lang,
                          context={"mood_context": mood_context})
    db.add(conv)
    db.commit()

    response_data = {
        "response"              : translated_response,
        "original_response"     : english_response if source_lang != "eng_Latn" else None,
        "understanding_complete": True,
        "rag_used"              : result["used_rag"],
        "tools_used"            : [a["action"] for a in result["agent_actions"]],
        "language_code"         : SUPPORTED_LANGUAGES.get(source_lang, {}).get("speech_code", "en-US"),
        "emotion"               : emotion_result_data,
        "crisis"                : None,
    }
    if crisis_detected:
        response_data["crisis"] = {
            "risk_level"          : crisis_result["risk_level"],
            "harm_indicators"     : crisis_result["harm_indicators"],
            "crisis_confidence"   : crisis_result["confidence"],
            "escalation_triggered": escalation_triggered,
            "crisis_response"     : get_crisis_response(crisis_result["risk_level"]),
        }
    return response_data

# ===================== ENDPOINTS: HISTORY =====================
@app.get("/history/{user_id}")
def get_history(user_id: int, db: Session = Depends(get_db)):
    return (db.query(DBConversation).filter(DBConversation.user_id == user_id)
            .order_by(DBConversation.timestamp.desc()).limit(50).all())

# ===================== ENDPOINTS: AGENTIC CHAT (string user_id) =====================
@app.post("/api/chat", response_model=ChatResponse)
async def agentic_chat(request: ChatRequest):
    conv_id = request.conversation_id or str(uuid.uuid4())
    lang    = request.language or "eng_Latn"

    # Translate incoming
    english_message = translate_indic_to_english(request.message, lang)
    result          = await agent_pipeline.process(request.user_id, conv_id, english_message, lang)

    # Translate response
    english_response    = result["response"]
    translated_response = translate_to_indic(english_response, lang)

    crisis_result   = analyze_harm_intent(english_message, llm if HAS_GROQ else None)
    crisis_detected = crisis_result["risk_level"].lower() in ["high","critical"]

    return ChatResponse(
        response            =translated_response,
        original_response   =english_response if lang != "eng_Latn" else None,
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
        escalation_triggered=False,
        language_code       =SUPPORTED_LANGUAGES.get(lang, {}).get("speech_code", "en-US")
    )

# ===================== ENDPOINTS: TASKS =====================
@app.get("/api/tasks/{user_id}")
async def get_tasks(user_id: str, status: Optional[TaskStatus] = None):
    tasks = load_user_tasks(user_id)
    if status:
        tasks = [t for t in tasks if t.status == status]
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
    ce     = DBCrisisEvent(user_id=request.user_id, message_content=request.message,
                           risk_level=result["risk_level"], detected_keywords=result["harm_indicators"])
    db.add(ce)
    db.commit()
    db.refresh(ce)
    escalation_triggered = False
    if result["risk_level"].lower() in ["critical","high"]:
        ec   = db.query(DBCrisisContact).filter(DBCrisisContact.user_id == request.user_id).first()
        user = db.query(DBUser).filter(DBUser.id == request.user_id).first()
        if ec and ec.emergency_contact_email and user:
            escalation_triggered = send_emergency_email(
                recipient_email  =ec.emergency_contact_email,
                contact_name     =ec.emergency_contact_name,
                user_name        =user.full_name or user.username,
                risk_level       =result["risk_level"],
                detected_keywords=result["harm_indicators"],
                message_text     =request.message,
                user_email       =user.email or "",
                user_phone       =user.phone or "",
                latitude         =getattr(request, "latitude", None),
                longitude        =getattr(request, "longitude", None),
                location_name    =getattr(request, "location_name", None))
    return {
        "risk_level"          : result["risk_level"],
        "indicators"          : result["harm_indicators"],
        "harm_indicators"     : result["harm_indicators"],
        "confidence"          : result["confidence"],
        "reason"              : result["reason"],
        "response"            : get_crisis_response(result["risk_level"]),
        "event_id"            : ce.id,
        "escalation_triggered": escalation_triggered,
        "escalation_message"  : "Emergency contact notified!" if escalation_triggered else "Below threshold"
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
    return (db.query(DBCrisisEvent).filter(DBCrisisEvent.user_id == user_id)
            .order_by(DBCrisisEvent.timestamp.desc()).limit(limit).all())

# ===================== ENDPOINTS: RISK SCORING =====================
@app.get("/api/risk/{user_id}")
def get_risk_score(user_id: int, db: Session = Depends(get_db)):
    moods       = (db.query(DBMoodEntry).filter(DBMoodEntry.user_id == user_id)
                   .order_by(DBMoodEntry.timestamp.asc()).all())
    mood_scores = [m.score for m in moods]
    user        = db.query(DBUser).filter(DBUser.id == user_id).first()
    days_active = (datetime.utcnow() - user.created_at).days if user else 7
    # FIX: convert_numpy ensures no numpy types leak into the JSON response
    return convert_numpy(risk_predictor.predict_risk(mood_scores, days_active))

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
    docs = [Document(
        page_content=f"Question: {str(row['question']).strip()}\nAnswer: {str(row['answer']).strip()}",
        metadata={"source": file.filename, "type": "qa_pair"}
    ) for _, row in df.iterrows() if pd.notna(row['question']) and pd.notna(row['answer'])]
    if not docs:
        raise HTTPException(status_code=400, detail="No valid Q&A pairs found")
    embeddings = initialize_embeddings()
    if not embeddings:
        raise HTTPException(status_code=500, detail="Failed to initialize embeddings")
    if vectorstore is None:
        vectorstore = Chroma.from_documents(documents=docs, embedding=embeddings,
            persist_directory=CHROMA_PERSIST_DIR, collection_name="mental_health_kb")
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
        "message"             : "Mental Health AI - Integrated System",
        "status"              : "online",
        "rag_initialized"     : vectorstore is not None,
        "langgraph_enabled"   : HAS_LANGGRAPH,
        "multilingual_enabled": HAS_TRANSLATION,
        "emotion_detection"   : HAS_EMOTION,
        "supported_languages" : list(SUPPORTED_LANGUAGES.keys()),
    }

@app.get("/api/health")
def health():
    return {
        "status"                 : "healthy" if vectorstore is not None else "degraded",
        "rag_stats"              : rag_stats,
        "langgraph"              : HAS_LANGGRAPH,
        "checkpointing"          : HAS_CHECKPOINTING,
        "multilingual"           : HAS_TRANSLATION,
        "emotion_detection"      : HAS_EMOTION,
        "timestamp"              : datetime.now().isoformat(),
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