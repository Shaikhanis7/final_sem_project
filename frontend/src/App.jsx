import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Brain, Send, Heart, AlertTriangle, CheckCircle, User,
  List, Settings, LogOut, Upload, Sun, Moon, Sparkles, Wrench,
  Shield, Play, Loader, X, Trash2, RefreshCw, Phone,
  Mail, Download, TrendingUp, ChevronDown, AlertCircle, Check,
  Globe, MessageCircle, Activity, Database, BookOpen, Coffee,
  Leaf, Target, Smile, Frown, Meh, Eye, EyeOff,
  Plus, Minus, Home, Lock, Clock, Key, Camera,
  Languages, Mic, MicOff, Volume2, VolumeX,
  Zap, BarChart2, Image as ImageIcon, Info
} from 'lucide-react';
import './App.css';

const API = 'http://localhost:8000';

// ─── Language Config ─────────────────────────────────────────
const INDIC_LANGUAGES = {
  eng_Latn: { name:'English',   native:'English',   flag:'🇺🇸', speech:'en-US',  speechAlts:['en-GB','en-AU'] },
  hin_Deva: { name:'Hindi',     native:'हिन्दी',     flag:'🇮🇳', speech:'hi-IN',  speechAlts:['hi'] },
  ben_Beng: { name:'Bengali',   native:'বাংলা',      flag:'🇧🇩', speech:'bn-IN',  speechAlts:['bn-BD','bn'] },
  tam_Taml: { name:'Tamil',     native:'தமிழ்',      flag:'🇮🇳', speech:'ta-IN',  speechAlts:['ta'] },
  tel_Telu: { name:'Telugu',    native:'తెలుగు',     flag:'🇮🇳', speech:'te-IN',  speechAlts:['te'] },
  mar_Deva: { name:'Marathi',   native:'मराठी',      flag:'🇮🇳', speech:'mr-IN',  speechAlts:['mr'] },
  guj_Gujr: { name:'Gujarati',  native:'ગુજરાતી',    flag:'🇮🇳', speech:'gu-IN',  speechAlts:['gu'] },
  kan_Knda: { name:'Kannada',   native:'ಕನ್ನಡ',      flag:'🇮🇳', speech:'kn-IN',  speechAlts:['kn'] },
  mal_Mlym: { name:'Malayalam', native:'മലയാളം',     flag:'🇮🇳', speech:'ml-IN',  speechAlts:['ml'] },
  pan_Guru: { name:'Punjabi',   native:'ਪੰਜਾਬੀ',     flag:'🇮🇳', speech:'pa-IN',  speechAlts:['pa'] },
  ory_Orya: { name:'Odia',      native:'ଓଡ଼ିଆ',      flag:'🇮🇳', speech:'or-IN',  speechAlts:['or'] },
  asm_Beng: { name:'Assamese',  native:'অসমীয়া',    flag:'🇮🇳', speech:'as-IN',  speechAlts:['as'] },
};

const PLACEHOLDERS = {
  eng_Latn:"How are you feeling today? I'm here to listen…",
  hin_Deva:'आज आप कैसा महसूस कर रहे हैं?',
  ben_Beng:'আজ আপনি কেমন অনুভব করছেন?',
  tam_Taml:'இன்று நீங்கள் எப்படி உணர்கிறீர்கள்?',
  tel_Telu:'ఈరోజు మీకు ఎలా అనిపిస్తుందో చెప్పగలరా?',
  mar_Deva:'आज तुम्हाला कसं वाटतंय?',
  guj_Gujr:'આજે તમે કેવું અનુભવ કરો છો?',
  kan_Knda:'ಇಂದು ನೀವು ಹೇಗೆ ಭಾವಿಸುತ್ತಿದ್ದೀರಿ?',
  mal_Mlym:'ഇന്ന് നിങ്ങൾക്ക് എങ്ങനെ തോന്നുന്നു?',
  pan_Guru:'ਅੱਜ ਤੁਸੀਂ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?',
  ory_Orya:'ଆଜି ଆପଣ କିପରି ଅନୁଭବ କୁ?',
  asm_Beng:'আজি আপুনি কেনে অনুভৱ কৰিছে?',
};

const MOOD_LABELS = {
  1:'Terrible',2:'Very Bad',3:'Bad',4:'Below Avg',
  5:'Okay',6:'Alright',7:'Good',8:'Very Good',9:'Great',10:'Excellent'
};

const EMOTION_META = {
  happy:   {emoji:'😊',color:'#fbbf24',bg:'rgba(251,191,36,0.14)'},
  sad:     {emoji:'😢',color:'#6eb5b5',bg:'rgba(110,181,181,0.14)'},
  angry:   {emoji:'😠',color:'#f87171',bg:'rgba(239,68,68,0.14)'},
  fear:    {emoji:'😨',color:'#b3a7ff',bg:'rgba(155,136,219,0.14)'},
  neutral: {emoji:'😐',color:'#94a3b8',bg:'rgba(148,163,184,0.14)'},
  disgust: {emoji:'🤢',color:'#86efac',bg:'rgba(134,239,172,0.14)'},
  surprise:{emoji:'😮',color:'#fb7185',bg:'rgba(251,113,133,0.14)'},
};

const getMoodIcon = s =>
  s <= 3 ? <Frown size={26} strokeWidth={1.8}/> :
  s <= 6 ? <Meh  size={26} strokeWidth={1.8}/> :
           <Smile size={26} strokeWidth={1.8}/>;

// ─── Voice Utilities ──────────────────────────────────────────

/**
 * Find the best available TTS voice for a given BCP-47 lang code.
 * Returns the voice object or null if none found.
 * Strategy: exact match → prefix match → null
 */
function findBestVoice(voices, langCode) {
  if (!voices || voices.length === 0) return null;
  // 1. Exact match (e.g. "hi-IN" === "hi-IN")
  const exact = voices.find(v => v.lang.toLowerCase() === langCode.toLowerCase());
  if (exact) return exact;
  // 2. Prefix match — language subtag only (e.g. "hi" from "hi-IN")
  const prefix = langCode.split('-')[0].toLowerCase();
  const partial = voices.find(v => v.lang.toLowerCase().startsWith(prefix + '-') || v.lang.toLowerCase() === prefix);
  return partial || null;
}

/**
 * Build a set of BCP-47 codes that have a TTS voice available in this browser.
 */
function getSupportedTTSCodes(voices) {
  const supported = new Set();
  if (!voices) return supported;
  Object.entries(INDIC_LANGUAGES).forEach(([code, cfg]) => {
    const all = [cfg.speech, ...(cfg.speechAlts || [])];
    for (const lc of all) {
      if (findBestVoice(voices, lc)) { supported.add(code); break; }
    }
  });
  return supported;
}

/**
 * Build a set of BCP-47 codes that STT (speech recognition) can attempt.
 * We can't reliably query this from the browser API, so we use a heuristic:
 * Chrome / Edge support a wide range of Indic languages via their cloud engine.
 * Firefox only supports the system language. We always try, and catch errors.
 */
const STT_BROAD_SUPPORT = new Set(Object.keys(INDIC_LANGUAGES));

// ─── useVoice Hook ────────────────────────────────────────────
function useVoice({ lang, onTranscript }) {
  const [listening,        setListening]  = useState(false);
  const [speaking,         setSpeaking]   = useState(false);
  const [sttSupported,     setSttSup]     = useState(false);
  const [ttsSupported,     setTtsSup]     = useState(false);
  const [ttsEnabled,       setTts]        = useState(true);
  const [availableVoices,  setVoices]     = useState([]);
  const [ttsSupportedLangs,setTtsSuppLangs] = useState(new Set());
  const [sttError,         setSttError]   = useState('');  // last STT error message

  const recogRef  = useRef(null);
  const synthRef  = useRef(window.speechSynthesis);
  const voicesRef = useRef([]);

  // ── Load voices (async in Chrome) ──
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSttSup(!!SR);
    setTtsSup(!!window.speechSynthesis);

    if (!window.speechSynthesis) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        voicesRef.current = v;
        setVoices(v);
        setTtsSuppLangs(getSupportedTTSCodes(v));
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    // Retry a few times for browsers that are slow to load voices
    const t1 = setTimeout(loadVoices, 500);
    const t2 = setTimeout(loadVoices, 1500);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // ── Clear STT error after 4s ──
  useEffect(() => {
    if (!sttError) return;
    const t = setTimeout(() => setSttError(''), 4000);
    return () => clearTimeout(t);
  }, [sttError]);

  // ── STT: Start Listening ──
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSttError('Speech recognition not supported in this browser.'); return; }

    // Cancel any ongoing TTS first
    synthRef.current?.cancel();

    const cfg     = INDIC_LANGUAGES[lang] || INDIC_LANGUAGES.eng_Latn;
    const primary = cfg.speech;           // e.g. "hi-IN"
    const alts    = cfg.speechAlts || []; // e.g. ["hi"]

    // We attempt the preferred language; if the browser rejects it we retry with en-US
    const tryStart = (langCode, isRetry = false) => {
      const r = new SR();
      recogRef.current = r;

      r.lang            = langCode;
      r.continuous      = false;
      r.interimResults  = false;
      r.maxAlternatives = 1;

      r.onstart  = () => { setListening(true); setSttError(''); };
      r.onend    = () => setListening(false);

      r.onerror  = (e) => {
        setListening(false);
        if (e.error === 'language-not-supported' || e.error === 'not-allowed') {
          if (!isRetry && langCode !== 'en-US') {
            // Try next alt, then fall back to en-US
            const nextAlt = alts.find(a => a !== langCode);
            if (nextAlt) { tryStart(nextAlt, false); return; }
            tryStart('en-US', true);
            setSttError(`${cfg.name} STT unavailable — using English instead.`);
          } else if (e.error === 'not-allowed') {
            setSttError('Microphone access denied. Check browser permissions.');
          } else {
            setSttError('Speech recognition unavailable in this browser.');
          }
        } else if (e.error === 'no-speech') {
          setSttError('No speech detected. Try speaking closer to the mic.');
        } else if (e.error !== 'aborted') {
          setSttError(`Mic error: ${e.error}`);
        }
      };

      r.onresult = (e) => {
        const transcript = e.results[0]?.[0]?.transcript || '';
        if (transcript.trim()) onTranscript(transcript);
      };

      try { r.start(); } catch (err) {
        setSttError('Could not start microphone: ' + err.message);
      }
    };

    tryStart(primary);
  }, [lang, onTranscript]);

  const stopListening = useCallback(() => {
    try { recogRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  // ── TTS: Speak ──
  const speak = useCallback((text, langCode) => {
    if (!ttsEnabled || !window.speechSynthesis || !text?.trim()) return;

    synthRef.current.cancel();

    const cfg = INDIC_LANGUAGES[langCode || lang] || INDIC_LANGUAGES.eng_Latn;
    const allCodes = [cfg.speech, ...(cfg.speechAlts || [])];

    // Find the best available voice
    const voices  = voicesRef.current;
    let bestVoice = null;
    for (const code of allCodes) {
      bestVoice = findBestVoice(voices, code);
      if (bestVoice) break;
    }

    const utt    = new SpeechSynthesisUtterance(text);
    utt.rate     = 0.92;
    utt.pitch    = 1.0;
    utt.volume   = 1.0;

    if (bestVoice) {
      utt.voice = bestVoice;
      utt.lang  = bestVoice.lang;
    } else {
      // No native voice — use the lang code anyway; browser may still handle it
      utt.lang  = cfg.speech;
    }

    utt.onstart = () => setSpeaking(true);
    utt.onend   = () => setSpeaking(false);
    utt.onerror = (e) => {
      setSpeaking(false);
      // Silently ignore cancelled errors (user stopped manually)
      if (e.error !== 'cancelled' && e.error !== 'interrupted') {
        console.warn('TTS error:', e.error);
      }
    };

    synthRef.current.speak(utt);
  }, [ttsEnabled, lang]);

  const stopSpeaking = useCallback(() => {
    try { synthRef.current?.cancel(); } catch {}
    setSpeaking(false);
  }, []);

  // Whether current language has TTS support
  const currentLangHasTTS = ttsSupportedLangs.has(lang);

  return {
    listening,
    speaking,
    sttSupported,
    ttsSupported,
    ttsEnabled,
    setTts,
    availableVoices,
    ttsSupportedLangs,
    currentLangHasTTS,
    sttError,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}

// ─── Language Dropdown ────────────────────────────────────────
function LanguageDropdown({ value, onChange, compact = false, ttsSupportedLangs }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const cur = INDIC_LANGUAGES[value] || INDIC_LANGUAGES.eng_Latn;

  return (
    <div className="lang-dropdown" ref={ref}>
      <button className="lang-trigger" onClick={() => setOpen(p => !p)}>
        <span className="lang-flag">{cur.flag}</span>
        {!compact && <span className="lang-native-text">{cur.native}</span>}
        <Languages size={12} className="lang-icon"/>
        <ChevronDown size={11} className={`lang-chevron ${open ? 'open' : ''}`}/>
      </button>
      {open && (
        <div className="lang-menu">
          <div className="lang-menu-title"><Languages size={12}/> Choose Language</div>
          {Object.entries(INDIC_LANGUAGES).map(([code, l]) => {
            const hasTTS = ttsSupportedLangs?.has(code);
            return (
              <button key={code}
                className={`lang-item ${value === code ? 'active' : ''}`}
                onClick={() => { onChange(code); setOpen(false); }}>
                <span className="lang-item-flag">{l.flag}</span>
                <div className="lang-item-info">
                  <span className="lang-item-name">{l.name}</span>
                  <span className="lang-item-native">{l.native}</span>
                </div>
                <div className="lang-item-badges">
                  {/* Always show mic (STT always attempted) */}
                  <span className="lang-badge stt" title="Voice input supported">
                    <Mic size={9}/>
                  </span>
                  {/* TTS badge only if browser has a voice for this lang */}
                  {hasTTS
                    ? <span className="lang-badge tts" title="Text-to-speech supported">
                        <Volume2 size={9}/>
                      </span>
                    : <span className="lang-badge no-tts" title="No TTS voice installed for this language">
                        <VolumeX size={9}/>
                      </span>
                  }
                  {value === code && <Check size={12} className="lang-check"/>}
                </div>
              </button>
            );
          })}
          <div className="lang-menu-footer">
            <Mic size={10}/> = voice input &nbsp;·&nbsp;
            <Volume2 size={10}/> = text-to-speech
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Emotion Badge ────────────────────────────────────────────
function EmotionBadge({ emotion }) {
  if (!emotion) return null;
  const dom  = emotion.dominant_emotion || 'neutral';
  const meta = EMOTION_META[dom] || EMOTION_META.neutral;
  const pct  = Math.round((emotion.confidence || 0) * 100);
  return (
    <div className="emotion-badge" style={{ background: meta.bg, borderColor: `${meta.color}55` }}>
      <span>{meta.emoji}</span>
      <span style={{ color: meta.color, fontWeight: 700 }}>{dom}</span>
      <span style={{ color: meta.color, opacity: .7 }}>{pct}%</span>
      {emotion.stress_level && emotion.stress_level !== 'low' && (
        <span className="stress-tag" style={{ background: `${meta.color}22`, color: meta.color }}>
          {emotion.stress_level} stress
        </span>
      )}
    </div>
  );
}

// ─── Image / Emotion Panel ────────────────────────────────────
function ImageEmotionPanel({ onAttach, onClose }) {
  const [mode,      setMode]    = useState('upload');
  const [preview,   setPreview] = useState(null);
  const [b64,       setB64]     = useState(null);
  const [analyzing, setAnal]    = useState(false);
  const [result,    setResult]  = useState(null);
  const [error,     setError]   = useState('');
  const fileRef   = useRef(null);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => stopCam(), []);

  const stopCam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const handleFile = file => {
    if (!file?.type.startsWith('image/')) { setError('Select a JPG / PNG / WEBP image.'); return; }
    if (file.size > 10*1024*1024) { setError('Image must be under 10 MB.'); return; }
    setError('');
    const r = new FileReader();
    r.onload = e => { setPreview(e.target.result); setB64(e.target.result); setResult(null); };
    r.readAsDataURL(file);
  };

  const startCam = async () => {
    setMode('camera'); setError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user' } });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch { setError('Camera access denied.'); setMode('upload'); }
  };

  const snap = () => {
    if (!videoRef.current) return;
    const c = document.createElement('canvas');
    c.width  = videoRef.current.videoWidth;
    c.height = videoRef.current.videoHeight;
    c.getContext('2d').drawImage(videoRef.current, 0, 0);
    const d = c.toDataURL('image/jpeg', 0.9);
    setPreview(d); setB64(d); setResult(null); stopCam(); setMode('upload');
  };

  const analyze = async () => {
    if (!b64) return;
    setAnal(true); setError('');
    try {
      const res = await fetch(`${API}/analyze-emotion/`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ image_data: b64 })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Analysis failed');
      setResult(d);
    } catch(e) { setError(e.message); }
    setAnal(false);
  };

  return (
    <div className="img-panel-overlay" onClick={onClose}>
      <div className="img-panel" onClick={e => e.stopPropagation()}>
        <div className="img-panel-header">
          <div className="img-panel-title"><Camera size={16}/> Emotion Detection</div>
          <button className="img-panel-close" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="img-mode-tabs">
          <button className={`img-mode-tab ${mode==='upload'?'active':''}`}
            onClick={() => { setMode('upload'); stopCam(); }}>
            <ImageIcon size={14}/> Upload
          </button>
          <button className={`img-mode-tab ${mode==='camera'?'active':''}`} onClick={startCam}>
            <Camera size={14}/> Camera
          </button>
        </div>
        {mode === 'camera' && (
          <div className="cam-area">
            <video ref={videoRef} autoPlay playsInline className="cam-video"/>
            <button className="btn-snap" onClick={snap}><Camera size={16}/> Capture</button>
          </div>
        )}
        {mode === 'upload' && (
          <div
            className={`img-drop-zone ${preview ? 'has-preview' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
            onDragLeave={e => e.currentTarget.classList.remove('drag')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag'); handleFile(e.dataTransfer.files[0]); }}>
            {preview
              ? <img src={preview} alt="preview" className="img-preview"/>
              : <>
                  <ImageIcon size={38} strokeWidth={1} className="drop-icon"/>
                  <div className="drop-text">Drop image or click to browse</div>
                  <div className="drop-sub">JPG · PNG · WEBP · max 10 MB</div>
                </>}
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
              onChange={e => handleFile(e.target.files[0])}/>
          </div>
        )}
        {error && <div className="img-error"><AlertCircle size={14}/>{error}</div>}
        {result && (() => {
          const dom  = result.dominant_emotion || 'neutral';
          const meta = EMOTION_META[dom] || EMOTION_META.neutral;
          const pct  = Math.round((result.confidence || 0) * 100);
          return (
            <div className="emotion-result">
              <div className="emotion-result-top" style={{ background: meta.bg }}>
                <span className="emotion-result-emoji">{meta.emoji}</span>
                <div>
                  <div className="emotion-result-dom" style={{ color: meta.color }}>{dom.toUpperCase()}</div>
                  <div className="emotion-result-conf">{pct}% confidence · {result.stress_level||'low'} stress</div>
                </div>
              </div>
              {result.emotions && (
                <div className="emotion-bars">
                  {Object.entries(result.emotions).sort((a,b)=>b[1]-a[1]).slice(0,5)
                    .map(([em,val]) => (
                      <div key={em} className="emotion-bar-row">
                        <span className="emotion-bar-label">{em}</span>
                        <div className="emotion-bar-track">
                          <div className="emotion-bar-fill"
                            style={{width:`${Math.round(val*100)}%`,
                              background:(EMOTION_META[em]||{}).color||'var(--primary)'}}/>
                        </div>
                        <span className="emotion-bar-pct">{Math.round(val*100)}%</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })()}
        <div className="img-panel-actions">
          {preview && !result && (
            <button className="btn-analyze" onClick={analyze} disabled={analyzing}>
              {analyzing ? <Loader size={14} className="spin"/> : <Zap size={14}/>}
              {analyzing ? 'Analyzing…' : 'Analyze Emotion'}
            </button>
          )}
          {preview && (
            <button className="btn-attach" onClick={() => { if (b64) { onAttach({base64:b64,preview,result}); onClose(); } }}>
              <Check size={14}/> Attach to Message
            </button>
          )}
          {preview && (
            <button className="btn-ghost-sm"
              onClick={() => { setPreview(null); setB64(null); setResult(null); }}>
              <Trash2 size={13}/> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────
function AuthScreen({ onLogin, theme, toggleTheme }) {
  const [tab,     setTab]    = useState('login');
  const [form,    setForm]   = useState({ name:'', username:'', email:'', password:'', phone:'' });
  const [ecForm,  setEcForm] = useState({ name:'', phone:'', email:'', relationship:'', show:false, saved:false });
  const [consent, setConsent]= useState(false);
  const [error,   setError]  = useState('');
  const [loading, setLoad]   = useState(false);
  const [showPw,  setShowPw] = useState(false);

  const set   = k => e => setForm(p  => ({...p, [k]: e.target.value}));
  const setEc = k => e => setEcForm(p => ({...p, [k]: e.target.value}));

  const saveEc = () => {
    if (!ecForm.name || (!ecForm.phone && !ecForm.email)) {
      setError('Contact needs a name + phone or email.'); return;
    }
    if (!consent) { setError('Please tick the consent checkbox.'); return; }
    setEcForm(p => ({...p, saved:true, show:false}));
    setError('');
  };

  const submit = async () => {
    setError('');
    if (!form.username.trim() || !form.password.trim()) {
      setError('Username and password required.'); return;
    }
    if (tab === 'signup' && !form.name.trim()) {
      setError('Full name required.'); return;
    }
    setLoad(true);
    try {
      if (tab === 'login') {
        const res  = await fetch(`${API}/login/`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ username:form.username, password:form.password })
        });
        const data = await res.json();
        if (!res.ok) { setError(data.detail || 'Incorrect credentials.'); return; }
        onLogin(data);
      } else {
        const body = {
          username:form.username, password:form.password,
          full_name:form.name, email:form.email||undefined, phone:form.phone||undefined
        };
        if (ecForm.saved) {
          body.emergency_contact_name         = ecForm.name;
          body.emergency_contact_phone        = ecForm.phone;
          body.emergency_contact_email        = ecForm.email;
          body.emergency_contact_relationship = ecForm.relationship;
        }
        const res  = await fetch(`${API}/users/`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) { setError(data.detail || 'Registration failed.'); return; }
        const lr = await fetch(`${API}/login/`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ username:form.username, password:form.password })
        });
        const ld = await lr.json();
        if (lr.ok) onLogin(ld); else setError('Account created! Please sign in.');
      }
    } catch { setError('Network error — is the backend running?'); }
    finally  { setLoad(false); }
  };

  return (
    <div className="login-container" data-theme={theme}>
      <div className="login-backdrop"/>
      <div className="auth-orbs">
        <div className="orb orb1"/><div className="orb orb2"/><div className="orb orb3"/>
      </div>
      <button className="theme-toggle-floating" onClick={toggleTheme}>
        {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
      </button>
      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <div className="brand-icon">
              <Brain strokeWidth={1.4} style={{width:'100%',height:'100%'}}/>
            </div>
            <h1>MindfulAI</h1>
            <p className="tagline">Your compassionate mental wellness companion</p>
          </div>
          <div className="auth-tabs-row">
            {['login','signup'].map(t => (
              <button key={t}
                className={`auth-tab ${tab===t?'active':''}`}
                onClick={() => { setTab(t); setError(''); }}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
          {error && (
            <div className="auth-error"><AlertCircle size={16}/><span>{error}</span></div>
          )}
          {tab === 'signup' && (
            <div className="input-group">
              <label>Full Name</label>
              <input type="text" placeholder="Your full name"
                value={form.name} onChange={set('name')}/>
            </div>
          )}
          <div className="input-group">
            <label>Username</label>
            <input type="text" placeholder="Choose a username"
              value={form.username} onChange={set('username')}
              onKeyDown={e => e.key==='Enter' && submit()}/>
          </div>
          {tab === 'signup' && <>
            <div className="input-group">
              <label>Email <em>(optional)</em></label>
              <input type="email" placeholder="your@email.com"
                value={form.email} onChange={set('email')}/>
            </div>
            <div className="input-group">
              <label>Phone <em>(optional)</em></label>
              <input type="tel" placeholder="+91 99999 00000"
                value={form.phone} onChange={set('phone')}/>
            </div>
          </>}
          <div className="input-group">
            <label>Password</label>
            <div className="pw-field">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Password"
                value={form.password} onChange={set('password')}
                onKeyDown={e => e.key==='Enter' && submit()}/>
              <button className="pw-toggle" onClick={() => setShowPw(p=>!p)}>
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>
          {tab === 'signup' && (
            <div className="ec-prompt">
              <div className="ec-prompt-title">
                <Shield size={14}/>
                Emergency Contact
                <em>(Recommended)</em>
              </div>
              <p>Add someone to notify if our AI detects a mental health crisis.</p>
              {ecForm.saved ? (
                <div className="ec-saved">
                  <div className="ec-saved-check"><Check size={14}/></div>
                  <div>
                    <div className="ec-saved-name">✓ {ecForm.name}</div>
                    <div className="ec-saved-detail">
                      {ecForm.relationship && `${ecForm.relationship} · `}
                      {ecForm.phone || ecForm.email}
                    </div>
                  </div>
                </div>
              ) : ecForm.show ? (
                <div className="ec-form">
                  <div className="ec-field">
                    <label>Contact Name *</label>
                    <input type="text" placeholder="e.g. Mom, Best Friend"
                      value={ecForm.name} onChange={setEc('name')}/>
                  </div>
                  <div className="ec-row">
                    <div className="ec-field">
                      <label>Phone</label>
                      <input type="tel" placeholder="+1 555-0000"
                        value={ecForm.phone} onChange={setEc('phone')}/>
                    </div>
                    <div className="ec-field">
                      <label>Email</label>
                      <input type="email" placeholder="email@..."
                        value={ecForm.email} onChange={setEc('email')}/>
                    </div>
                  </div>
                  <div className="ec-field">
                    <label>Relationship</label>
                    <input type="text" placeholder="Parent, Friend…"
                      value={ecForm.relationship} onChange={setEc('relationship')}/>
                  </div>
                  <label className="ec-consent">
                    <input type="checkbox" checked={consent}
                      onChange={e => setConsent(e.target.checked)}/>
                    I consent to this contact being notified only in confirmed crisis situations.
                  </label>
                  <div className="ec-actions">
                    <button className="btn-save-ec" onClick={saveEc}>
                      <Check size={13}/> Save Contact
                    </button>
                    <button className="btn-ghost"
                      onClick={() => setEcForm(p=>({...p,show:false}))}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn-add-ec"
                  onClick={() => setEcForm(p=>({...p,show:true}))}>
                  <Plus size={13}/> Add Emergency Contact
                </button>
              )}
            </div>
          )}
          <button className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? <Loader size={17} className="spin"/> : <Send size={17}/>}
            {loading
              ? (tab==='login' ? 'Signing in…' : 'Creating account…')
              : (tab==='login' ? 'Sign In' : 'Create Account')}
          </button>
          <div className="auth-switch">
            {tab === 'login'
              ? <>No account? <button className="link-button"
                  onClick={() => { setTab('signup'); setError(''); }}>Sign up free</button></>
              : <>Have an account? <button className="link-button"
                  onClick={() => { setTab('login'); setError(''); }}>Sign in</button></>}
          </div>
          <div className="features-grid">
            {[
              {icon:<Brain size={24} strokeWidth={1.4}/>,     title:'AI Powered',    sub:'Agentic RAG'},
              {icon:<Shield size={24} strokeWidth={1.4}/>,    title:'Crisis Safe',   sub:'Real-time alerts'},
              {icon:<Languages size={24} strokeWidth={1.4}/>, title:'12 Languages',  sub:'Indic + English'},
              {icon:<Camera size={24} strokeWidth={1.4}/>,    title:'Emotion AI',    sub:'Face detection'},
              {icon:<Mic size={24} strokeWidth={1.4}/>,       title:'Voice',         sub:'STT + TTS'},
            ].map((f,i) => (
              <div key={i} className="feature-item">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────
function TaskCard({ task, onUpdate, done }) {
  const cats = {
    exercise:   {bg:'rgba(251,191,36,0.12)',color:'#fbbf24',  icon:<Activity size={15}/>},
    mindfulness:{bg:'rgba(155,136,219,0.12)',color:'#b3a7ff', icon:<Leaf size={15}/>},
    social:     {bg:'rgba(52,211,153,0.12)', color:'#34d399', icon:<MessageCircle size={15}/>},
    sleep:      {bg:'rgba(110,181,181,0.12)',color:'#6eb5b5', icon:<Clock size={15}/>},
    nutrition:  {bg:'rgba(251,113,133,0.12)',color:'#fb7185', icon:<Coffee size={15}/>},
  };
  const cat = cats[task.category?.toLowerCase()] ||
    {bg:'rgba(155,136,219,0.08)',color:'var(--text-secondary)',icon:<Target size={15}/>};
  const id  = task.task_id || task.id;

  return (
    <div className="task-item" style={{opacity: done ? 0.6 : 1}}>
      <div className="task-cat-icon" style={{background:cat.bg,color:cat.color}}>
        {cat.icon}
      </div>
      <div className="task-info">
        <div className="task-name">{task.title || task.task || task.name}</div>
        {task.description && (
          <div className="task-desc">{task.description}</div>
        )}
        <div className="task-meta">
          {task.category && (
            <span className="task-meta-badge" style={{color:cat.color,borderColor:`${cat.color}44`}}>
              {task.category}
            </span>
          )}
          {task.duration && (
            <span className="task-meta-badge"><Clock size={9}/> {task.duration}</span>
          )}
          <span className="task-meta-badge">
            {(task.status||'').replace('_',' ')}
          </span>
        </div>
      </div>
      {!done ? (
        <div className="task-actions">
          {task.status === 'not_started' && (
            <button className="task-action-btn start"
              onClick={() => onUpdate(id,'in_progress')} title="Start">
              <Play size={11}/>
            </button>
          )}
          <button className="task-action-btn complete"
            onClick={() => onUpdate(id,'completed')} title="Done">
            <Check size={11}/>
          </button>
          <button className="task-action-btn skip"
            onClick={() => onUpdate(id,'skipped')} title="Skip">
            <Minus size={11}/>
          </button>
        </div>
      ) : (
        <CheckCircle size={17} strokeWidth={2} className="task-done-ico"/>
      )}
    </div>
  );
}

// ─── Voice Panel (sidebar section) ───────────────────────────
function VoiceSidebarSection({ voice, lang }) {
  const cfg = INDIC_LANGUAGES[lang] || INDIC_LANGUAGES.eng_Latn;
  const hasTTS = voice.ttsSupportedLangs.has(lang);

  return (
    <div className="sidebar-section">
      <span className="section-label"><Mic size={10}/> Voice</span>
      <div className="voice-controls">

        {/* Status row */}
        <div className="voice-status-row">
          <div className={`voice-dot ${voice.listening?'listening':voice.speaking?'speaking':'idle'}`}/>
          <span className="voice-status-text">
            {voice.listening
              ? `Listening in ${cfg.name}…`
              : voice.speaking
                ? `Speaking in ${cfg.name}…`
                : 'Ready'}
          </span>
        </div>

        {/* TTS capability for this language */}
        <div className="voice-lang-caps">
          <div className="voice-cap-row">
            <Mic size={11}/>
            <span>Speech input</span>
            <span className="voice-cap-badge always">Always on</span>
          </div>
          <div className="voice-cap-row">
            <Volume2 size={11}/>
            <span>Read aloud</span>
            {hasTTS
              ? <span className="voice-cap-badge supported">Supported</span>
              : <span className="voice-cap-badge unsupported">No voice installed</span>
            }
          </div>
        </div>

        {/* TTS toggle (only meaningful when supported) */}
        <div className="voice-toggle-row">
          <span>Auto-read replies</span>
          <button
            className={`voice-tts-toggle ${voice.ttsEnabled && hasTTS ? 'on' : ''}`}
            onClick={() => voice.setTts(p => !p)}
            disabled={!hasTTS}
            title={!hasTTS ? `No TTS voice for ${cfg.name} in this browser` : ''}>
            {voice.ttsEnabled && hasTTS ? <Volume2 size={13}/> : <VolumeX size={13}/>}
            {voice.ttsEnabled && hasTTS ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* STT error pill */}
        {voice.sttError && (
          <div className="voice-stt-error">
            <AlertCircle size={11}/>
            <span>{voice.sttError}</span>
          </div>
        )}

        {/* No TTS hint */}
        {!hasTTS && (
          <div className="voice-no-tts-hint">
            <Info size={10}/>
            <span>
              Install a {cfg.name} TTS voice in your OS to enable read-aloud for this language.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  const [theme,      setTheme]    = useState('dark');
  const [user,       setUser]     = useState(null);
  const [activeView, setView]     = useState('chat');
  const [messages,   setMessages] = useState([]);
  const [input,      setInput]    = useState('');
  const [loading,    setLoading]  = useState(false);
  const [lang,       setLang]     = useState('eng_Latn');

  const [showImgPanel,  setShowImg]  = useState(false);
  const [attachedImage, setAttached] = useState(null);

  const [mood,        setMood]    = useState(5);
  const [moodNotes,   setMoodN]   = useState('');
  const [moodOpen,    setMoodOp]  = useState(false);
  const [moodHistory, setMoodHi]  = useState([]);

  const [tasks,        setTasks]   = useState([]);
  const [profile,      setProfile] = useState(null);
  const [crisisBanner, setCrisis]  = useState(null);
  const [ragStats,     setRag]     = useState(null);
  const [uploadFile,   setUpFile]  = useState(null);
  const [uploadStatus, setUpSt]    = useState(null);
  const [clearStatus,  setClearSt] = useState(null);
  const [crisisTest,   setCtTest]  = useState({text:'',result:null,loading:false});
  const [userLocation, setUserLoc] = useState(null); // {latitude, longitude, location_name}
  const [ecForm,       setEcForm]  = useState({name:'',phone:'',email:'',relationship:'',show:false,saved:false});

  const endRef      = useRef(null);
  const fileRef     = useRef(null);
  const taRef       = useRef(null);
  const locationRef = useRef(null); // always-current copy of userLocation

  // Voice — pass lang so hook can react to language changes
  const handleTranscript = useCallback(text => {
    setInput(p => p ? `${p} ${text}` : text);
  }, []);
  const voice = useVoice({ lang, onTranscript: handleTranscript });

  useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = `${taRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!user) return;
    setMessages([{
      role:'assistant', id:1, lang:'eng_Latn',
      content:`Hello${user.full_name?`, ${user.full_name.split(' ')[0]}`:''}! 👋 I'm MindfulAI — your compassionate wellness companion. How are you feeling today?`,
      badges:[],
    }]);
    loadMood(); loadTasks(); loadProfile(); fetchUserLocation();
    if (user.is_admin) loadRagStats();
  }, [user]);

  // ── Geolocation helper ──
  const fetchUserLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        let location_name = null;
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (r.ok) {
            const geo = await r.json();
            const a = geo.address || {};
            location_name = [a.city||a.town||a.village, a.state, a.country]
              .filter(Boolean).join(', ');
          }
        } catch {}
        const loc = { latitude, longitude, location_name };
        setUserLoc(loc);
        locationRef.current = loc;
      },
      () => {} // silently ignore denied
    );
  };

  const loadMood     = async () => { try { const r=await fetch(`${API}/mood/${user.id}`); if(r.ok) setMoodHi(await r.json()); } catch{} };
  const loadTasks    = async () => { try { const r=await fetch(`${API}/api/tasks/db_user_${user.id}`); if(r.ok){const d=await r.json();setTasks(d.tasks||[]);} } catch{} };
  const loadProfile  = async () => { try { const r=await fetch(`${API}/profile/${user.id}`); if(r.ok) setProfile(await r.json()); } catch{} };
  const loadRagStats = async () => { try { const r=await fetch(`${API}/api/admin/rag-stats`); if(r.ok) setRag(await r.json()); } catch{} };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const text   = input.trim();
    const imgAtt = attachedImage;
    setMessages(p => [...p, {role:'user', id:Date.now(), content:text, badges:[], attachedImage:imgAtt}]);
    setInput(''); setAttached(null); setLoading(true); setCrisis(null);
    try {
      const body = {user_id:user.id, message:text, language:lang};
      if (imgAtt?.base64) body.image_data = imgAtt.base64;
      // Use ref (always current) not state (may lag behind render)
      const loc = locationRef.current;
      if (loc) {
        body.latitude      = loc.latitude;
        body.longitude     = loc.longitude;
        body.location_name = loc.location_name;
      } else {
        // Location not yet resolved — try an immediate high-accuracy fix
        try {
          const pos = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej,
              { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 })
          );
          body.latitude      = pos.coords.latitude;
          body.longitude     = pos.coords.longitude;
          body.location_name = null;
          locationRef.current = { latitude: pos.coords.latitude,
                                  longitude: pos.coords.longitude,
                                  location_name: null };
        } catch {}
      }
      const res  = await fetch(`${API}/chat/`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });
      const data = await res.json();
      const badges = [];
      if (data.rag_used) badges.push({type:'rag',label:'Knowledge Base'});
      data.tools_used?.forEach(t => badges.push({type:'tool',label:t}));
      const aiText = data.response || data.message || 'I hear you.';
      setMessages(p => [...p, {
        role:'assistant', id:Date.now()+1, lang,
        content:aiText, badges,
        emotion:data.emotion,
        originalResponse:data.original_response,
      }]);
      if (data.crisis && data.crisis.risk_level !== 'low') setCrisis(data.crisis);
      // Only speak if current language has TTS support
      if (voice.ttsEnabled && voice.currentLangHasTTS) {
        voice.speak(aiText, lang);
      }
    } catch {
      setMessages(p => [...p, {
        role:'assistant', id:Date.now()+2, badges:[],
        content:"I'm having trouble connecting right now. Please try again.",
      }]);
    }
    setLoading(false);
  };

  const saveMood = async () => {
    try {
      await fetch(`${API}/mood/`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({user_id:user.id, score:mood, notes:moodNotes})
      });
      setMoodN(''); loadMood();
    } catch{}
  };

  const updateTask = async (taskId, status) => {
    try {
      await fetch(`${API}/api/tasks/db_user_${user.id}/${taskId}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({status})
      });
      loadTasks();
    } catch{}
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    const fd = new FormData(); fd.append('file', uploadFile);
    try {
      const res = await fetch(`${API}/api/admin/upload-csv`, {method:'POST',body:fd});
      const d   = await res.json();
      setUpSt({ok:res.ok, msg:d.message||(res.ok?'Uploaded!':'Failed.')});
      if (res.ok) { setUpFile(null); loadRagStats(); }
    } catch { setUpSt({ok:false,msg:'Upload failed.'}); }
  };

  const clearKnowledge = async () => {
    if (!confirm('Delete ALL knowledge base documents? This cannot be undone.')) return;
    try {
      const r = await fetch(`${API}/api/admin/clear-knowledge`,{method:'DELETE'});
      const d = await r.json();
      setClearSt({ok:r.ok,msg:d.message||'Done.'});
      loadRagStats();
    } catch{}
  };

  const testCrisis = async () => {
    if (!crisisTest.text.trim()) return;
    setCtTest(p => ({...p,loading:true,result:null}));
    try {
      const res = await fetch(`${API}/crisis-detect/`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          message:crisisTest.text, user_id:user.id,
          ...(locationRef.current ? {
            latitude:      locationRef.current.latitude,
            longitude:     locationRef.current.longitude,
            location_name: locationRef.current.location_name,
          } : {})
        })
      });
      const result = await res.json();
      setCtTest(p => ({...p,loading:false,result}));
    } catch { setCtTest(p => ({...p,loading:false,result:{error:'Test failed.'}})); }
  };

  const saveEcContact = async () => {
    if (!ecForm.name || (!ecForm.phone && !ecForm.email)) return;
    try {
      await fetch(`${API}/crisis-contact/`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          user_id:user.id,
          emergency_contact_name:ecForm.name,
          emergency_contact_phone:ecForm.phone,
          emergency_contact_email:ecForm.email,
          emergency_contact_relationship:ecForm.relationship,
        })
      });
      setEcForm(p => ({...p,saved:true,show:false}));
    } catch{}
  };

  if (!user) return (
    <AuthScreen
      onLogin={setUser}
      theme={theme}
      toggleTheme={() => setTheme(p => p==='dark'?'light':'dark')}
    />
  );

  const pendingTasks = tasks.filter(t => t.status==='not_started'||t.status==='in_progress');
  const doneTasks    = tasks.filter(t => t.status==='completed');

  const VIEWS = [
    {id:'chat',    label:'Chat',             icon:<MessageCircle size={16}/>},
    {id:'mood',    label:'Mood History',     icon:<Activity      size={16}/>},
    {id:'tasks',   label:'Wellness Tasks',   icon:<List          size={16}/>},
    {id:'crisis',  label:'Crisis Detection', icon:<AlertTriangle size={16}/>},
    {id:'profile', label:'My Profile',       icon:<User          size={16}/>},
    {id:'rag',     label:'RAG Pipeline',     icon:<Database      size={16}/>},
    ...(user.is_admin ? [{id:'admin',label:'Admin Portal',icon:<Key size={16}/>,admin:true}] : []),
  ];

  return (
    <div className="app-container" data-theme={theme}>

      {showImgPanel && (
        <ImageEmotionPanel
          onAttach={img => setAttached(img)}
          onClose={() => setShowImg(false)}
        />
      )}

      {/* ═══════════════════ SIDEBAR ═══════════════════ */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon-small">
              <Brain strokeWidth={1.4} style={{width:'100%',height:'100%'}}/>
            </div>
            <div>
              <h2>MindfulAI</h2>
              <span className="user-greeting">
                Hi, {user.full_name?.split(' ')[0] || user.username} 👋
              </span>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="sidebar-section">
          <span className="section-label"><Languages size={10}/> Language</span>
          <LanguageDropdown
            value={lang}
            onChange={setLang}
            ttsSupportedLangs={voice.ttsSupportedLangs}
          />
          {lang !== 'eng_Latn' && (
            <div className="lang-active-hint">
              <Sparkles size={10}/> Responses in {INDIC_LANGUAGES[lang]?.native}
            </div>
          )}
        </div>

        {/* Voice Controls */}
        {(voice.sttSupported || voice.ttsSupported) && (
          <VoiceSidebarSection voice={voice} lang={lang}/>
        )}

        {/* Navigation */}
        <div className="sidebar-section">
          <span className="section-label">Navigation</span>
          {VIEWS.map(v => (
            <button key={v.id}
              className={`feature-btn ${activeView===v.id?'active':''} ${v.admin?'admin-btn':''}`}
              onClick={() => setView(v.id)}>
              {v.icon}
              <span className="feature-btn-label">{v.label}</span>
              {v.admin && <span className="admin-badge-sm">ADMIN</span>}
            </button>
          ))}
        </div>

        {/* Mood check-in */}
        <div className="sidebar-section">
          <span className="section-label">Mood Check-in</span>
          <button
            className={`mood-toggle ${moodOpen?'active':''}`}
            onClick={() => setMoodOp(p=>!p)}>
            <span className="mood-toggle-ico">{getMoodIcon(mood)}</span>
            <span style={{flex:1,textAlign:'left'}}>Log your mood</span>
            <ChevronDown size={14} className={`chevron ${moodOpen?'rotated':''}`}/>
          </button>
          {moodOpen && (
            <div className="mood-tracker">
              <div className="mood-display">
                <div className="mood-emoji">{getMoodIcon(mood)}</div>
                <div className="mood-info">
                  <span className="mood-score">{mood}/10</span>
                  <span className="mood-label-text"> {MOOD_LABELS[mood]}</span>
                </div>
              </div>
              <div className="mood-slider-wrapper">
                <input type="range" min="1" max="10" value={mood}
                  onChange={e => setMood(+e.target.value)} className="mood-slider"/>
                <div className="slider-labels">
                  <span>😢</span><span>😐</span><span>😊</span>
                </div>
              </div>
              <textarea className="mood-notes" rows={2}
                placeholder="Optional notes…"
                value={moodNotes} onChange={e => setMoodN(e.target.value)}/>
              <button className="btn-secondary" onClick={saveMood}>
                <Check size={13}/> Save Mood
              </button>
            </div>
          )}
        </div>

        {/* Recent moods */}
        {moodHistory.length > 0 && (
          <div className="sidebar-section">
            <span className="section-label">Recent Moods</span>
            <div className="mood-history">
              {moodHistory.slice(0,4).map((e,i) => (
                <div key={i} className="mood-entry">
                  <div className="mood-entry-emoji">{getMoodIcon(e.score)}</div>
                  <div className="mood-entry-details">
                    <div className="mood-entry-label">{MOOD_LABELS[e.score]}</div>
                    <div className="mood-entry-time">
                      {new Date(e.timestamp||Date.now()).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mood-entry-score">{e.score}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{flex:1}}/>

        <div className="sidebar-section">
          <button className="theme-toggle"
            onClick={() => setTheme(p=>p==='dark'?'light':'dark')}>
            {theme==='dark' ? <Sun size={15}/> : <Moon size={15}/>}
            {theme==='dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button className="btn-settings" onClick={() => setView('profile')}>
            <Settings size={15}/> Profile &amp; Settings
          </button>
          <button className="btn-logout"
            onClick={() => { setUser(null); setMessages([]); }}>
            <LogOut size={15}/> Sign Out
          </button>
        </div>
      </aside>

      {/* ═══════════════════ MAIN ═══════════════════ */}
      <main className="chat-main">

        {/* ──────── CHAT ──────── */}
        {activeView === 'chat' && <>
          <div className="chat-header">
            <div className="chat-header-content">
              <h2>Wellness Chat</h2>
              <span className="chat-subtitle">
                {lang !== 'eng_Latn'
                  ? `Chatting in ${INDIC_LANGUAGES[lang]?.native}`
                  : 'Your AI companion for mental wellness'}
              </span>
            </div>
            <div className="chat-header-right">
              <LanguageDropdown
                value={lang}
                onChange={setLang}
                compact
                ttsSupportedLangs={voice.ttsSupportedLangs}
              />
              <div className="chat-status">
                <div className="status-indicator"/>
                <span>Online</span>
              </div>
            </div>
          </div>

          {/* Crisis banner */}
          {crisisBanner && (
            <div className="crisis-banner">
              <div className="crisis-banner-icon">⚠️</div>
              <div className="crisis-banner-body">
                <div className="crisis-banner-title">Support Resources Available</div>
                <div className="crisis-banner-sub">
                  {crisisBanner.risk_level==='critical'
                    ? "If you're in immediate danger, please reach out now."
                    : "I'm noticing some distress. These resources may help."}
                </div>
                <div className="crisis-resources">
                  <button className="crisis-res-btn">📞 988 Lifeline</button>
                  <button className="crisis-res-btn">💬 Text HOME to 741741</button>
                  <button className="crisis-res-btn dismiss" onClick={()=>setCrisis(null)}>✕ Dismiss</button>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="messages-container">
            <div className="messages-inner">
              {messages.map(msg => (
                <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                  <div className="message-bubble">
                    {msg.role==='assistant' && (
                      <div className="message-avatar assistant-avatar">
                        <Brain size={17} strokeWidth={1.5}/>
                      </div>
                    )}
                    {msg.role==='user' && (
                      <div className="message-avatar user-avatar" style={{order:2}}>
                        {(user.full_name?.[0]||user.username?.[0]||'U').toUpperCase()}
                      </div>
                    )}
                    <div className="message-content">
                      {msg.attachedImage && (
                        <div className="msg-img-preview">
                          <img src={msg.attachedImage.preview} alt="attached"/>
                          {msg.attachedImage.result && (
                            <EmotionBadge emotion={msg.attachedImage.result}/>
                          )}
                        </div>
                      )}
                      <div className="message-text">{msg.content}</div>
                      {msg.originalResponse && (
                        <div className="msg-original">
                          <span className="msg-original-label">EN:</span> {msg.originalResponse}
                        </div>
                      )}
                      {msg.emotion && <EmotionBadge emotion={msg.emotion}/>}
                      {(msg.badges?.length > 0 || (msg.role==='assistant' && voice.ttsSupported)) && (
                        <div className="msg-meta">
                          {msg.badges?.map((b,i) => (
                            <span key={i} className={`meta-badge ${b.type}`}>
                              {b.type==='rag' && <Database size={9}/>}
                              {b.type==='tool' && <Wrench size={9}/>}
                              {b.label}
                            </span>
                          ))}
                          {/* TTS replay button — show always, dim if lang has no voice */}
                          {msg.role==='assistant' && voice.ttsSupported && (
                            <button
                              className={`msg-tts-btn ${!voice.ttsSupportedLangs.has(msg.lang||'eng_Latn') ? 'no-voice' : ''}`}
                              onClick={() => voice.speak(msg.content, msg.lang||'eng_Latn')}
                              title={
                                voice.ttsSupportedLangs.has(msg.lang||'eng_Latn')
                                  ? 'Read aloud'
                                  : `No TTS voice installed for ${INDIC_LANGUAGES[msg.lang||'eng_Latn']?.name}`
                              }>
                              <Volume2 size={10}/>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message-wrapper assistant">
                  <div className="message-bubble">
                    <div className="message-avatar assistant-avatar">
                      <Brain size={17} strokeWidth={1.5}/>
                    </div>
                    <div className="message-content">
                      <div className="typing-indicator"><span/><span/><span/></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef}/>
            </div>
          </div>

          {/* Attached image strip */}
          {attachedImage && (
            <div className="attached-strip">
              <img src={attachedImage.preview} alt="" className="attached-thumb"/>
              {attachedImage.result && <EmotionBadge emotion={attachedImage.result}/>}
              <span className="attached-label">Image attached</span>
              <button className="attached-remove" onClick={() => setAttached(null)}>
                <X size={13}/>
              </button>
            </div>
          )}

          {/* STT error toast */}
          {voice.sttError && (
            <div className="stt-error-toast">
              <AlertCircle size={13}/>
              <span>{voice.sttError}</span>
            </div>
          )}

          {/* Voice status pill */}
          {voice.ttsSupported && (voice.listening || voice.speaking) && (
            <div className={`voice-status-pill ${voice.listening?'listening':'speaking'}`}>
              <span className="vpill-dot"/>
              {voice.listening
                ? <><MicOff size={13}/> Listening in {INDIC_LANGUAGES[lang]?.name}…</>
                : <><Volume2 size={13}/> Speaking in {INDIC_LANGUAGES[lang]?.name}…</>}
              <button onClick={voice.listening ? voice.stopListening : voice.stopSpeaking}>
                <X size={11}/>
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="input-area">
            <div className="input-container">
              <button
                className={`input-icon-btn ${attachedImage?'has-attach':''}`}
                onClick={() => setShowImg(true)}
                title="Attach image for emotion detection">
                <Camera size={18}/>
                {attachedImage && <span className="attach-dot"/>}
              </button>

              <textarea
                ref={taRef}
                rows={1}
                placeholder={PLACEHOLDERS[lang] || PLACEHOLDERS.eng_Latn}
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
                onKeyDown={e => {
                  if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
              />

              {/* Voice button */}
              {voice.sttSupported && (
                voice.speaking ? (
                  <button className="voice-btn speaking" onClick={voice.stopSpeaking}
                    title="Stop speaking">
                    <VolumeX size={18}/>
                    <span className="voice-ripple"/>
                  </button>
                ) : voice.listening ? (
                  <button className="voice-btn listening" onClick={voice.stopListening}
                    title={`Listening in ${INDIC_LANGUAGES[lang]?.name}`}>
                    <MicOff size={18}/>
                    <span className="voice-ripple"/>
                    <span className="voice-ripple delay"/>
                  </button>
                ) : (
                  <button className="voice-btn idle" onClick={voice.startListening}
                    title={`Speak in ${INDIC_LANGUAGES[lang]?.name}`}>
                    <Mic size={18}/>
                  </button>
                )
              )}

              <button className="btn-send" onClick={sendMessage}
                disabled={loading || !input.trim()}>
                {loading ? <Loader size={17} className="spin"/> : <Send size={17}/>}
              </button>
            </div>
            <div className="input-hint">
              Enter to send · Shift+Enter for new line
              {voice.sttSupported && (
                <> · <Mic size={9} style={{display:'inline',verticalAlign:'middle'}}/> {INDIC_LANGUAGES[lang]?.name} voice</>
              )}
              {voice.ttsSupported && voice.currentLangHasTTS && (
                <> · <Volume2 size={9} style={{display:'inline',verticalAlign:'middle'}}/> auto-read</>
              )}
            </div>
          </div>
        </>}

        {/* ──────── MOOD HISTORY ──────── */}
        {activeView === 'mood' && <>
          <div className="chat-header">
            <div className="chat-header-content">
              <h2>Mood History</h2>
              <span className="chat-subtitle">Track your emotional journey over time</span>
            </div>
            <button className="btn-secondary" onClick={loadMood}
              style={{width:'auto',padding:'8px 16px'}}>
              <RefreshCw size={13}/> Refresh
            </button>
          </div>
          <div className="profile-page">
            {moodHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Activity size={44} strokeWidth={1}/></div>
                <p>No mood entries yet. Use the sidebar slider to log your first mood!</p>
              </div>
            ) : (
              <>
                <div className="stats-row">
                  {[
                    {label:'Total Entries', val:moodHistory.length,               ico:<List size={19}/>},
                    {label:'Average Mood',  val:(moodHistory.reduce((s,e)=>s+e.score,0)/moodHistory.length).toFixed(1), ico:<Activity size={19}/>},
                    {label:'Best Mood',     val:Math.max(...moodHistory.map(e=>e.score)),ico:<TrendingUp size={19}/>},
                  ].map((s,i) => (
                    <div key={i} className="stat-card">
                      <div className="stat-icon">{s.ico}</div>
                      <div className="stat-val">{s.val}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mood-log-list">
                  {[...moodHistory].reverse().map((entry,i) => (
                    <div key={i} className="mood-entry">
                      <div className="mood-entry-emoji">{getMoodIcon(entry.score)}</div>
                      <div className="mood-entry-details">
                        <div className="mood-entry-label">
                          {MOOD_LABELS[entry.score]} — {entry.score}/10
                        </div>
                        {entry.notes && (
                          <div className="mood-entry-notes">{entry.notes}</div>
                        )}
                        <div className="mood-entry-time">
                          {new Date(entry.timestamp||Date.now()).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>}

        {/* ──────── TASKS ──────── */}
        {activeView === 'tasks' && <>
          <div className="chat-header">
            <div className="chat-header-content">
              <h2>Wellness Tasks</h2>
              <span className="chat-subtitle">Personalized activities for your mental health</span>
            </div>
            <button className="btn-secondary" onClick={loadTasks}
              style={{width:'auto',padding:'8px 16px'}}>
              <RefreshCw size={13}/> Refresh
            </button>
          </div>
          <div className="tasks-page">
            {tasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><List size={44} strokeWidth={1}/></div>
                <p>No tasks yet. Chat with me and I'll suggest personalized wellness activities!</p>
              </div>
            ) : (
              <>
                {pendingTasks.length > 0 && (
                  <>
                    <div className="tasks-section-title">
                      <Target size={13}/> Active Tasks ({pendingTasks.length})
                    </div>
                    {pendingTasks.map(t => (
                      <TaskCard key={t.task_id||t.id} task={t} onUpdate={updateTask}/>
                    ))}
                  </>
                )}
                {doneTasks.length > 0 && (
                  <>
                    {pendingTasks.length > 0 && <div className="task-divider"/>}
                    <div className="tasks-section-title">
                      <Check size={13}/> Completed ({doneTasks.length})
                    </div>
                    {doneTasks.map(t => (
                      <TaskCard key={t.task_id||t.id} task={t} onUpdate={updateTask} done/>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </>}

        {/* ──────── CRISIS ──────── */}
        {activeView === 'crisis' && (
          <div className="crisis-detection">
            <div className="crisis-header">
              <h2>Crisis Detection &amp; Safety</h2>
            </div>
            <div className="panel-card">
              <h3><AlertTriangle size={16}/> Test Crisis Detection</h3>
              <p className="panel-sub">Enter a message to test how the AI analyzes it for risk signals.</p>
              <textarea className="panel-textarea"
                placeholder="Enter a test message to analyze…"
                value={crisisTest.text}
                onChange={e => setCtTest(p=>({...p,text:e.target.value}))}
                rows={3}/>
              <button className="btn-primary"
                onClick={testCrisis}
                disabled={crisisTest.loading||!crisisTest.text.trim()}
                style={{width:'auto',padding:'10px 20px'}}>
                {crisisTest.loading ? <Loader size={15} className="spin"/> : <Shield size={15}/>}
                {crisisTest.loading ? 'Analyzing…' : 'Analyze Message'}
              </button>
              {crisisTest.result && !crisisTest.result.error && (
                <div className="crisis-result">
                  <div className="crisis-result-row">
                    <span>Risk Level:</span>
                    <span className={`risk-badge risk-${crisisTest.result.risk_level||'low'}`}>
                      {(crisisTest.result.risk_level||'low').toUpperCase()}
                    </span>
                  </div>
                  {(crisisTest.result.indicators||crisisTest.result.harm_indicators||[]).length > 0 && (
                    <div className="keyword-list">
                      {(crisisTest.result.indicators||crisisTest.result.harm_indicators)
                        .map((k,i) => <span key={i} className="keyword-tag">{k}</span>)}
                    </div>
                  )}
                  {crisisTest.result.response && (
                    <div className="crisis-response-box">{crisisTest.result.response}</div>
                  )}
                </div>
              )}
              {crisisTest.result?.error && (
                <div className="result-banner error">
                  <AlertCircle size={14}/>{crisisTest.result.error}
                </div>
              )}
            </div>
            <div className="panel-card">
              <h3><Phone size={16}/> Emergency Contact</h3>
              {ecForm.saved ? (
                <div className="ec-saved">
                  <div className="ec-saved-check"><Check size={14}/></div>
                  <div>
                    <div className="ec-saved-name">✓ {ecForm.name}</div>
                    <div className="ec-saved-detail">
                      {ecForm.relationship && `${ecForm.relationship} · `}
                      {ecForm.phone || ecForm.email}
                    </div>
                  </div>
                </div>
              ) : ecForm.show ? (
                <div>
                  {[
                    {l:'Contact Name',k:'name',t:'text',p:'e.g. Mom, Therapist'},
                    {l:'Phone',k:'phone',t:'tel',p:'+1 555-0000'},
                    {l:'Email',k:'email',t:'email',p:'contact@email.com'},
                    {l:'Relationship',k:'relationship',t:'text',p:'Parent, Friend…'},
                  ].map(f => (
                    <div key={f.k} className="field-row">
                      <label>{f.l}</label>
                      <input className="panel-input" type={f.t} placeholder={f.p}
                        value={ecForm[f.k]}
                        onChange={e => setEcForm(p=>({...p,[f.k]:e.target.value}))}/>
                    </div>
                  ))}
                  <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
                    <button className="btn-primary" onClick={saveEcContact}
                      style={{width:'auto',padding:'10px 20px'}}>
                      <Check size={14}/> Save Contact
                    </button>
                    <button className="btn-ghost"
                      onClick={() => setEcForm(p=>({...p,show:false}))}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="panel-sub">
                    Add someone to notify automatically if high-risk signals are detected.
                  </p>
                  <button className="btn-secondary"
                    onClick={() => setEcForm(p=>({...p,show:true}))}
                    style={{width:'auto',padding:'10px 18px'}}>
                    <Plus size={14}/> Add Emergency Contact
                  </button>
                </>
              )}
            </div>
            <div className="panel-card">
              <h3><Heart size={16}/> Crisis Resources</h3>
              <div className="emergency-resources">
                <ul>
                  {['📞 988 Suicide & Crisis Lifeline — Call or text 988 (US)',
                    '💬 Crisis Text Line — Text HOME to 741741',
                    '🌐 IASP — iasp.info/resources/Crisis_Centres/',
                    '🏥 NAMI Helpline — 1-800-950-6264',
                    '💙 Online chat — 988lifeline.org/chat',
                  ].map((r,i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              <div className="safety-info">
                Our AI monitors every conversation for crisis signals and can automatically alert your emergency contact for high-risk situations.
              </div>
            </div>
          </div>
        )}

        {/* ──────── PROFILE ──────── */}
        {activeView === 'profile' && <>
          <div className="chat-header">
            <div className="chat-header-content">
              <h2>My Profile</h2>
              <span className="chat-subtitle">Your wellness journey &amp; preferences</span>
            </div>
            <button className="btn-secondary" onClick={loadProfile}
              style={{width:'auto',padding:'8px 16px'}}>
              <RefreshCw size={13}/> Refresh
            </button>
          </div>
          <div className="profile-page">
            <div className="profile-header">
              <div className="profile-avatar">
                {(user.full_name?.[0]||user.username?.[0]||'U').toUpperCase()}
              </div>
              <div>
                <div className="profile-name">{user.full_name || user.username}</div>
                <div className="profile-email">
                  @{user.username}
                  {user.is_admin && <span className="admin-tag">ADMIN</span>}
                </div>
              </div>
              <div className="profile-stats">
                {[
                  {v:moodHistory.length, l:'Mood Logs'},
                  {v:messages.filter(m=>m.role==='user').length, l:'Messages'},
                  {v:doneTasks.length, l:'Tasks Done'},
                ].map((s,i) => (
                  <div key={i} className="profile-stat">
                    <div className="profile-stat-val">{s.v}</div>
                    <div className="profile-stat-label">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="profile-section-card">
              <div className="profile-section-title"><User size={13}/> Account Details</div>
              {user.email && (
                <div className="profile-detail-row">
                  <Mail size={14}/>
                  <a href={`mailto:${user.email}`}>{user.email}</a>
                </div>
              )}
              {user.phone
                ? <div className="profile-detail-row"><Phone size={14}/>
                    <a href={`tel:${user.phone}`}>{user.phone}</a>
                    <em>(included in crisis alerts)</em>
                  </div>
                : <div className="profile-detail-row muted"><Phone size={14}/>No phone number on file</div>}
            </div>
            <div className="profile-section-card">
              <div className="profile-section-title"><Languages size={13}/> Language &amp; Voice</div>
              <div className="lang-pref-row">
                <span className="lang-pref-flag">{INDIC_LANGUAGES[lang]?.flag}</span>
                <div>
                  <div className="lang-pref-name">{INDIC_LANGUAGES[lang]?.name}</div>
                  <div className="lang-pref-native">{INDIC_LANGUAGES[lang]?.native}</div>
                </div>
                <div style={{marginLeft:'auto'}}>
                  <LanguageDropdown
                    value={lang}
                    onChange={setLang}
                    compact
                    ttsSupportedLangs={voice.ttsSupportedLangs}
                  />
                </div>
              </div>
              {/* Voice capability summary */}
              <div className="voice-caps-summary">
                <div className="voice-cap-item">
                  <Mic size={13}/>
                  <span>Voice input: <strong>All 12 languages</strong></span>
                  <span className="voice-cap-note">(browser STT, may fall back to English)</span>
                </div>
                <div className="voice-cap-item">
                  <Volume2 size={13}/>
                  <span>
                    Text-to-speech available in:&nbsp;
                    <strong>
                      {voice.ttsSupportedLangs.size === 0
                        ? 'None detected'
                        : [...voice.ttsSupportedLangs]
                            .map(c => INDIC_LANGUAGES[c]?.name)
                            .join(', ')}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
            {profile?.emergency_contact && (
              <div className="profile-section-card">
                <div className="profile-section-title"><Shield size={13}/> Emergency Contact</div>
                <div className="ec-display">
                  <strong>{profile.emergency_contact.emergency_contact_name}</strong>
                  {profile.emergency_contact.emergency_contact_relationship &&
                    <em> ({profile.emergency_contact.emergency_contact_relationship})</em>}
                  {profile.emergency_contact.emergency_contact_phone && (
                    <div className="profile-detail-row">
                      <Phone size={13}/>
                      <a href={`tel:${profile.emergency_contact.emergency_contact_phone}`}>
                        {profile.emergency_contact.emergency_contact_phone}
                      </a>
                    </div>
                  )}
                  {profile.emergency_contact.emergency_contact_email && (
                    <div className="profile-detail-row">
                      <Mail size={13}/>
                      <a href={`mailto:${profile.emergency_contact.emergency_contact_email}`}>
                        {profile.emergency_contact.emergency_contact_email}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>}

        {/* ──────── RAG PIPELINE ──────── */}
        {activeView === 'rag' && <>
          <div className="chat-header">
            <div className="chat-header-content">
              <h2>RAG Pipeline</h2>
              <span className="chat-subtitle">How our knowledge retrieval system works</span>
            </div>
          </div>
          <div className="profile-page">
            <div className="panel-card">
              <h3><Database size={16}/> Agentic RAG Architecture</h3>
              {[
                {n:1,t:'Message Received',   d:'Your message is received by the LangGraph agent which decides the optimal approach.'},
                {n:2,t:'Intent Analysis',     d:'The agent analyzes emotional content to determine if knowledge retrieval will enhance the response.'},
                {n:3,t:'Knowledge Search',    d:'The search_knowledge_base tool queries ChromaDB using sentence-transformers embeddings.'},
                {n:4,t:'Context Fusion',      d:'Retrieved documents merge with conversation history to create rich contextual input.'},
                {n:5,t:'Emotional Analysis',  d:'analyze_emotional_state tool runs to better understand your current mental state.'},
                {n:6,t:'Strategy Suggestion', d:'suggest_coping_strategies recommends evidence-based techniques if appropriate.'},
                {n:7,t:'Response Generation', d:'Groq LLM generates a compassionate, contextually aware response.'},
              ].map(s => (
                <div key={s.n} className="rag-step">
                  <div className="rag-step-num">{s.n}</div>
                  <div>
                    <div className="rag-step-title">{s.t}</div>
                    <div className="rag-step-desc">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ──────── ADMIN ──────── */}
        {activeView === 'admin' && user.is_admin && <>
          <div className="chat-header">
            <div className="chat-header-content">
              <h2>Admin Portal</h2>
              <span className="chat-subtitle">Knowledge base management &amp; system monitoring</span>
            </div>
            <button className="btn-secondary" onClick={loadRagStats}
              style={{width:'auto',padding:'8px 16px'}}>
              <RefreshCw size={13}/> Refresh
            </button>
          </div>
          <div className="profile-page">
            {ragStats && (
              <div className="admin-grid">
                {[
                  {icon:<Database size={20}/>, label:'Documents', val:ragStats.document_count??ragStats.total_documents??'—'},
                  {icon:<Brain size={20}/>,    label:'Collections',val:ragStats.collection_count??ragStats.collections??'—'},
                  {icon:<Activity size={20}/>, label:'Queries Today',val:ragStats.queries_today??'—'},
                  {icon:<CheckCircle size={20}/>,label:'Status',   val:ragStats.status??'Active'},
                ].map((s,i) => (
                  <div key={i} className="admin-stat">
                    <div className="admin-stat-icon">{s.icon}</div>
                    <div className="admin-stat-val">{s.val}</div>
                    <div className="admin-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="panel-card">
              <h3><Upload size={16}/> Upload Knowledge CSV</h3>
              <p className="panel-sub">CSV format: <code>question, answer</code></p>
              <div
                className={`upload-zone ${uploadFile?'has-file':''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('active'); }}
                onDragLeave={e => e.currentTarget.classList.remove('active')}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('active'); setUpFile(e.dataTransfer.files[0]); setUpSt(null); }}>
                <div className="upload-zone-icon">
                  {uploadFile
                    ? <CheckCircle size={36} strokeWidth={1.5} style={{color:'var(--primary)'}}/>
                    : <Upload size={36} strokeWidth={1}/>}
                </div>
                <div className="upload-zone-text">
                  {uploadFile ? uploadFile.name : 'Drop your CSV here or click to browse'}
                </div>
                <div className="upload-zone-sub">
                  {uploadFile ? `${(uploadFile.size/1024).toFixed(1)} KB ready` : 'Supports .csv files'}
                </div>
                <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}}
                  onChange={e => { setUpFile(e.target.files[0]); setUpSt(null); }}/>
              </div>
              {uploadStatus && (
                <div className={`result-banner ${uploadStatus.ok?'success':'error'}`}>
                  {uploadStatus.ok ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                  {uploadStatus.msg}
                </div>
              )}
              <div style={{display:'flex',gap:'8px',marginTop:'var(--space-md)'}}>
                <button className="btn-primary" onClick={handleUpload} disabled={!uploadFile}
                  style={{width:'auto',padding:'10px 20px'}}>
                  <Upload size={14}/> Upload
                </button>
                <button className="btn-ghost" onClick={() => {
                  const csv = `question,answer\n"What is anxiety?","Anxiety is a natural stress response..."\n"How to practice mindfulness?","Start with 5-10 minutes daily..."`;
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
                  a.download = 'sample_knowledge.csv'; a.click();
                }}>
                  <Download size={14}/> Sample CSV
                </button>
              </div>
            </div>
            <div className="panel-card danger-card">
              <h3 className="danger-title"><AlertTriangle size={16}/> Danger Zone</h3>
              {clearStatus && (
                <div className={`result-banner ${clearStatus.ok?'success':'error'}`}>
                  {clearStatus.ok?<CheckCircle size={14}/>:<AlertCircle size={14}/>}
                  {clearStatus.msg}
                </div>
              )}
              <div className="danger-zone">
                <div className="danger-zone-inner">
                  <div>
                    <div className="danger-zone-title">Clear Knowledge Base</div>
                    <div className="danger-zone-sub">
                      Permanently delete all documents from ChromaDB. Cannot be undone.
                    </div>
                  </div>
                  <button className="btn-danger" onClick={clearKnowledge}>
                    <Trash2 size={14}/> Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>}

        {activeView === 'admin' && !user.is_admin && (
          <div className="locked-page">
            <Lock size={48} strokeWidth={1}/>
            <p>Admin Access Only</p>
            <button className="btn-primary" onClick={() => setView('chat')}
              style={{width:'auto',padding:'10px 22px'}}>
              <Home size={14}/> Go to Chat
            </button>
          </div>
        )}

      </main>
    </div>
  );
}