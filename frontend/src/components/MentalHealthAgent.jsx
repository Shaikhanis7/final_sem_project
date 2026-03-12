import React, { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:8000';

/* ═══════════════════════════════════════════════
   LANGUAGE CONFIG
═══════════════════════════════════════════════ */
const LANGUAGES = {
  eng_Latn: { name:'English',   native:'English',    flag:'🇺🇸', speech:'en-US' },
  hin_Deva: { name:'Hindi',     native:'हिन्दी',       flag:'🇮🇳', speech:'hi-IN' },
  ben_Beng: { name:'Bengali',   native:'বাংলা',        flag:'🇧🇩', speech:'bn-IN' },
  tam_Taml: { name:'Tamil',     native:'தமிழ்',        flag:'🇮🇳', speech:'ta-IN' },
  tel_Telu: { name:'Telugu',    native:'తెలుగు',       flag:'🇮🇳', speech:'te-IN' },
  mar_Deva: { name:'Marathi',   native:'मराठी',        flag:'🇮🇳', speech:'mr-IN' },
  guj_Gujr: { name:'Gujarati',  native:'ગુજરાતી',      flag:'🇮🇳', speech:'gu-IN' },
  kan_Knda: { name:'Kannada',   native:'ಕನ್ನಡ',        flag:'🇮🇳', speech:'kn-IN' },
  mal_Mlym: { name:'Malayalam', native:'മലയാളം',       flag:'🇮🇳', speech:'ml-IN' },
  pan_Guru: { name:'Punjabi',   native:'ਪੰਜਾਬੀ',       flag:'🇮🇳', speech:'pa-IN' },
};

/* ═══════════════════════════════════════════════
   INLINE SVG ICONS
═══════════════════════════════════════════════ */
const Svg = ({ children, size=20, vb='0 0 24 24' }) => (
  <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    {children}
  </svg>
);
const IcBrain    = ({size=20})=><Svg size={size}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></Svg>;
const IcSend     = ({size=20})=><Svg size={size}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Svg>;
const IcSun      = ({size=20})=><Svg size={size}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></Svg>;
const IcMoon     = ({size=20})=><Svg size={size}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Svg>;
const IcLogOut   = ({size=20})=><Svg size={size}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>;
const IcChevDown = ({size=16})=><Svg size={size}><polyline points="6 9 12 15 18 9"/></Svg>;
const IcAlert    = ({size=18})=><Svg size={size}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Svg>;
const IcShield   = ({size=16})=><Svg size={size}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Svg>;
const IcSettings = ({size=16})=><Svg size={size}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Svg>;
const IcCheck    = ({size=16})=><Svg size={size}><polyline points="20 6 9 17 4 12"/></Svg>;
const IcPlus     = ({size=16})=><Svg size={size}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>;
const IcX        = ({size=16})=><Svg size={size}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>;
const IcUpload   = ({size=20})=><Svg size={size}><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></Svg>;
const IcCamera   = ({size=16})=><Svg size={size}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></Svg>;
const IcMic      = ({size=16})=><Svg size={size}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></Svg>;
const IcMicOff   = ({size=16})=><Svg size={size}><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></Svg>;
const IcVolume   = ({size=16})=><Svg size={size}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></Svg>;
const IcImage    = ({size=16})=><Svg size={size}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></Svg>;
const IcSparkles = ({size=12})=><Svg size={size}><path d="M12 3l1.09 3.26L16 7l-2.91.74L12 11l-1.09-3.26L8 7l2.91-.74z"/><path d="M5 12l.54 1.63L7 14.5l-1.46.37L5 16.5l-.54-1.63L3 14.5l1.46-.37z"/><path d="M19 12l.54 1.63L21 14.5l-1.46.37L19 16.5l-.54-1.63L17 14.5l1.46-.37z"/></Svg>;
const IcGlobe    = ({size=14})=><Svg size={size}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Svg>;
const IcClipList = ({size=16})=><Svg size={size}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></Svg>;
const IcUser     = ({size=16})=><Svg size={size}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Svg>;
const IcTrash    = ({size=16})=><Svg size={size}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Svg>;
const IcWrench   = ({size=10})=><Svg size={size}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></Svg>;
const IcPlay     = ({size=14})=><Svg size={size}><polygon points="5 3 19 12 5 21 5 3"/></Svg>;

/* ═══════════════════════════════════════════════
   SPEECH HOOKS
═══════════════════════════════════════════════ */
const useSpeechRec = () => {
  const [transcript, setTranscript] = useState('');
  const [listening,  setListening]  = useState(false);
  const [supported,  setSupported]  = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => recRef.current?.stop();
  }, []);

  const start = useCallback((langCode = 'eng_Latn') => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    recRef.current?.stop();
    const r = new SR();
    r.continuous = true; r.interimResults = true;
    r.lang = LANGUAGES[langCode]?.speech || 'en-US';
    r.onresult = e => {
      let fin = '';
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' ';
      if (fin) setTranscript(p => p + fin);
    };
    r.onerror = () => setListening(false);
    r.onend   = () => setListening(false);
    setTranscript('');
    recRef.current = r; r.start(); setListening(true);
  }, []);

  const stop  = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);
  const reset = useCallback(() => setTranscript(''), []);
  return { transcript, listening, supported, start, stop, reset };
};

const useTTS = () => {
  const [speaking, setSpeaking] = useState(false);
  const [voices,   setVoices]   = useState([]);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load(); window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const speak = useCallback((text, langCode = 'eng_Latn') => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const tgt = LANGUAGES[langCode]?.speech || 'en-US';
    const v = voices.find(v => v.lang === tgt || v.lang.startsWith(tgt.split('-')[0]));
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = tgt; }
    u.rate = 0.9; u.pitch = 1; u.volume = 0.85;
    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [voices]);

  const cancel = useCallback(() => { window.speechSynthesis?.cancel(); setSpeaking(false); }, []);
  return { speak, speaking, cancel };
};

/* ═══════════════════════════════════════════════
   MOOD HELPERS
═══════════════════════════════════════════════ */
const moodLabel = s => s <= 2 ? 'Struggling' : s <= 4 ? 'Low' : s <= 6 ? 'Okay' : s <= 8 ? 'Good' : 'Great';
const MoodFace = ({ score }) => {
  const s = score;
  if (s <= 3) return <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
  if (s <= 6) return <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
  return <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
};

/* ═══════════════════════════════════════════════
   APP COMPONENT
═══════════════════════════════════════════════ */
export default function App() {
  /* auth */
  const [user,        setUser]        = useState(null);
  const [authTab,     setAuthTab]     = useState('login');
  const [authForm,    setAuthForm]    = useState({ username:'', password:'', email:'', full_name:'', phone:'' });
  const [ecForm,      setEcForm]      = useState({ name:'', phone:'', email:'', relationship:'friend', consent:true });
  const [showEC,      setShowEC]      = useState(false);
  const [ecSaved,     setEcSaved]     = useState(false);
  const [authErr,     setAuthErr]     = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [theme,       setTheme]       = useState('dark');

  /* app */
  const [view,     setView]     = useState('chat');
  const [messages, setMessages] = useState([{
    role:'assistant', ts:new Date(),
    content:"Hello! I'm your mental health companion. I support multiple Indian languages, emotion detection, and real-time crisis support. How are you feeling today?"
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [lang,    setLang]    = useState('eng_Latn');

  /* mood */
  const [moodOpen,    setMoodOpen]    = useState(false);
  const [moodScore,   setMoodScore]   = useState(5);
  const [moodNotes,   setMoodNotes]   = useState('');
  const [moodHistory, setMoodHistory] = useState([]);

  /* tasks / profile */
  const [todos,   setTodos]   = useState([]);
  const [profile, setProfile] = useState(null);

  /* emotion / camera */
  const [capturedB64,   setCapturedB64]   = useState(null);
  const [capturedThumb, setCapturedThumb] = useState(null);
  const [emotionData,   setEmotionData]   = useState(null);
  const [showCamera,    setShowCamera]    = useState(false);
  const [cameraActive,  setCameraActive]  = useState(false);
  const [camErr,        setCamErr]        = useState('');

  /* crisis */
  const [crisisMsg,     setCrisisMsg]     = useState('');
  const [crisisResult,  setCrisisResult]  = useState(null);
  const [crisisLoading, setCrisisLoading] = useState(false);
  const [activeCrisis,  setActiveCrisis]  = useState(null);

  /* admin */
  const [ragStats,       setRagStats]       = useState(null);
  const [uploadFile,     setUploadFile]     = useState(null);
  const [uploadResult,   setUploadResult]   = useState(null);
  const [uploadLoading,  setUploadLoading]  = useState(false);

  const msgEndRef   = useRef(null);
  const fileRef     = useRef(null);
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);

  const { transcript, listening, supported:srOk, start:startRec, stop:stopRec, reset:resetRec } = useSpeechRec();
  const { speak, speaking, cancel:cancelTTS } = useTTS();

  /* effects */
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, loading]);
  useEffect(() => { if (transcript) setInput(transcript); }, [transcript]);
  useEffect(() => () => stopCamera(), []);
  useEffect(() => { if (user) { loadTodos(); loadProfile(); loadMood(); } }, [user]);

  /* api helper */
  const api = async (path, opts = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { headers:{ 'Content-Type':'application/json' }, ...opts });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || 'Request failed'); }
    return r.json();
  };

  const loadTodos   = async () => { try { const d = await api(`/api/tasks/db_user_${user.id}`); setTodos(d.tasks||[]); } catch {} };
  const loadProfile = async () => { try { const d = await api(`/profile/${user.id}`); setProfile(d); } catch {} };
  const loadMood    = async () => { try { const d = await api(`/mood/${user.id}`); setMoodHistory(d.slice(0,10)); } catch {} };
  const loadRagStats= async () => { try { const d = await api('/api/admin/rag-stats'); setRagStats(d); } catch {} };

  /* auth */
  const doLogin = async () => {
    setAuthLoading(true); setAuthErr('');
    try { const d = await api('/login/', { method:'POST', body: JSON.stringify({ username: authForm.username, password: authForm.password }) }); setUser(d); }
    catch(e) { setAuthErr(e.message); }
    setAuthLoading(false);
  };
  const doRegister = async () => {
    setAuthLoading(true); setAuthErr('');
    try {
      const body = { ...authForm, ...(ecSaved ? { emergency_contact_name:ecForm.name, emergency_contact_phone:ecForm.phone, emergency_contact_email:ecForm.email, emergency_contact_relationship:ecForm.relationship } : {}) };
      const d = await api('/users/', { method:'POST', body: JSON.stringify(body) }); setUser(d);
    } catch(e) { setAuthErr(e.message); }
    setAuthLoading(false);
  };

  /* mood */
  const saveMood = async () => {
    try { await api('/mood/', { method:'POST', body: JSON.stringify({ user_id:user.id, score:moodScore, notes:moodNotes }) }); setMoodNotes(''); loadMood(); } catch {}
  };

  /* chat */
  const sendMessage = async (withEmotion = false) => {
    if (!input.trim() || loading) return;
    const txt = input.trim(); setInput(''); resetRec(); setLoading(true);
    setMessages(p => [...p, { role:'user', ts:new Date(), content:txt, lang }]);
    try {
      const body = { user_id:user.id, message:txt, language:lang, image_data:(withEmotion && capturedB64) ? capturedB64 : undefined };
      const d = await api('/chat/', { method:'POST', body: JSON.stringify(body) });
      const msg = { role:'assistant', ts:new Date(), content:d.response, originalText:d.original_response,
        used_rag:d.rag_used, tools:d.tools_used||[], emotion:d.emotion, crisis:d.crisis, lang };
      setMessages(p => [...p, msg]);
      speak(d.response, lang);
      if (d.crisis?.risk_level && ['high','critical'].includes(d.crisis.risk_level)) setActiveCrisis(d.crisis);
      loadTodos();
    } catch { setMessages(p => [...p, { role:'assistant', ts:new Date(), isError:true, content:"I'm having trouble connecting. Please make sure the server is running on http://localhost:8000" }]); }
    setLoading(false);
  };
  const handleKey = e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(false); } };
  const toggleMic = () => { if (!srOk) return alert('Speech recognition requires Chrome or Edge.'); listening ? stopRec() : (resetRec(), startRec(lang)); };

  /* camera */
  const startCamera = async () => {
    setCamErr('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.onloadedmetadata = () => setCameraActive(true); }
    } catch(e) { setCamErr(`Camera: ${e.message}`); }
  };
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null; setCameraActive(false);
  };
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return;
    const c = canvasRef.current; c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight;
    c.getContext('2d').drawImage(videoRef.current, 0, 0);
    c.toBlob(blob => { const r = new FileReader(); r.onloadend = () => { setCapturedB64(r.result); setCapturedThumb(r.result); analyzeEmotion(r.result); }; r.readAsDataURL(blob); }, 'image/jpeg', 0.85);
  };
  const analyzeEmotion = async b64 => { try { const d = await api('/analyze-emotion/', { method:'POST', body: JSON.stringify({ image_data:b64 }) }); setEmotionData(d); } catch { setCamErr('Emotion analysis failed'); } };
  const handleImgUpload = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try { const r = await fetch(`${API_BASE}/upload-image/`, { method:'POST', body:fd }); const d = await r.json(); setEmotionData(d.emotion_analysis); const reader = new FileReader(); reader.onloadend = () => { setCapturedB64(reader.result); setCapturedThumb(d.image_preview||reader.result); }; reader.readAsDataURL(file); } catch { setCamErr('Upload failed'); }
  };

  /* crisis */
  const detectCrisis = async () => {
    if (!crisisMsg.trim()) return; setCrisisLoading(true);
    try { const d = await api('/crisis-detect/', { method:'POST', body: JSON.stringify({ user_id:user.id, message:crisisMsg }) }); setCrisisResult(d); }
    catch(e) { setCrisisResult({ error:e.message }); }
    setCrisisLoading(false);
  };

  /* tasks */
  const updateTask = async (taskId, status) => { try { await api(`/api/tasks/db_user_${user.id}/${taskId}`, { method:'PUT', body: JSON.stringify({ status }) }); loadTodos(); } catch {} };

  /* admin */
  const uploadCSV = async () => {
    if (!uploadFile) return; setUploadLoading(true); setUploadResult(null);
    const fd = new FormData(); fd.append('file', uploadFile);
    try { const r = await fetch(`${API_BASE}/api/admin/upload-csv`, { method:'POST', body:fd }); const d = await r.json(); setUploadResult({ success:true, message:d.message }); loadRagStats(); }
    catch(e) { setUploadResult({ success:false, message:e.message }); }
    setUploadLoading(false);
  };
  const clearKB = async () => { if (!window.confirm('Clear entire knowledge base?')) return; try { await api('/api/admin/clear-knowledge', { method:'DELETE' }); setUploadResult({ success:true, message:'Knowledge base cleared.' }); loadRagStats(); } catch {} };

  /* ═══ LOGIN SCREEN ═══ */
  if (!user) return (
    <div className="login-container">
      <div className="login-backdrop"/>
      <button className="theme-toggle-floating" onClick={() => setTheme(t => t==='dark'?'light':'dark')} title="Toggle theme">
        {theme==='dark' ? <IcSun size={20}/> : <IcMoon size={20}/>}
      </button>

      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <div className="brand-icon">
              <svg viewBox="0 0 80 80" fill="none">
                <defs>
                  <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#9b88db"/><stop offset="100%" stopColor="#6eb5b5"/></linearGradient>
                </defs>
                <circle cx="40" cy="40" r="38" stroke="url(#g1)" strokeWidth="2" fill="rgba(155,136,219,0.06)"/>
                <path d="M32 38C28 34 28 26 36 24C40 23 44 25 44 29M44 38C48 34 48 26 40 24M36 38C36 44 40 52 40 56M44 38C44 44 40 52 40 56M32 38C36 36 40 38 40 38C40 38 44 36 48 38" stroke="url(#g1)" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="36" cy="38" r="2" fill="url(#g1)"/>
                <circle cx="44" cy="38" r="2" fill="url(#g1)"/>
              </svg>
            </div>
            <h1>MindfulAI</h1>
            <p className="tagline">Your compassionate mental health companion</p>
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab${authTab==='login'?' active':''}`} onClick={() => { setAuthTab('login'); setAuthErr(''); }}>Sign In</button>
            <button className={`auth-tab${authTab==='register'?' active':''}`} onClick={() => { setAuthTab('register'); setAuthErr(''); }}>Create Account</button>
          </div>

          {authErr && <div className="auth-error"><IcAlert size={18}/><span>{authErr}</span></div>}

          <div className="login-form">
            {authTab === 'register' && (<>
              <div className="input-group"><label>Full Name</label><input placeholder="Your name" value={authForm.full_name} onChange={e => setAuthForm(p => ({...p, full_name:e.target.value}))}/></div>
              <div className="input-group"><label>Email</label><input type="email" placeholder="your@email.com" value={authForm.email} onChange={e => setAuthForm(p => ({...p, email:e.target.value}))}/></div>
              <div className="input-group"><label>Phone (optional)</label><input placeholder="+1 555 0000" value={authForm.phone} onChange={e => setAuthForm(p => ({...p, phone:e.target.value}))}/></div>
            </>)}
            <div className="input-group"><label>Username</label><input placeholder="username" value={authForm.username} onChange={e => setAuthForm(p => ({...p, username:e.target.value}))}/></div>
            <div className="input-group"><label>Password</label><input type="password" placeholder="••••••••" value={authForm.password} onChange={e => setAuthForm(p => ({...p, password:e.target.value}))} onKeyDown={e => { if (e.key==='Enter') authTab==='login'?doLogin():doRegister(); }}/></div>

            {authTab === 'register' && (
              <div className="ec-prompt">
                <h4>🚨 Emergency Contact (Recommended)</h4>
                <p>If a crisis is detected, we'll notify this person to check on you immediately.</p>
                {ecSaved ? (
                  <div className="ec-saved">
                    <div className="ec-saved-check">✓</div>
                    <div><div className="ec-saved-name">{ecForm.name}</div><div className="ec-saved-detail">{ecForm.email||ecForm.phone}</div></div>
                    <button className="btn-add-ec" style={{marginLeft:'auto'}} onClick={() => setEcSaved(false)}>Edit</button>
                  </div>
                ) : showEC ? (
                  <div className="ec-form">
                    {[['Name *','text','Full name','name'],['Email','email','email@example.com','email'],['Phone','tel','+1 555 0000','phone']].map(([lbl,type,ph,key]) => (
                      <div key={key} className="ec-field"><label>{lbl}</label><input type={type} placeholder={ph} value={ecForm[key]} onChange={e => setEcForm(p => ({...p,[key]:e.target.value}))}/></div>
                    ))}
                    <div className="ec-field"><label>Relationship</label>
                      <select value={ecForm.relationship} onChange={e => setEcForm(p => ({...p, relationship:e.target.value}))}>
                        {['friend','family','partner','therapist','colleague'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                      </select>
                    </div>
                    <label className="ec-consent"><input type="checkbox" checked={ecForm.consent} onChange={e => setEcForm(p => ({...p, consent:e.target.checked}))}/> I consent to emergency notifications being sent to this contact.</label>
                    <button className="btn-save-ec" onClick={() => { if (ecForm.name) setEcSaved(true); }}><IcCheck size={14}/> Save Contact</button>
                  </div>
                ) : (
                  <button className="btn-add-ec" onClick={() => setShowEC(true)}><IcPlus size={14}/> Add Emergency Contact</button>
                )}
              </div>
            )}
          </div>

          <button className="btn-primary" disabled={authLoading} onClick={authTab==='login'?doLogin:doRegister}>
            {authLoading ? 'Please wait…' : authTab==='login' ? <><span>Sign In</span><IcSend size={18}/></> : <><span>Create Account</span><IcSend size={18}/></>}
          </button>

          <div className="auth-switch">
            {authTab==='login'
              ? <>Don't have an account? <button className="link-button" onClick={() => setAuthTab('register')}>Create one</button></>
              : <>Already have an account? <button className="link-button" onClick={() => setAuthTab('login')}>Sign in</button></>}
          </div>

          <div className="features-grid">
            {[['🧠','RAG-Powered','Evidence-based responses'],['🌏','10 Languages','Voice input & output'],['🛡️','Crisis Safe','Real-time detection & alerts']].map(([icon,title,desc]) => (
              <div key={title} className="feature-item"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{desc}</p></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /* ═══ MAIN APP ═══ */
  const pendingTasks = todos.filter(t => t.status !== 'completed');
  const ec = profile?.emergency_contact;

  return (
    <div className="app-container">

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon-small"><IcBrain size={40}/></div>
            <div>
              <h2>MindfulAI</h2>
              <div className="user-greeting">Hi, {user.full_name||user.username} 👋</div>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="sidebar-section">
          <span className="section-label"><IcGlobe size={11}/> Language</span>
          <div className="language-selector">
            <select value={lang} onChange={e => setLang(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, l]) => (
                <option key={code} value={code}>{l.flag} {l.name} — {l.native}</option>
              ))}
            </select>
            <span className="select-arrow"><IcChevDown size={14}/></span>
          </div>
        </div>

        {/* Theme */}
        <div className="sidebar-section">
          <button className="theme-toggle" onClick={() => setTheme(t => t==='dark'?'light':'dark')}>
            {theme==='dark' ? <><IcSun size={16}/><span>Light Mode</span></> : <><IcMoon size={16}/><span>Dark Mode</span></>}
          </button>
        </div>

        {/* Mood Tracker */}
        <div className="sidebar-section">
          <button className={`mood-toggle${moodOpen?' active':''}`} onClick={() => setMoodOpen(o => !o)}>
            <span className="mood-icon" style={{width:18,height:18,display:'flex'}}><MoodFace score={moodScore}/></span>
            <span style={{flex:1,textAlign:'left'}}>Mood Tracker</span>
            <span className={`chevron${moodOpen?' rotated':''}`}><IcChevDown size={14}/></span>
          </button>
          {moodOpen && (
            <div className="mood-tracker">
              <div className="mood-display">
                <div className="mood-emoji"><MoodFace score={moodScore}/></div>
                <div className="mood-info">
                  <div className="mood-score">{moodScore}/10</div>
                  <div className="mood-label-text">{moodLabel(moodScore)}</div>
                </div>
              </div>
              <div className="mood-slider-wrapper">
                <input type="range" className="mood-slider" min={1} max={10} value={moodScore} onChange={e => setMoodScore(+e.target.value)}/>
                <div className="slider-labels"><span>Struggling</span><span>Okay</span><span>Great</span></div>
              </div>
              <textarea className="mood-notes" rows={2} placeholder="How are you feeling? (optional)" value={moodNotes} onChange={e => setMoodNotes(e.target.value)}/>
              <button className="btn-secondary" onClick={saveMood}><IcCheck size={16}/>Save Mood</button>
              {moodHistory.length > 0 && (
                <div className="mood-history" style={{marginTop:'var(--space-md)'}}>
                  {moodHistory.slice(0,5).map((e, i) => (
                    <div key={i} className="mood-entry">
                      <div className="mood-entry-emoji"><MoodFace score={e.score}/></div>
                      <div className="mood-entry-details">
                        <div className="mood-entry-label">{moodLabel(e.score)}</div>
                        <div className="mood-entry-time">{new Date(e.timestamp).toLocaleDateString()}</div>
                      </div>
                      <div className="mood-entry-score">{e.score}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="sidebar-section">
          <span className="section-label">Features</span>
          <div className="advanced-features-buttons">
            {[
              ['chat',    <IcBrain size={16}/>,    'AI Chat'],
              ['tasks',   <IcClipList size={16}/>, `Tasks (${pendingTasks.length})`],
              ['profile', <IcUser size={16}/>,     'Profile'],
              ['crisis',  <IcShield size={16}/>,   'Crisis Support'],
              ...(user.is_admin ? [['admin', <IcSettings size={16}/>, 'Admin Portal']] : []),
            ].map(([v, icon, label]) => (
              <button key={v} className={`feature-btn${view===v?' active':''}`} onClick={() => { setView(v); if (v==='admin') loadRagStats(); }}>
                {icon}<span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Emergency Contact */}
        {ec && (
          <div className="sidebar-section">
            <span className="section-label"><IcShield size={11}/> Emergency Contact</span>
            <div className="emergency-contact-status">
              <div className="emergency-contact-badge">
                <div className="badge-icon">🛡</div>
                <div className="badge-content">
                  <div className="badge-title">{ec.emergency_contact_relationship||'Contact'}</div>
                  <div className="badge-name">{ec.emergency_contact_name}</div>
                  <div className="badge-detail">{ec.emergency_contact_email||ec.emergency_contact_phone}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="sidebar-section" style={{marginTop:'auto'}}>
          <button className="btn-logout" onClick={() => { setUser(null); setMessages([]); }}>
            <IcLogOut size={16}/><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <main className="chat-main">

        {/* ═══ CHAT ═══ */}
        {view==='chat' && (<>
          <div className="chat-header">
            <div className="chat-header-content">
              <h2>Mental Health AI</h2>
              <div className="chat-subtitle">
                {LANGUAGES[lang]?.flag} {LANGUAGES[lang]?.name} · RAG-Powered
                {emotionData ? ` · ${emotionData.dominant_emotion} detected` : ''}
              </div>
            </div>
            <div style={{display:'flex',gap:'var(--space-sm)',alignItems:'center'}}>
              {emotionData && (
                <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:'var(--radius-full)',background:'rgba(155,136,219,0.12)',border:'1px solid rgba(155,136,219,0.25)'}}>
                  <span style={{fontSize:'0.75rem',fontWeight:700,color:'var(--primary-light)'}}>{emotionData.dominant_emotion} · {(emotionData.confidence*100).toFixed(0)}%</span>
                  <button style={{all:'unset',cursor:'pointer',display:'flex',color:'var(--text-tertiary)'}} onClick={() => { setEmotionData(null); setCapturedB64(null); setCapturedThumb(null); }}><IcX size={12}/></button>
                </div>
              )}
              <div className="chat-status"><div className="status-indicator"/><span>Online</span></div>
            </div>
          </div>

          {activeCrisis && (
            <div className="crisis-banner">
              <div className="crisis-banner-icon">🚨</div>
              <div style={{flex:1}}>
                <div className="crisis-banner-title">Crisis Support Available — {activeCrisis.risk_level?.toUpperCase()}</div>
                <div className="crisis-banner-sub">{activeCrisis.crisis_response}</div>
                <div className="crisis-resources">
                  <button className="crisis-res-btn" onClick={() => window.open('tel:988')}>📞 988 Lifeline</button>
                  <button className="crisis-res-btn" onClick={() => window.open('sms:741741?body=HOME')}>💬 Text HOME to 741741</button>
                  <button className="crisis-res-btn" onClick={() => window.open('tel:911')}>🚑 911</button>
                </div>
              </div>
              <button style={{all:'unset',cursor:'pointer',display:'flex',color:'var(--text-tertiary)',padding:4}} onClick={() => setActiveCrisis(null)}><IcX size={16}/></button>
            </div>
          )}

          <div className="messages-container">
            <div className="messages-inner">
              {messages.map((msg, i) => (
                <div key={i} className={`message-wrapper ${msg.role}`}>
                  {msg.role==='assistant' && (
                    <div className="message-bubble">
                      <div className="message-avatar assistant-avatar"><IcBrain size={22}/></div>
                      <div className="message-content">
                        <div className="message-text">{msg.content}</div>
                        {msg.originalText && <div style={{fontSize:'0.78rem',color:'var(--text-tertiary)',marginTop:6,fontStyle:'italic',borderTop:'1px solid var(--border-light)',paddingTop:6}}>EN: {msg.originalText}</div>}
                        {(msg.used_rag||msg.tools?.length||msg.crisis||msg.emotion?.dominant_emotion) && (
                          <div className="msg-meta">
                            {msg.used_rag && <span className="meta-badge rag"><IcSparkles size={10}/>KB used</span>}
                            {msg.tools?.map(t => <span key={t} className="meta-badge tool"><IcWrench size={10}/>{t}</span>)}
                            {msg.crisis && <span className="meta-badge crisis"><IcAlert size={10}/>Crisis: {msg.crisis.risk_level}</span>}
                            {msg.emotion?.dominant_emotion && <span className="meta-badge tool"><IcCamera size={10}/>{msg.emotion.dominant_emotion}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {msg.role==='user' && (
                    <div className="message-bubble">
                      <div className="message-content"><div className="message-text">{msg.content}</div></div>
                      <div className="message-avatar user-avatar">{(user.username||'U')[0].toUpperCase()}</div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="message-wrapper assistant">
                  <div className="message-bubble">
                    <div className="message-avatar assistant-avatar"><IcBrain size={22}/></div>
                    <div className="message-content"><div className="typing-indicator"><span/><span/><span/></div></div>
                  </div>
                </div>
              )}
              <div ref={msgEndRef}/>
            </div>
          </div>

          <div className="input-area">
            <div style={{maxWidth:780,margin:'0 auto',display:'flex',gap:'var(--space-sm)',flexWrap:'wrap',marginBottom:'var(--space-md)'}}>
              <button className={`feature-btn${listening?' active':''}`} style={{padding:'7px 12px',fontSize:'0.8rem'}} onClick={toggleMic}>
                {listening ? <><IcMicOff size={14}/><span>Stop</span></> : <><IcMic size={14}/><span>Voice</span></>}
              </button>
              {speaking && <button className="feature-btn active" style={{padding:'7px 12px',fontSize:'0.8rem'}} onClick={cancelTTS}><IcVolume size={14}/><span>Speaking…</span></button>}
              <button className="feature-btn" style={{padding:'7px 12px',fontSize:'0.8rem'}} onClick={() => fileRef.current?.click()}>
                <IcImage size={14}/><span>Photo</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImgUpload}/>
              <button className="feature-btn" style={{padding:'7px 12px',fontSize:'0.8rem'}} onClick={() => { setShowCamera(true); startCamera(); }}>
                <IcCamera size={14}/><span>Camera</span>
              </button>
              {capturedB64 && (
                <button className="feature-btn active" style={{padding:'7px 12px',fontSize:'0.8rem',background:'linear-gradient(135deg,#7c5cdb,#6eb5b5)',color:'white',border:'none'}} onClick={() => sendMessage(true)}>
                  <IcSparkles size={12}/><span>Send + Emotion</span>
                </button>
              )}
              {listening && <span style={{marginLeft:'auto',fontSize:'0.78rem',color:'var(--secondary)',display:'flex',alignItems:'center',gap:5}}><span style={{width:6,height:6,borderRadius:'50%',background:'var(--secondary)',animation:'pulse 1s infinite',display:'inline-block'}}/> Listening in {LANGUAGES[lang]?.name}…</span>}
            </div>
            <div className="input-container">
              <textarea rows={2} disabled={loading} placeholder={`Message in ${LANGUAGES[lang]?.name}… (Enter to send)`}
                value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}/>
              <button className="btn-send" disabled={!input.trim()||loading} onClick={() => sendMessage(false)}><IcSend size={20}/></button>
            </div>
            <div className="input-hint">Enter to send · Shift+Enter for new line · Voice &amp; emotion detection available</div>
          </div>
        </>)}

        {/* ═══ TASKS ═══ */}
        {view==='tasks' && (
          <div className="tasks-page">
            <div className="crisis-header">
              <h2>Wellness Tasks</h2>
              <button className="btn-ghost" onClick={loadTodos}><IcCheck size={14}/> Refresh</button>
            </div>
            {pendingTasks.length > 0 ? (<>
              <div className="tasks-section-title"><IcPlay size={14}/>Active Tasks ({pendingTasks.length})</div>
              {pendingTasks.map(t => (
                <div key={t.id} className="task-item">
                  <div className="task-cat-icon" style={{background:'rgba(155,136,219,0.12)'}}>
                    {t.category==='mindfulness'?'🧘':t.category==='exercise'?'🏃':t.category==='social'?'👥':t.category==='sleep'?'💤':t.category==='nutrition'?'🥗':'✨'}
                  </div>
                  <div className="task-info">
                    <div className="task-name">{t.title||t.task}</div>
                    <div className="task-meta">
                      <span className="task-meta-badge">⏱ {t.time_to_complete}m</span>
                      <span className="task-meta-badge">⚡ {t.priority}</span>
                      <span className="task-meta-badge">{t.category}</span>
                      {t.due_date && <span className="task-meta-badge">📅 {new Date(t.due_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button className="task-action-btn start" title="Mark In Progress" onClick={() => updateTask(t.id,'in_progress')}>▶</button>
                    <button className="task-action-btn complete" title="Mark Complete" onClick={() => updateTask(t.id,'completed')}>✓</button>
                  </div>
                </div>
              ))}
            </>) : (<div className="empty-state"><div className="empty-state-icon">✨</div><p>No active tasks. Chat with MindfulAI to get personalised wellness tasks!</p></div>)}
            {todos.filter(t => t.status==='completed').length > 0 && (<>
              <div className="task-divider"/>
              <div className="tasks-section-title"><IcCheck size={14}/>Completed</div>
              {todos.filter(t => t.status==='completed').map(t => (
                <div key={t.id} className="task-item" style={{opacity:0.5}}>
                  <div className="task-cat-icon" style={{background:'rgba(110,181,181,0.12)'}}>✓</div>
                  <div className="task-info">
                    <div className="task-name" style={{textDecoration:'line-through'}}>{t.title||t.task}</div>
                    {t.completed_at && <div className="task-meta"><span className="task-meta-badge">Done {new Date(t.completed_at).toLocaleDateString()}</span></div>}
                  </div>
                </div>
              ))}
            </>)}
          </div>
        )}

        {/* ═══ PROFILE ═══ */}
        {view==='profile' && (
          <div className="profile-page">
            <div className="profile-header">
              <div className="profile-avatar">{(user.full_name||user.username||'U')[0].toUpperCase()}</div>
              <div style={{flex:1}}>
                <div className="profile-name">{user.full_name||user.username}</div>
                <div className="profile-email">{user.email}</div>
                {user.phone && <div className="profile-email">📞 {user.phone}</div>}
              </div>
              <div className="profile-stats">
                <div className="profile-stat"><div className="profile-stat-val">{moodHistory.length}</div><div className="profile-stat-label">Moods</div></div>
                <div className="profile-stat"><div className="profile-stat-val">{todos.length}</div><div className="profile-stat-label">Tasks</div></div>
                <div className="profile-stat"><div className="profile-stat-val">{todos.filter(t=>t.status==='completed').length}</div><div className="profile-stat-label">Done</div></div>
              </div>
            </div>
            {[
              {title:'Mental Health Goals',   key:'goals',             color:'primary'},
              {title:'Coping Strategies',     key:'coping_strategies', color:'teal'},
              {title:'Known Triggers',        key:'triggers',          color:'amber'},
            ].map(({title,key,color}) => (profile?.[key]||[]).length > 0 && (
              <div key={key} className="profile-section-card">
                <div className="profile-section-title">{title}</div>
                <div className="tag-list">{(profile[key]||[]).map((v,i) => <span key={i} className={`tag tag-${color}`}>{v}</span>)}</div>
              </div>
            ))}
            {ec && (
              <div className="profile-section-card">
                <div className="profile-section-title"><IcShield size={14}/> Emergency Contact</div>
                <div className="emergency-contact-badge" style={{background:'rgba(110,181,181,0.06)',padding:'var(--space-md)',borderRadius:'var(--radius-md)',borderLeft:'3px solid var(--secondary)',display:'flex',gap:'var(--space-md)',alignItems:'flex-start'}}>
                  <div className="badge-icon">🛡</div>
                  <div className="badge-content">
                    <div className="badge-title">{ec.emergency_contact_relationship||'Contact'}</div>
                    <div className="badge-name">{ec.emergency_contact_name}</div>
                    {ec.emergency_contact_email && <div className="badge-detail">✉ {ec.emergency_contact_email}</div>}
                    {ec.emergency_contact_phone && <div className="badge-detail">📞 {ec.emergency_contact_phone}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ CRISIS ═══ */}
        {view==='crisis' && (
          <div className="crisis-detection">
            <div className="crisis-header">
              <h2>🛡️ Crisis Detection & Support</h2>
              <div className="crisis-header-actions">
                <button className="btn-ghost" onClick={() => setView('chat')}>← Back to Chat</button>
              </div>
            </div>
            <div className="panel-card">
              <h3><IcAlert size={16}/>Analyse a Message</h3>
              <textarea className="panel-textarea" rows={4} placeholder="Enter a message to analyse for crisis indicators…" value={crisisMsg} onChange={e => setCrisisMsg(e.target.value)}/>
              <button className="btn-danger" disabled={crisisLoading||!crisisMsg.trim()} onClick={detectCrisis}>
                {crisisLoading ? 'Analysing…' : '🔍 Detect Crisis'}
              </button>
            </div>
            {crisisResult && !crisisResult.error && (<>
              <div className="panel-card">
                <h3>📊 Analysis Result</h3>
                <div style={{display:'flex',gap:'var(--space-md)',flexWrap:'wrap',alignItems:'center',marginBottom:'var(--space-md)'}}>
                  <span className={`risk-badge risk-${crisisResult.risk_level}`}>{crisisResult.risk_level?.toUpperCase()}</span>
                  <span style={{fontSize:'0.82rem',color:'var(--text-tertiary)'}}>Confidence: {(crisisResult.confidence*100).toFixed(0)}%</span>
                  {crisisResult.escalation_triggered && <span style={{fontSize:'0.8rem',color:'var(--secondary)',fontWeight:600}}>✅ Emergency contact notified</span>}
                </div>
                {crisisResult.harm_indicators?.length > 0 && <div className="keyword-list">{crisisResult.harm_indicators.map(k => <span key={k} className="keyword-tag">{k}</span>)}</div>}
                <div className="crisis-response-box">{crisisResult.response}</div>
              </div>
              <div className="panel-card">
                <div className="emergency-resources">
                  <h3 style={{fontSize:'0.875rem',fontWeight:700,color:'#f87171',marginBottom:'var(--space-sm)'}}>🚨 Emergency Resources</h3>
                  <ul><li>📞 <strong>988</strong> — US Suicide & Crisis Lifeline</li><li>💬 Text <strong>HOME</strong> to <strong>741741</strong> — Crisis Text Line</li><li>🚑 <strong>911</strong> (US) · <strong>999</strong> (UK) · <strong>112</strong> (EU)</li></ul>
                </div>
                <div className="safety-info"><p>If someone is in immediate danger, contact emergency services immediately. This system provides AI-assisted detection and is not a substitute for professional care.</p></div>
              </div>
            </>)}
          </div>
        )}

        {/* ═══ ADMIN ═══ */}
        {view==='admin' && user.is_admin && (
          <div className="panel-fullscreen">
            <div className="crisis-header">
              <h2>⚙️ Admin Portal</h2>
              <button className="btn-ghost" onClick={() => setView('chat')}>← Back</button>
            </div>
            <div className="admin-grid">
              {[['📄',ragStats?.total_documents??'—','Documents'],['🧩',ragStats?.total_chunks??'—','Chunks'],['📁',ragStats?.csv_uploads??'—','CSV Uploads'],['✅',ragStats?.vectorstore_initialized?'Yes':'No','KB Online']].map(([icon,val,label]) => (
                <div key={label} className="admin-stat"><div className="admin-stat-icon">{icon}</div><div className="admin-stat-val">{val}</div><div className="admin-stat-label">{label}</div></div>
              ))}
            </div>
            <div className="panel-card">
              <h3><IcUpload size={16}/>Upload Knowledge CSV</h3>
              <p style={{fontSize:'0.82rem',color:'var(--text-secondary)',marginBottom:'var(--space-md)'}}>CSV must have <code>question</code> and <code>answer</code> columns.</p>
              <div className={`upload-zone${uploadFile?' has-file':''}`} onClick={() => document.getElementById('csv-inp').click()}>
                <div className="upload-zone-icon"><IcUpload size={32}/></div>
                <div className="upload-zone-text">{uploadFile?uploadFile.name:'Click to upload CSV'}</div>
                <div className="upload-zone-sub">Max 10MB · UTF-8</div>
                <input id="csv-inp" type="file" accept=".csv" hidden onChange={e => { setUploadFile(e.target.files?.[0]||null); setUploadResult(null); }}/>
              </div>
              {uploadResult && <div className={`result-banner ${uploadResult.success?'success':'error'}`}>{uploadResult.success?<IcCheck size={16}/>:<IcAlert size={16}/>}<span>{uploadResult.message}</span></div>}
              <div style={{display:'flex',gap:'var(--space-md)',marginTop:'var(--space-md)'}}>
                <button className="btn-primary" style={{flex:1}} disabled={!uploadFile||uploadLoading} onClick={uploadCSV}>{uploadLoading?'Uploading…':'Upload & Index'}</button>
                <button className="btn-ghost" onClick={loadRagStats}>Refresh</button>
              </div>
            </div>
            <div className="panel-card">
              <h3>📖 RAG Pipeline</h3>
              {[['Parse CSV','Q&A pairs extracted & normalised'],['Chunk','500-char chunks, 50-char overlap'],['Embed','sentence-transformers/all-MiniLM-L6-v2'],['Store','ChromaDB at ./chroma_db'],['Retrieve','Top-5 similarity search'],['Augment','Context injected into LLM prompt']].map(([t,d],i) => (
                <div key={i} className="rag-step"><div className="rag-step-num">{i+1}</div><div><div className="rag-step-title">{t}</div><div className="rag-step-desc">{d}</div></div></div>
              ))}
            </div>
            <div className="panel-card">
              <h3 style={{color:'#f87171'}}><IcAlert size={16}/>Danger Zone</h3>
              <div className="danger-zone"><div className="danger-zone-inner">
                <div><div className="danger-zone-title">Clear Knowledge Base</div><div className="danger-zone-sub">Removes all vectors — re-seeds defaults</div></div>
                <button className="btn-danger" onClick={clearKB}><IcTrash size={14}/>Clear</button>
              </div></div>
            </div>
          </div>
        )}

      </main>

      {/* ─── CAMERA MODAL ─── */}
      {showCamera && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(10px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'var(--space-lg)'}}>
          <div className="panel-card" style={{width:'100%',maxWidth:500,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'var(--space-lg)'}}>
              <h3 style={{margin:0}}><IcCamera size={18}/>  Capture Emotion Photo</h3>
              <button className="btn-ghost" onClick={() => { setShowCamera(false); stopCamera(); }} style={{padding:'6px 12px',fontSize:'0.8rem'}}><IcX size={14}/>Close</button>
            </div>
            <div style={{background:'#000',borderRadius:'var(--radius-lg)',overflow:'hidden',aspectRatio:'4/3',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'var(--space-md)'}}>
              {!cameraActive && <div style={{color:'#666',textAlign:'center'}}><div style={{fontSize:'3rem',marginBottom:8}}>📷</div><div style={{fontSize:'0.875rem'}}>{camErr||'Camera off'}</div></div>}
              <video ref={videoRef} autoPlay playsInline muted style={{width:'100%',display:cameraActive?'block':'none'}}/>
              <canvas ref={canvasRef} hidden/>
            </div>
            {camErr && <div className="result-banner error"><IcAlert size={14}/><span>{camErr}</span></div>}
            <div style={{display:'flex',gap:'var(--space-sm)',justifyContent:'center',flexWrap:'wrap',marginBottom:'var(--space-md)'}}>
              {!cameraActive
                ? <button className="btn-secondary" onClick={startCamera}><IcCamera size={16}/>Start Camera</button>
                : (<><button className="btn-primary" style={{flex:1}} onClick={capturePhoto}><IcCamera size={16}/>Capture</button><button className="btn-ghost" onClick={stopCamera}><IcX size={14}/>Stop</button></>)
              }
            </div>
            {capturedThumb && emotionData && (
              <div style={{display:'flex',alignItems:'center',gap:'var(--space-md)',padding:'var(--space-md)',background:'rgba(155,136,219,0.08)',borderRadius:'var(--radius-md)',border:'1px solid rgba(155,136,219,0.2)'}}>
                <img src={capturedThumb} alt="preview" style={{width:64,height:64,borderRadius:'var(--radius-md)',objectFit:'cover',border:'2px solid var(--primary)'}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--text-primary)',marginBottom:6}}>Photo captured!</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <span className="risk-badge risk-medium">{emotionData.dominant_emotion}</span>
                    <span className="meta-badge rag">{(emotionData.confidence*100).toFixed(0)}% confidence</span>
                    <span className="meta-badge tool">Stress: {emotionData.stress_level}</span>
                  </div>
                </div>
                <button className="btn-secondary" style={{flexShrink:0}} onClick={() => { setShowCamera(false); stopCamera(); }}>Use →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}