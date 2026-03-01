import React, { useState, useEffect, useRef } from 'react';
import {
  Brain, Send, Heart, AlertTriangle, CheckCircle, User, BarChart2,
  List, Settings, LogOut, Upload, Sun, Moon, Sparkles, Wrench,
  Shield, Play, Archive, Loader, X, Trash2, RefreshCw, Phone,
  Mail, Download, TrendingUp, ChevronDown, AlertCircle, Check,
  Globe, MessageCircle, Activity, Database, BookOpen, Coffee,
  Leaf, Target, Smile, Frown, Meh, Eye, EyeOff,
  Plus, Minus, Home, Lock, UserCheck, Clock, Key
} from 'lucide-react';
import './App.css';

const API = 'http://localhost:8000';

const LANGUAGES = {
  en: { name: 'English', flag: '🇺🇸', placeholder: "How are you feeling today? I'm here to listen..." },
  es: { name: 'Español', flag: '🇪🇸', placeholder: "¿Cómo te sientes hoy? Estoy aquí para escuchar..." },
  fr: { name: 'Français', flag: '🇫🇷', placeholder: "Comment vous sentez-vous aujourd'hui?" },
  de: { name: 'Deutsch', flag: '🇩🇪', placeholder: "Wie fühlen Sie sich heute?" },
  hi: { name: 'हिंदी', flag: '🇮🇳', placeholder: "आज आप कैसा महसूस कर रहे हैं?" },
};

const MOOD_LABELS = {
  1:'Terrible', 2:'Very Bad', 3:'Bad', 4:'Below Avg',
  5:'Okay', 6:'Alright', 7:'Good', 8:'Very Good', 9:'Great', 10:'Excellent'
};

const getMoodIcon = (score) => {
  if (score <= 3) return <Frown size={28} strokeWidth={1.8}/>;
  if (score <= 6) return <Meh size={28} strokeWidth={1.8}/>;
  return <Smile size={28} strokeWidth={1.8}/>;
};

// ================== AUTH SCREEN ==================

function AuthScreen({ onLogin, theme, toggleTheme }) {
  const [tab, setTab]         = useState('login');
  const [form, setForm]       = useState({ name:'', username:'', email:'', password:'' });
  const [ecForm, setEcForm]   = useState({ name:'', phone:'', email:'', relationship:'', show:false, saved:false });
  const [consent, setConsent] = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  const set   = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setEc = (k) => (e) => setEcForm(p => ({ ...p, [k]: e.target.value }));

  const saveEcContact = () => {
    if (!ecForm.name || (!ecForm.phone && !ecForm.email)) {
      setError('Emergency contact needs a name and at least phone or email.'); return;
    }
    if (!consent) { setError('Please tick the consent checkbox.'); return; }
    setEcForm(p => ({ ...p, saved:true, show:false }));
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.username.trim() || !form.password.trim()) {
      setError('Username and password are required.'); return;
    }
    if (tab === 'signup' && !form.name.trim()) {
      setError('Full name is required.'); return;
    }
    setLoading(true);
    try {
      if (tab === 'login') {
        // FIX: send `username` not `email` — matches backend UserLogin model
        const res  = await fetch(`${API}/login/`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ username: form.username, password: form.password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.detail || 'Incorrect username or password.'); return; }
        onLogin(data);
      } else {
        // FIX: send full_name + flat emergency contact fields (not nested object)
        const body = {
          username : form.username,
          password : form.password,
          email    : form.email || undefined,
          full_name: form.name,
        };
        if (ecForm.saved) {
          body.emergency_contact_name         = ecForm.name;
          body.emergency_contact_phone        = ecForm.phone;
          body.emergency_contact_email        = ecForm.email;
          body.emergency_contact_relationship = ecForm.relationship;
        }
        const res  = await fetch(`${API}/users/`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.detail || 'Registration failed.'); return; }
        // Auto-login after signup
        const lr  = await fetch(`${API}/login/`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ username: form.username, password: form.password }),
        });
        const ld = await lr.json();
        if (lr.ok) onLogin(ld); else setError('Account created! Please sign in.');
      }
    } catch {
      setError('Network error — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" data-theme={theme}>
      <div className="login-backdrop"/>
      <button className="theme-toggle-floating" onClick={toggleTheme} title="Toggle theme">
        {theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
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

          <div className="auth-tabs">
            <button className={`auth-tab ${tab==='login'?'active':''}`} onClick={()=>{setTab('login');setError('');}}>Sign In</button>
            <button className={`auth-tab ${tab==='signup'?'active':''}`} onClick={()=>{setTab('signup');setError('');}}>Create Account</button>
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle size={17}/>
              <span>{error}</span>
            </div>
          )}

          {tab==='signup' && (
            <div className="input-group">
              <label>Full Name</label>
              <input type="text" placeholder="Your name" value={form.name} onChange={set('name')}/>
            </div>
          )}

          <div className="input-group">
            <label>Username</label>
            <input
              type="text" placeholder="Choose a username"
              value={form.username} onChange={set('username')}
              onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
            />
          </div>

          {tab==='signup' && (
            <div className="input-group">
              <label>Email Address <span style={{fontWeight:400,color:'var(--text-tertiary)'}}>(optional)</span></label>
              <input type="email" placeholder="your@email.com" value={form.email} onChange={set('email')}/>
            </div>
          )}

          <div className="input-group">
            <label>Password</label>
            <div style={{position:'relative'}}>
              <input
                type={showPw?'text':'password'} placeholder="Password"
                value={form.password} onChange={set('password')}
                onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
                style={{paddingRight:'42px'}}
              />
              <button
                onClick={()=>setShowPw(p=>!p)}
                style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-tertiary)',display:'flex',alignItems:'center'}}
              >
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>

          {tab==='signup' && (
            <div className="ec-prompt">
              <h4>Emergency Contact <span style={{fontWeight:400,color:'var(--text-tertiary)'}}>(Recommended)</span></h4>
              <p>Add someone we can notify if our AI detects a mental health crisis. Completely confidential.</p>
              {ecForm.saved ? (
                <div className="ec-saved">
                  <div className="ec-saved-check"><Check size={15}/></div>
                  <div>
                    <div className="ec-saved-name">✓ {ecForm.name}</div>
                    <div className="ec-saved-detail">{ecForm.relationship && `${ecForm.relationship} · `}{ecForm.phone || ecForm.email}</div>
                  </div>
                </div>
              ) : ecForm.show ? (
                <div className="ec-form">
                  <div className="ec-field"><label>Contact Name *</label><input type="text" placeholder="e.g. Mom, Best Friend" value={ecForm.name} onChange={setEc('name')}/></div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                    <div className="ec-field"><label>Phone</label><input type="tel" placeholder="+1 555-0000" value={ecForm.phone} onChange={setEc('phone')}/></div>
                    <div className="ec-field"><label>Email</label><input type="email" placeholder="email@..." value={ecForm.email} onChange={setEc('email')}/></div>
                  </div>
                  <div className="ec-field"><label>Relationship</label><input type="text" placeholder="Parent, Friend, Partner..." value={ecForm.relationship} onChange={setEc('relationship')}/></div>
                  <label className="ec-consent">
                    <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
                    I consent to this contact being notified only in confirmed crisis situations.
                  </label>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button className="btn-save-ec" onClick={saveEcContact}><Check size={13}/>Save Contact</button>
                    <button className="btn-ghost" onClick={()=>setEcForm(p=>({...p,show:false}))} style={{padding:'9px 14px',fontSize:'0.8rem'}}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn-add-ec" onClick={()=>setEcForm(p=>({...p,show:true}))}>
                  <Plus size={13}/> Add Emergency Contact
                </button>
              )}
            </div>
          )}

          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader size={17} className="spin"/> : <Send size={17}/>}
            {loading ? (tab==='login'?'Signing in…':'Creating account…') : (tab==='login'?'Sign In':'Create Account')}
          </button>

          <div className="auth-switch">
            {tab==='login'
              ? (<>No account? <button className="link-button" onClick={()=>{setTab('signup');setError('');}}>Sign up free</button></>)
              : (<>Have an account? <button className="link-button" onClick={()=>{setTab('login');setError('');}}>Sign in</button></>)
            }
          </div>

          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon"><Brain size={26} strokeWidth={1.4} style={{color:'var(--primary)'}}/></div>
              <h3>AI Powered</h3><p>Agentic RAG</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><Shield size={26} strokeWidth={1.4} style={{color:'var(--secondary)'}}/></div>
              <h3>Crisis Safe</h3><p>Real-time alerts</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><Heart size={26} strokeWidth={1.4} style={{color:'#fb7185'}}/></div>
              <h3>Mood Track</h3><p>Daily insights</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================== TASK CARD ==================

function TaskCard({ task, onUpdate, done }) {
  const cats = {
    breathing  : { bg:'rgba(110,181,181,0.12)', color:'var(--secondary)',     icon:<Coffee size={16}/> },
    exercise   : { bg:'rgba(251,191,36,0.12)',  color:'#fbbf24',              icon:<Activity size={16}/> },
    mindfulness: { bg:'rgba(155,136,219,0.12)', color:'var(--primary-light)', icon:<Leaf size={16}/> },
    journaling : { bg:'rgba(251,113,133,0.12)', color:'#fb7185',              icon:<BookOpen size={16}/> },
    social     : { bg:'rgba(52,211,153,0.12)',  color:'#34d399',              icon:<MessageCircle size={16}/> },
  };
  const cat  = cats[task.category?.toLowerCase()] || { bg:'rgba(155,136,219,0.08)', color:'var(--text-secondary)', icon:<Target size={16}/> };
  const pris = { high:{label:'High',c:'#f87171'}, medium:{label:'Med',c:'#fbbf24'}, low:{label:'Low',c:'var(--secondary)'} };
  const pri  = pris[task.priority?.toLowerCase()] || pris.medium;
  const id   = task.task_id || task.id;

  return (
    <div className="task-item" style={{opacity:done?0.6:1}}>
      <div className="task-cat-icon" style={{background:cat.bg,color:cat.color}}>{cat.icon}</div>
      <div className="task-info">
        {/* FIX: prefer title, fall back to task then name */}
        <div className="task-name">{task.title || task.task || task.name}</div>
        {task.description && <div style={{fontSize:'0.78rem',color:'var(--text-secondary)',marginBottom:'6px',lineHeight:1.5}}>{task.description}</div>}
        <div className="task-meta">
          <span className="task-meta-badge" style={{color:pri.c,borderColor:`${pri.c}40`}}>{pri.label}</span>
          {task.category && <span className="task-meta-badge" style={{textTransform:'capitalize'}}>{task.category}</span>}
          {task.duration && <span className="task-meta-badge"><Clock size={9}/> {task.duration}</span>}
          <span className="task-meta-badge" style={{textTransform:'capitalize'}}>{(task.status||'').replace('_',' ')}</span>
        </div>
      </div>
      {!done ? (
        <div className="task-actions">
          {task.status === 'not_started' && (
            <button className="task-action-btn start" title="Start" onClick={()=>onUpdate(id,'in_progress')}><Play size={11}/></button>
          )}
          <button className="task-action-btn complete" title="Complete" onClick={()=>onUpdate(id,'completed')}><Check size={11}/></button>
          <button className="task-action-btn" title="Skip" onClick={()=>onUpdate(id,'skipped')}><Minus size={11}/></button>
        </div>
      ) : (
        <CheckCircle size={17} strokeWidth={2} style={{color:'var(--secondary)',flexShrink:0}}/>
      )}
    </div>
  );
}

// ================== MAIN APP ==================

export default function App() {
  const [theme, setTheme]           = useState('dark');
  const [user, setUser]             = useState(null);
  const [activeView, setActiveView] = useState('chat');
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [lang, setLang]             = useState('en');
  const [mood, setMood]             = useState(5);
  const [moodNotes, setMoodNotes]   = useState('');
  const [moodOpen, setMoodOpen]     = useState(false);
  const [moodHistory, setMoodHistory]   = useState([]);
  const [tasks, setTasks]           = useState([]);
  const [profile, setProfile]       = useState(null);
  const [crisisBanner, setCrisisBanner] = useState(null);
  const [ragStats, setRagStats]     = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [clearStatus, setClearStatus]   = useState(null);
  const [crisisTest, setCrisisTest] = useState({ text:'', result:null, loading:false });
  const [ecForm, setEcForm]         = useState({ name:'',phone:'',email:'',relationship:'',show:false,saved:false });
  const endRef  = useRef(null);
  const fileRef = useRef(null);

  const toggleTheme = () => setTheme(p => p==='dark'?'light':'dark');

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  useEffect(() => {
    if (!user) return;
    setMessages([{
      role:'assistant', id:1,
      // FIX: user now has full_name from the login response
      content:`Hello${user.full_name?`, ${user.full_name.split(' ')[0]}`:''}! 👋 I'm MindfulAI, your compassionate mental wellness companion. How are you feeling today?`,
      badges:[]
    }]);
    loadMoodHistory();
    loadTasks();
    loadProfile();
    if (user.is_admin) loadRagStats();
  }, [user]);

  const loadMoodHistory = async () => {
    try { const r = await fetch(`${API}/mood/${user.id}`); if(r.ok) setMoodHistory(await r.json()); } catch {}
  };

  const loadTasks = async () => {
    try {
      // FIX: agent stores tasks under the string key "db_user_{id}"
      const r = await fetch(`${API}/api/tasks/db_user_${user.id}`);
      if(r.ok){ const d=await r.json(); setTasks(d.tasks||[]); }
    } catch {}
  };

  const loadProfile = async () => {
    try { const r = await fetch(`${API}/profile/${user.id}`); if(r.ok) setProfile(await r.json()); } catch {}
  };

  const loadRagStats = async () => {
    try { const r = await fetch(`${API}/api/admin/rag-stats`); if(r.ok) setRagStats(await r.json()); } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setMessages(p=>[...p,{ role:'user', id:Date.now(), content:text, badges:[] }]);
    setInput(''); setLoading(true); setCrisisBanner(null);
    try {
      const res  = await fetch(`${API}/chat/`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user_id:user.id, message:text, language:lang }),
      });
      const data = await res.json();

      const badges = [];
      if (data.rag_used) badges.push({ type:'rag', label:'Knowledge Base' });
      if (data.tools_used?.length) data.tools_used.forEach(t=>badges.push({ type:'tool', label:t }));

      setMessages(p=>[...p,{
        role:'assistant', id:Date.now()+1,
        content: data.response || data.message || 'I hear you.',
        badges
      }]);

      // FIX: crisis is nested under data.crisis (not top-level)
      if (data.crisis && data.crisis.risk_level !== 'low') {
        setCrisisBanner(data.crisis);
      }
    } catch {
      setMessages(p=>[...p,{ role:'assistant', id:Date.now()+2, content:"I'm having trouble connecting right now. Please try again.", badges:[] }]);
    }
    setLoading(false);
  };

  const saveMood = async () => {
    try {
      // FIX: send `score` not `mood_score`
      await fetch(`${API}/mood/`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user_id:user.id, score:mood, notes:moodNotes })
      });
      setMoodNotes(''); loadMoodHistory();
    } catch {}
  };

  const updateTask = async (taskId, status) => {
    try {
      // FIX: use agent string key in the path
      await fetch(`${API}/api/tasks/db_user_${user.id}/${taskId}`, {
        method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status})
      });
      loadTasks();
    } catch {}
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    const fd = new FormData(); fd.append('file', uploadFile);
    try {
      const res = await fetch(`${API}/api/admin/upload-csv`, { method:'POST', body:fd });
      const d   = await res.json();
      setUploadStatus({ ok:res.ok, msg:d.message||(res.ok?'Uploaded!':'Failed.') });
      if(res.ok){ setUploadFile(null); loadRagStats(); }
    } catch { setUploadStatus({ ok:false, msg:'Upload failed.' }); }
  };

  const clearKnowledge = async () => {
    if (!confirm('Delete ALL knowledge base documents? This cannot be undone.')) return;
    try {
      const r = await fetch(`${API}/api/admin/clear-knowledge`,{method:'DELETE'});
      const d = await r.json();
      setClearStatus({ok:r.ok,msg:d.message||'Done.'});
      loadRagStats();
    } catch {}
  };

  const testCrisis = async () => {
    if (!crisisTest.text.trim()) return;
    setCrisisTest(p=>({...p,loading:true,result:null}));
    try {
      const res    = await fetch(`${API}/crisis-detect/`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ message:crisisTest.text, user_id:user.id })
      });
      const result = await res.json();
      setCrisisTest(p=>({...p,loading:false,result}));
    } catch {
      setCrisisTest(p=>({...p,loading:false,result:{error:'Test failed.'}}));
    }
  };

  const saveEcContact = async () => {
    if (!ecForm.name || (!ecForm.phone && !ecForm.email)) return;
    try {
      await fetch(`${API}/crisis-contact/`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          user_id                       : user.id,
          emergency_contact_name        : ecForm.name,
          emergency_contact_phone       : ecForm.phone,
          emergency_contact_email       : ecForm.email,
          emergency_contact_relationship: ecForm.relationship,
        })
      });
      setEcForm(p=>({...p,saved:true,show:false}));
    } catch {}
  };

  if (!user) return <AuthScreen onLogin={setUser} theme={theme} toggleTheme={toggleTheme}/>;

  const pendingTasks = tasks.filter(t=>t.status==='not_started'||t.status==='in_progress');
  const doneTasks    = tasks.filter(t=>t.status==='completed');

  const VIEWS = [
    { id:'chat',    label:'Chat',            icon:<MessageCircle size={17}/> },
    { id:'mood',    label:'Mood History',     icon:<Activity size={17}/> },
    { id:'tasks',   label:'Wellness Tasks',   icon:<List size={17}/> },
    { id:'crisis',  label:'Crisis Detection', icon:<AlertTriangle size={17}/> },
    { id:'profile', label:'My Profile',       icon:<User size={17}/> },
    { id:'rag',     label:'RAG Pipeline',     icon:<Database size={17}/> },
    ...(user.is_admin ? [{ id:'admin', label:'Admin Portal', icon:<Key size={17}/>, admin:true }] : []),
  ];

  return (
    <div className="app-container" data-theme={theme}>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon-small"><Brain strokeWidth={1.4} style={{width:'100%',height:'100%'}}/></div>
            <div>
              <h2>MindfulAI</h2>
              {/* FIX: show full_name when available */}
              <span className="user-greeting">Hi, {user.full_name?.split(' ')[0] || user.username} 👋</span>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="section-label">Navigation</span>
          <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
            {VIEWS.map(v=>(
              <button key={v.id} className={`feature-btn ${activeView===v.id?'active':''}`} onClick={()=>setActiveView(v.id)}
                style={v.admin&&activeView!==v.id ? {borderColor:'rgba(251,191,36,0.3)',color:'#fbbf24'} : {}}>
                {v.icon}
                <span style={{flex:1,textAlign:'left'}}>{v.label}</span>
                {v.admin && <span style={{fontSize:'0.6rem',background:'rgba(251,191,36,0.15)',color:'#fbbf24',padding:'2px 5px',borderRadius:'4px',fontWeight:700}}>ADMIN</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-section">
          <span className="section-label">Mood Check-in</span>
          <button className={`mood-toggle ${moodOpen?'active':''}`} onClick={()=>setMoodOpen(p=>!p)}>
            <span className="mood-icon" style={{display:'flex',alignItems:'center',color:'var(--primary)'}}>{getMoodIcon(mood)}</span>
            <span style={{flex:1,textAlign:'left'}}>Log your mood</span>
            <ChevronDown size={15} className={`chevron ${moodOpen?'rotated':''}`}/>
          </button>
          {moodOpen && (
            <div className="mood-tracker">
              <div className="mood-display">
                <div className="mood-emoji" style={{color:'var(--primary)'}}>{getMoodIcon(mood)}</div>
                <div className="mood-info">
                  <span className="mood-score">{mood}/10</span>
                  <span className="mood-label-text">{MOOD_LABELS[mood]}</span>
                </div>
              </div>
              <div className="mood-slider-wrapper">
                <input type="range" min="1" max="10" value={mood} onChange={e=>setMood(+e.target.value)} className="mood-slider"/>
                <div className="slider-labels"><span>Terrible</span><span>Okay</span><span>Excellent</span></div>
              </div>
              <textarea className="mood-notes" rows={2} placeholder="Optional notes…" value={moodNotes} onChange={e=>setMoodNotes(e.target.value)}/>
              <button className="btn-secondary" onClick={saveMood}><Check size={13}/> Save Mood</button>
            </div>
          )}
        </div>

        {moodHistory.length > 0 && (
          <div className="sidebar-section">
            <span className="section-label">Recent Moods</span>
            <div className="mood-history">
              {moodHistory.slice(0,4).map((entry,i)=>(
                <div key={i} className="mood-entry">
                  <div className="mood-entry-emoji" style={{color:'var(--primary)'}}>{getMoodIcon(entry.score)}</div>
                  <div className="mood-entry-details">
                    <div className="mood-entry-label">{MOOD_LABELS[entry.score]}</div>
                    <div className="mood-entry-time">{new Date(entry.timestamp||Date.now()).toLocaleDateString()}</div>
                  </div>
                  <div className="mood-entry-score">{entry.score}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{flex:1}}/>

        <div className="sidebar-section">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}
            {theme==='dark'?'Light Mode':'Dark Mode'}
          </button>
        </div>
        <div className="sidebar-section">
          <button className="btn-settings" onClick={()=>setActiveView('profile')}><Settings size={15}/> Profile & Settings</button>
          <button className="btn-logout" onClick={()=>{setUser(null);setMessages([]);}}><LogOut size={15}/> Sign Out</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="chat-main">

        {/* ---- CHAT ---- */}
        {activeView==='chat' && <>
          <div className="chat-header">
            <div className="chat-header-content">
              <h2>Wellness Chat</h2>
              <span className="chat-subtitle">Your AI companion for mental wellness</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <select className="lang-select-header" value={lang} onChange={e=>setLang(e.target.value)}>
                {Object.entries(LANGUAGES).map(([k,v])=><option key={k} value={k}>{v.flag} {v.name}</option>)}
              </select>
              <div className="chat-status"><div className="status-indicator"/><span>Online</span></div>
            </div>
          </div>

          {crisisBanner && (
            <div className="crisis-banner">
              <div className="crisis-banner-icon">⚠️</div>
              <div>
                <div className="crisis-banner-title">Support Resources Available</div>
                <div className="crisis-banner-sub">
                  {crisisBanner.risk_level==='critical'
                    ? "If you're in immediate danger, please reach out now."
                    : "I'm noticing some distress. These resources may help."}
                </div>
                <div className="crisis-resources">
                  <button className="crisis-res-btn">📞 988 Lifeline</button>
                  <button className="crisis-res-btn">💬 Text HOME to 741741</button>
                  <button className="crisis-res-btn" onClick={()=>setCrisisBanner(null)}>✕ Dismiss</button>
                </div>
              </div>
            </div>
          )}

          <div className="messages-container">
            <div className="messages-inner">
              {messages.map(msg=>(
                <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                  <div className="message-bubble">
                    {msg.role==='assistant' && <div className="message-avatar assistant-avatar"><Brain size={18} strokeWidth={1.5}/></div>}
                    {msg.role==='user' && <div style={{order:2}}><div className="message-avatar user-avatar">{user.full_name?.[0]?.toUpperCase()||user.username?.[0]?.toUpperCase()||'U'}</div></div>}
                    <div className="message-content">
                      <div className="message-text">{msg.content}</div>
                      {msg.badges?.length>0 && (
                        <div className="msg-meta">
                          {msg.badges.map((b,i)=>(
                            <span key={i} className={`meta-badge ${b.type}`}>
                              {b.type==='rag'&&<Database size={9}/>}
                              {b.type==='tool'&&<Wrench size={9}/>}
                              {b.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="message-wrapper assistant">
                  <div className="message-bubble">
                    <div className="message-avatar assistant-avatar"><Brain size={18} strokeWidth={1.5}/></div>
                    <div className="message-content"><div className="typing-indicator"><span/><span/><span/></div></div>
                  </div>
                </div>
              )}
              <div ref={endRef}/>
            </div>
          </div>

          <div className="input-area">
            <div className="input-container">
              <textarea rows={1} placeholder={LANGUAGES[lang]?.placeholder} value={input}
                onChange={e=>setInput(e.target.value)} disabled={loading}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}}/>
              <button className="btn-send" onClick={sendMessage} disabled={loading||!input.trim()}>
                {loading?<Loader size={17} className="spin"/>:<Send size={17}/>}
              </button>
            </div>
            <div className="input-hint">Enter to send · Shift+Enter for new line</div>
          </div>
        </>}

        {/* ---- MOOD HISTORY ---- */}
        {activeView==='mood' && <>
          <div className="chat-header">
            <div className="chat-header-content"><h2>Mood History</h2><span className="chat-subtitle">Track your emotional journey over time</span></div>
            <button className="btn-secondary" onClick={loadMoodHistory} style={{width:'auto',padding:'8px 16px'}}><RefreshCw size={13}/> Refresh</button>
          </div>
          <div className="profile-page">
            {moodHistory.length===0 ? (
              <div className="empty-state"><div className="empty-state-icon"><Activity size={46} strokeWidth={1}/></div><p>No mood entries yet. Use the sidebar slider to log your first mood!</p></div>
            ) : (<>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:'var(--space-md)',marginBottom:'var(--space-xl)'}}>
                {[
                  {label:'Total Entries', val:moodHistory.length,                                                          icon:<List size={19}/>},
                  {label:'Average Mood',  val:(moodHistory.reduce((s,e)=>s+e.score,0)/moodHistory.length).toFixed(1),      icon:<Activity size={19}/>},
                  {label:'Best Mood',     val:Math.max(...moodHistory.map(e=>e.score)),                                    icon:<TrendingUp size={19}/>},
                ].map((s,i)=>(
                  <div key={i} className="panel-card" style={{textAlign:'center',padding:'var(--space-lg)'}}>
                    <div style={{color:'var(--primary)',marginBottom:'8px'}}>{s.icon}</div>
                    <div style={{fontSize:'1.55rem',fontWeight:700,color:'var(--text-primary)'}}>{s.val}</div>
                    <div style={{fontSize:'0.72rem',color:'var(--text-tertiary)',marginTop:'3px'}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
                {[...moodHistory].reverse().map((entry,i)=>(
                  <div key={i} className="mood-entry">
                    <div className="mood-entry-emoji">{getMoodIcon(entry.score)}</div>
                    <div className="mood-entry-details">
                      <div className="mood-entry-label">{MOOD_LABELS[entry.score]} — {entry.score}/10</div>
                      {entry.notes && <div style={{fontSize:'0.75rem',color:'var(--text-secondary)',marginTop:'2px'}}>{entry.notes}</div>}
                      <div className="mood-entry-time">{new Date(entry.timestamp||Date.now()).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>)}
          </div>
        </>}

        {/* ---- TASKS ---- */}
        {activeView==='tasks' && <>
          <div className="chat-header">
            <div className="chat-header-content"><h2>Wellness Tasks</h2><span className="chat-subtitle">Personalized activities for your mental health</span></div>
            <button className="btn-secondary" onClick={loadTasks} style={{width:'auto',padding:'8px 16px'}}><RefreshCw size={13}/> Refresh</button>
          </div>
          <div className="tasks-page">
            {tasks.length===0 ? (
              <div className="empty-state"><div className="empty-state-icon"><List size={46} strokeWidth={1}/></div><p>No tasks yet. Chat with me and I'll suggest personalized wellness activities!</p></div>
            ) : (<>
              {pendingTasks.length>0 && <>
                <div className="tasks-section-title"><Target size={13}/> Active Tasks ({pendingTasks.length})</div>
                {pendingTasks.map(t=><TaskCard key={t.task_id||t.id} task={t} onUpdate={updateTask}/>)}
              </>}
              {doneTasks.length>0 && <>
                {pendingTasks.length>0 && <div className="task-divider"/>}
                <div className="tasks-section-title"><Check size={13}/> Completed ({doneTasks.length})</div>
                {doneTasks.map(t=><TaskCard key={t.task_id||t.id} task={t} onUpdate={updateTask} done/>)}
              </>}
            </>)}
          </div>
        </>}

        {/* ---- CRISIS DETECTION ---- */}
        {activeView==='crisis' && (
          <div className="crisis-detection">
            <div className="crisis-header">
              <h2>Crisis Detection & Safety</h2>
              <button className="btn-ghost" onClick={()=>setActiveView('chat')}><X size={14}/> Close</button>
            </div>

            <div className="panel-card">
              <h3><AlertTriangle size={17}/> Test Crisis Detection</h3>
              <p style={{fontSize:'0.82rem',color:'var(--text-tertiary)',marginBottom:'var(--space-md)'}}>
                Enter a message to test how the AI analyzes it for risk signals.
              </p>
              <textarea className="panel-textarea" placeholder="Enter a test message to analyze…" value={crisisTest.text} onChange={e=>setCrisisTest(p=>({...p,text:e.target.value}))} rows={3}/>
              <button className="btn-primary" onClick={testCrisis} disabled={crisisTest.loading||!crisisTest.text.trim()} style={{width:'auto',padding:'10px 20px'}}>
                {crisisTest.loading?<Loader size={15} className="spin"/>:<Shield size={15}/>}
                {crisisTest.loading?'Analyzing…':'Analyze Message'}
              </button>
              {crisisTest.result && !crisisTest.result.error && (
                <div style={{marginTop:'var(--space-lg)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'var(--space-md)'}}>
                    <span style={{fontSize:'0.82rem',fontWeight:600,color:'var(--text-secondary)'}}>Risk Level:</span>
                    <span className={`risk-badge risk-${crisisTest.result.risk_level||'low'}`}>{(crisisTest.result.risk_level||'low').toUpperCase()}</span>
                  </div>
                  {/* FIX: read `indicators` (or fall back to harm_indicators) */}
                  {(crisisTest.result.indicators||crisisTest.result.harm_indicators||[]).length > 0 && (
                    <div>
                      <div style={{fontSize:'0.72rem',color:'var(--text-tertiary)',marginBottom:'6px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Detected Indicators</div>
                      <div className="keyword-list">
                        {(crisisTest.result.indicators||crisisTest.result.harm_indicators).map((k,i)=><span key={i} className="keyword-tag">{k}</span>)}
                      </div>
                    </div>
                  )}
                  {crisisTest.result.response && (
                    <div className="crisis-response-box">
                      <div style={{fontSize:'0.68rem',color:'var(--text-tertiary)',marginBottom:'6px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>AI Response Preview</div>
                      {crisisTest.result.response}
                    </div>
                  )}
                </div>
              )}
              {crisisTest.result?.error && <div className="result-banner error" style={{marginTop:'var(--space-md)'}}><AlertCircle size={15}/>{crisisTest.result.error}</div>}
            </div>

            <div className="panel-card">
              <h3><Phone size={17}/> Emergency Contact</h3>
              {ecForm.saved ? (
                <div className="ec-saved">
                  <div className="ec-saved-check"><Check size={14}/></div>
                  <div>
                    <div className="ec-saved-name">✓ {ecForm.name}</div>
                    <div className="ec-saved-detail">{ecForm.relationship} · {ecForm.phone||ecForm.email}</div>
                  </div>
                </div>
              ) : ecForm.show ? (
                <div>
                  {[
                    {l:'Contact Name', k:'name',        t:'text',  p:'e.g. Mom, Therapist'},
                    {l:'Phone',        k:'phone',        t:'tel',   p:'+1 555-0000'},
                    {l:'Email',        k:'email',        t:'email', p:'contact@email.com'},
                    {l:'Relationship', k:'relationship', t:'text',  p:'Parent, Friend…'},
                  ].map(f=>(
                    <div key={f.k} style={{marginBottom:'var(--space-md)'}}>
                      <label style={{display:'block',fontSize:'0.8rem',fontWeight:600,color:'var(--text-primary)',marginBottom:'5px'}}>{f.l}</label>
                      <input className="panel-input" type={f.t} placeholder={f.p} value={ecForm[f.k]} onChange={e=>setEcForm(p=>({...p,[f.k]:e.target.value}))}/>
                    </div>
                  ))}
                  <div style={{display:'flex',gap:'8px'}}>
                    <button className="btn-primary" onClick={saveEcContact} style={{width:'auto',padding:'10px 20px'}}><Check size={15}/> Save Contact</button>
                    <button className="btn-ghost" onClick={()=>setEcForm(p=>({...p,show:false}))}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{fontSize:'0.875rem',color:'var(--text-secondary)',marginBottom:'var(--space-md)'}}>Add an emergency contact who will be notified automatically if high-risk crisis signals are detected.</p>
                  <button className="btn-secondary" onClick={()=>setEcForm(p=>({...p,show:true}))} style={{width:'auto',padding:'10px 18px'}}><Plus size={15}/> Add Emergency Contact</button>
                </div>
              )}
            </div>

            <div className="panel-card">
              <h3><Heart size={17}/> Crisis Resources</h3>
              <div className="emergency-resources">
                <ul>
                  {[
                    '📞 988 Suicide & Crisis Lifeline — Call or text 988 (US)',
                    '💬 Crisis Text Line — Text HOME to 741741',
                    '🌐 IASP — https://www.iasp.info/resources/Crisis_Centres/',
                    '🏥 NAMI Helpline — 1-800-950-6264',
                    '💙 Online chat — 988lifeline.org/chat',
                  ].map((r,i)=><li key={i}>{r}</li>)}
                </ul>
              </div>
              <div className="safety-info">
                <p>Our AI monitors every conversation for crisis signals and can automatically alert your emergency contact for high-risk situations. If you're in immediate danger, call 911 or your local emergency services.</p>
              </div>
            </div>
          </div>
        )}

        {/* ---- PROFILE ---- */}
        {activeView==='profile' && <>
          <div className="chat-header">
            <div className="chat-header-content"><h2>My Profile</h2><span className="chat-subtitle">Your wellness journey & preferences</span></div>
            <button className="btn-secondary" onClick={loadProfile} style={{width:'auto',padding:'8px 16px'}}><RefreshCw size={13}/> Refresh</button>
          </div>
          <div className="profile-page">
            <div className="profile-header">
              <div className="profile-avatar">{user.full_name?.[0]?.toUpperCase()||user.username?.[0]?.toUpperCase()||'U'}</div>
              <div>
                {/* FIX: show full_name */}
                <div className="profile-name">{user.full_name||user.username}</div>
                <div className="profile-email">
                  @{user.username}
                  {user.is_admin && <span style={{marginLeft:'7px',fontSize:'0.65rem',background:'rgba(251,191,36,0.15)',color:'#fbbf24',padding:'2px 7px',borderRadius:'5px',fontWeight:700}}>ADMIN</span>}
                </div>
              </div>
              <div className="profile-stats">
                {[
                  {v:moodHistory.length,                         l:'Mood Logs'},
                  {v:messages.filter(m=>m.role==='user').length, l:'Messages'},
                  {v:doneTasks.length,                           l:'Tasks Done'},
                ].map((s,i)=>(
                  <div key={i} className="profile-stat">
                    <div className="profile-stat-val">{s.v}</div>
                    <div className="profile-stat-label">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {profile ? (<>
              {/* FIX: backend now returns `goals` directly */}
              {profile.goals?.length>0 && (
                <div className="profile-section-card">
                  <div className="profile-section-title"><Target size={13}/> Wellness Goals</div>
                  <div className="tag-list">{profile.goals.map((g,i)=><span key={i} className="tag tag-primary">{g}</span>)}</div>
                </div>
              )}
              {profile.coping_strategies?.length>0 && (
                <div className="profile-section-card">
                  <div className="profile-section-title"><Sparkles size={13}/> Coping Strategies</div>
                  <div className="tag-list">{profile.coping_strategies.map((s,i)=><span key={i} className="tag tag-teal">{s}</span>)}</div>
                </div>
              )}
              {profile.triggers?.length>0 && (
                <div className="profile-section-card">
                  <div className="profile-section-title"><AlertTriangle size={13}/> Known Triggers</div>
                  <div className="tag-list">{profile.triggers.map((t,i)=><span key={i} className="tag tag-amber">{t}</span>)}</div>
                </div>
              )}
              {profile.emotional_state && (
                <div className="profile-section-card">
                  <div className="profile-section-title"><Activity size={13}/> Current Emotional State</div>
                  <p style={{fontSize:'0.875rem',color:'var(--text-secondary)'}}>{profile.emotional_state}</p>
                </div>
              )}
            </>) : (
              <div className="empty-state">
                <div className="empty-state-icon"><User size={46} strokeWidth={1}/></div>
                <p>Start chatting to build your wellness profile. I'll learn about your goals, triggers, and coping strategies.</p>
              </div>
            )}
          </div>
        </>}

        {/* ---- RAG PIPELINE ---- */}
        {activeView==='rag' && <>
          <div className="chat-header">
            <div className="chat-header-content"><h2>RAG Pipeline</h2><span className="chat-subtitle">How our knowledge retrieval works</span></div>
          </div>
          <div className="profile-page">
            <div className="panel-card">
              <h3><Database size={17}/> Agentic RAG Architecture</h3>
              {[
                {n:1,title:'Message Received',    desc:'Your message is received by the LangGraph agent which decides the optimal approach.'},
                {n:2,title:'Intent Analysis',     desc:'The agent analyzes emotional content to determine if knowledge retrieval will enhance the response.'},
                {n:3,title:'Knowledge Search',    desc:'The search_knowledge_base tool queries ChromaDB using sentence-transformers embeddings.'},
                {n:4,title:'Context Fusion',      desc:'Retrieved documents merge with conversation history to create rich contextual input.'},
                {n:5,title:'Emotional Analysis',  desc:'analyze_emotional_state tool runs to better understand your current mental state.'},
                {n:6,title:'Strategy Suggestion', desc:'suggest_coping_strategies tool recommends evidence-based techniques if appropriate.'},
                {n:7,title:'Response Generation', desc:'Groq LLM generates a compassionate, contextually aware response.'},
              ].map(s=>(
                <div key={s.n} className="rag-step">
                  <div className="rag-step-num">{s.n}</div>
                  <div><div className="rag-step-title">{s.title}</div><div className="rag-step-desc">{s.desc}</div></div>
                </div>
              ))}
            </div>
            <div className="panel-card" style={{marginTop:'var(--space-lg)'}}>
              <h3><Sparkles size={17}/> Graceful Degradation Chain</h3>
              {[
                {n:1,title:'LangGraph Agent', desc:'Full agentic pipeline with tool calling, state management, and memory.'},
                {n:2,title:'Simple Pipeline', desc:'Fallback: direct RAG search + LLM response if LangGraph is unavailable.'},
                {n:3,title:'Direct LLM',      desc:'Second fallback: Groq LLM response without retrieval context.'},
                {n:4,title:'Static Response', desc:'Last resort: compassionate pre-written responses to ensure you always get support.'},
              ].map(s=>(
                <div key={s.n} className="rag-step">
                  <div className="rag-step-num">{s.n}</div>
                  <div><div className="rag-step-title">{s.title}</div><div className="rag-step-desc">{s.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ---- ADMIN PORTAL ---- */}
        {activeView==='admin' && user.is_admin && <>
          <div className="chat-header">
            <div className="chat-header-content">
              <h2>Admin Portal</h2>
              <span className="chat-subtitle">Knowledge base management & system monitoring</span>
            </div>
            <button className="btn-secondary" onClick={loadRagStats} style={{width:'auto',padding:'8px 16px'}}><RefreshCw size={13}/> Refresh</button>
          </div>
          <div className="profile-page">
            {ragStats && (
              <div className="admin-grid">
                {[
                  {icon:<Database size={20}/>,    label:'Documents',    val:ragStats.document_count??ragStats.total_documents??'—'},
                  {icon:<Brain size={20}/>,       label:'Collections',  val:ragStats.collection_count??ragStats.collections??'—'},
                  {icon:<Activity size={20}/>,    label:'Queries Today',val:ragStats.queries_today??'—'},
                  {icon:<CheckCircle size={20}/>, label:'Status',       val:ragStats.status??'Active'},
                ].map((s,i)=>(
                  <div key={i} className="admin-stat">
                    <div className="admin-stat-icon" style={{color:'var(--primary)'}}>{s.icon}</div>
                    <div className="admin-stat-val">{s.val}</div>
                    <div className="admin-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="panel-card">
              <h3><Upload size={17}/> Upload Knowledge CSV</h3>
              <p style={{fontSize:'0.8rem',color:'var(--text-tertiary)',marginBottom:'var(--space-md)'}}>
                CSV format: <code style={{background:'rgba(155,136,219,0.1)',padding:'2px 6px',borderRadius:'4px'}}>question, answer</code>
              </p>
              <div
                className={`upload-zone ${uploadFile?'has-file':''}`}
                onClick={()=>fileRef.current?.click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('active');}}
                onDragLeave={e=>e.currentTarget.classList.remove('active')}
                onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove('active');setUploadFile(e.dataTransfer.files[0]);setUploadStatus(null);}}
              >
                <div className="upload-zone-icon">
                  {uploadFile?<CheckCircle size={38} strokeWidth={1.5} style={{color:'var(--primary)'}}/>:<Upload size={38} strokeWidth={1}/>}
                </div>
                <div className="upload-zone-text">{uploadFile?uploadFile.name:'Drop your CSV here or click to browse'}</div>
                <div className="upload-zone-sub">{uploadFile?`${(uploadFile.size/1024).toFixed(1)} KB ready`:'Supports .csv files'}</div>
                <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={e=>{setUploadFile(e.target.files[0]);setUploadStatus(null);}}/>
              </div>
              {uploadStatus && (
                <div className={`result-banner ${uploadStatus.ok?'success':'error'}`}>
                  {uploadStatus.ok?<CheckCircle size={15}/>:<AlertCircle size={15}/>}{uploadStatus.msg}
                </div>
              )}
              <div style={{display:'flex',gap:'8px',marginTop:'var(--space-md)'}}>
                <button className="btn-primary" onClick={handleUpload} disabled={!uploadFile} style={{width:'auto',padding:'10px 20px'}}>
                  <Upload size={15}/> Upload
                </button>
                <button className="btn-ghost" onClick={()=>{
                  const csv=`question,answer\n"What is anxiety?","Anxiety is a natural stress response..."\n"How to practice mindfulness?","Start with 5-10 minutes daily..."`;
                  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='sample_knowledge.csv';a.click();
                }}>
                  <Download size={15}/> Sample CSV
                </button>
              </div>
            </div>

            <div className="panel-card">
              <h3 style={{color:'#f87171'}}><AlertTriangle size={17}/> Danger Zone</h3>
              {clearStatus && <div className={`result-banner ${clearStatus.ok?'success':'error'}`} style={{marginBottom:'var(--space-md)'}}>{clearStatus.ok?<CheckCircle size={15}/>:<AlertCircle size={15}/>}{clearStatus.msg}</div>}
              <div className="danger-zone">
                <div className="danger-zone-inner">
                  <div>
                    <div className="danger-zone-title">Clear Knowledge Base</div>
                    <div className="danger-zone-sub">Permanently delete all documents from ChromaDB. Cannot be undone.</div>
                  </div>
                  <button className="btn-danger" onClick={clearKnowledge}><Trash2 size={14}/> Clear All</button>
                </div>
              </div>
            </div>
          </div>
        </>}

        {activeView==='admin' && !user.is_admin && (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'var(--space-lg)'}}>
            <Lock size={50} strokeWidth={1} style={{color:'var(--text-tertiary)'}}/>
            <div style={{fontSize:'1.1rem',fontWeight:600,color:'var(--text-secondary)'}}>Admin Access Only</div>
            <p style={{fontSize:'0.875rem',color:'var(--text-tertiary)',textAlign:'center',maxWidth:'280px'}}>You don't have permission to access this section.</p>
            <button className="btn-primary" onClick={()=>setActiveView('chat')} style={{width:'auto',padding:'10px 22px'}}><Home size={15}/> Go to Chat</button>
          </div>
        )}
      </main>
    </div>
  );
}