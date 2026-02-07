import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, Heart, Sparkles, Menu, X, BookOpen, User, ClipboardList, Loader2, CheckCircle, Circle, Archive, Play, Wrench } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

const MentalHealthAgent = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [profile, setProfile] = useState(null);
  const [todos, setTodos] = useState([]);
  const [userId] = useState('user_' + Math.random().toString(36).substr(2, 9));
  const [conversationId, setConversationId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    checkAPIHealth();
    loadProfile();
    loadTodos();
    
    setMessages([{
      role: 'assistant',
      content: "Hello! I'm your mental health companion powered by evidence-based research and RAG technology. I have access to a comprehensive knowledge base that I can search to provide accurate information. How are you feeling today?",
      timestamp: new Date(),
      used_rag: false,
      tool_calls: []
    }]);
  }, []);

  const checkAPIHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      if (response.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('API health check failed:', error);
      setConnectionStatus('error');
    }
  };

  const loadProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // FIXED: Changed from /api/todos to /api/tasks
  const loadTodos = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${userId}`);
      if (response.ok) {
        const data = await response.json();
        // Use data.tasks instead of data.todos
        setTodos(data.tasks || []);
      }
    } catch (error) {
      console.error('Error loading todos:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          user_id: userId,
          conversation_id: conversationId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      if (!conversationId) {
        setConversationId(data.conversation_id);
      }

      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        used_rag: data.used_rag,
        rag_sources: data.rag_sources,
        tool_calls: data.agent_actions?.map(action => action.action) || [], // Updated to use agent_actions
        agent_actions: data.agent_actions || [] // Store full agent actions
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Refresh data
      await loadProfile();
      await loadTodos();

    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please make sure the FastAPI server is running on http://localhost:8000",
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'error': return 'Disconnected';
      default: return 'Connecting...';
    }
  };

  // UPDATED: Added enum values from backend
  const getStatusIcon = (status) => {
    const icons = {
      'not_started': <Circle className="w-4 h-4 text-gray-400" />,
      'not started': <Circle className="w-4 h-4 text-gray-400" />, // Added alias
      'in_progress': <Play className="w-4 h-4 text-blue-500" />,
      'in progress': <Play className="w-4 h-4 text-blue-500" />, // Added alias
      'completed': <CheckCircle className="w-4 h-5 text-green-500" />,
      'skipped': <Archive className="w-4 h-4 text-gray-400" />,
      'done': <CheckCircle className="w-4 h-4 text-green-500" />,
      'archived': <Archive className="w-4 h-4 text-gray-400" />
    };
    return icons[status] || icons['not_started'];
  };

  // UPDATED: Added all category values from backend
  const getCategoryColor = (category) => {
    const colors = {
      'self-care': 'bg-purple-100 text-purple-700',
      'self_care': 'bg-purple-100 text-purple-700',
      'exercise': 'bg-green-100 text-green-700',
      'mindfulness': 'bg-blue-100 text-blue-700',
      'social': 'bg-yellow-100 text-yellow-700',
      'professional': 'bg-indigo-100 text-indigo-700',
      'sleep': 'bg-teal-100 text-teal-700',
      'nutrition': 'bg-orange-100 text-orange-700',
      'therapeutic': 'bg-pink-100 text-pink-700',
      'therapy': 'bg-blue-100 text-blue-700',
      'medication': 'bg-red-100 text-red-700',
      'other': 'bg-gray-100 text-gray-700'
    };
    return colors[category] || colors['other'];
  };

  // Format category for display
  const formatCategory = (category) => {
    return category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Format status for display
  const formatStatus = (status) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed lg:relative lg:translate-x-0 w-64 bg-white shadow-xl h-full transition-transform duration-300 ease-in-out z-30`}>
        <div className="p-6 border-b border-purple-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">MindfulAI</h1>
              <p className="text-xs text-gray-500">RAG-Powered Support</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'chat' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Heart className="w-5 h-5" />
            <span className="font-medium">Chat</span>
          </button>
          
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'knowledge' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="font-medium">How It Works</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab('profile');
              loadProfile();
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'profile' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="font-medium">Profile</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab('todos');
              loadTodos();
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'todos' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span className="font-medium">Wellness Tasks</span>
            {todos.length > 0 && (
              <span className="ml-auto px-2 py-1 bg-purple-500 text-white text-xs rounded-full">
                {todos.length}
              </span>
            )}
          </button>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-purple-100">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white text-sm">
            <p className="font-semibold mb-1">🤖 RAG Enabled</p>
            <p className="text-xs opacity-90">AI searches knowledge base for accurate answers</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-purple-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {activeTab === 'chat' ? 'Conversation' : 
                   activeTab === 'knowledge' ? 'RAG System Overview' :
                   activeTab === 'profile' ? 'Your Profile' : 'Wellness Tasks'}
                </h2>
                <p className="text-sm text-gray-500">
                  {activeTab === 'chat' ? 'Your safe space powered by RAG' : 
                   activeTab === 'knowledge' ? 'Understanding the technology' :
                   activeTab === 'profile' ? 'Personalized insights' : 'Track your progress'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 ${connectionStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded-full text-sm font-medium flex items-center space-x-1`}>
                <div className={`w-2 h-2 ${getStatusColor()} rounded-full ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`}></div>
                <span>{getStatusText()}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        {activeTab === 'chat' && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-3 max-w-2xl ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      message.role === 'user' 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                        : message.isError
                        ? 'bg-red-500'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500'
                    }`}>
                      {message.role === 'user' ? (
                        <User className="w-5 h-5 text-white" />
                      ) : (
                        <Brain className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`p-4 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                          : message.isError
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-white shadow-md'
                      }`}>
                        <p className={`whitespace-pre-wrap ${message.role === 'user' ? 'text-white' : message.isError ? 'text-red-800' : 'text-gray-800'}`}>
                          {message.content}
                        </p>
                        
                        {/* RAG Indicator */}
                        {message.used_rag && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center space-x-2 text-xs text-purple-600">
                              <Sparkles className="w-3 h-3" />
                              <span className="font-medium">Using knowledge base</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Agent Actions */}
                        {message.agent_actions && message.agent_actions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex items-center space-x-2 text-xs mb-2">
                              <Wrench className="w-3 h-3 text-purple-600" />
                              <span className="font-semibold text-purple-600">Agent Actions:</span>
                            </div>
                            <div className="space-y-2">
                              {message.agent_actions.map((action, idx) => (
                                <div key={idx} className="p-2 bg-purple-50 rounded-lg">
                                  <p className="text-xs font-medium text-purple-700">{action.action}</p>
                                  <p className="text-xs text-purple-600 mt-1">{action.reasoning}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 px-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-3 max-w-2xl">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-white shadow-md p-4 rounded-2xl">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        <span className="text-gray-600">Processing your request...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-purple-100 bg-white p-6">
              <div className="max-w-4xl mx-auto">
                {connectionStatus === 'error' && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <p className="font-semibold">⚠️ Connection Error</p>
                    <p className="text-xs mt-1">Make sure FastAPI server is running: <code className="bg-red-100 px-1 rounded">uvicorn main:app --reload</code></p>
                  </div>
                )}
                <div className="flex items-end space-x-4">
                  <div className="flex-1 relative">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Tell me how you're feeling or ask a mental health question..."
                      className="w-full px-4 py-3 pr-12 border-2 border-purple-200 rounded-2xl focus:outline-none focus:border-purple-400 resize-none transition-colors"
                      rows="3"
                      disabled={isLoading || connectionStatus === 'error'}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim() || connectionStatus === 'error'}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2 shadow-lg hover:shadow-xl"
                  >
                    <Send className="w-5 h-5" />
                    <span className="font-medium">Send</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Press Enter to send • Shift + Enter for new line
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'knowledge' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">How RAG System Works</h3>
                <p className="text-gray-600 mb-6">Our AI uses Retrieval-Augmented Generation (RAG) to provide accurate, evidence-based mental health support.</p>
              </div>
              
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 font-bold text-lg">1</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 mb-2">Admin Uploads Knowledge</h4>
                      <p className="text-gray-600">Administrators upload CSV files containing mental health Q&A pairs through the Admin Portal.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-bold text-lg">2</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 mb-2">Automatic Chunking</h4>
                      <p className="text-gray-600">Documents are split into smaller chunks (500 chars) with overlap for better retrieval accuracy.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                      <span className="text-pink-600 font-bold text-lg">3</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 mb-2">Vector Embeddings</h4>
                      <p className="text-gray-600">Text chunks are converted to vector embeddings using sentence-transformers and stored in ChromaDB.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-bold text-lg">4</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 mb-2">RAG as Tool</h4>
                      <p className="text-gray-600">The AI agent has access to search_knowledge tool. When you ask questions, the agent calls this tool automatically.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span className="text-yellow-600 font-bold text-lg">5</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 mb-2">Semantic Search</h4>
                      <p className="text-gray-600">ChromaDB performs similarity search to find most relevant chunks based on your question's meaning.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-lg">6</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 mb-2">Context-Aware Response</h4>
                      <p className="text-gray-600">Agent combines retrieved information with empathetic tone to create personalized, accurate responses.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg p-6 text-white">
                <h4 className="text-xl font-bold mb-3">🎯 Why This Matters</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start space-x-2">
                    <span>✓</span>
                    <span>Evidence-based responses backed by uploaded knowledge</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span>✓</span>
                    <span>Dynamic knowledge base that grows with admin uploads</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span>✓</span>
                    <span>Semantic understanding, not just keyword matching</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span>✓</span>
                    <span>Transparent tool usage - you can see when RAG is used</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-purple-100">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">Your Profile</h3>
                
                {profile ? (
                  <div className="space-y-4">
                    {profile.name && (
                      <div className="p-4 bg-purple-50 rounded-xl">
                        <p className="text-sm text-purple-600 font-medium mb-1">Name</p>
                        <p className="text-gray-800">{profile.name}</p>
                      </div>
                    )}
                    
                    {profile.age && (
                      <div className="p-4 bg-purple-50 rounded-xl">
                        <p className="text-sm text-purple-600 font-medium mb-1">Age</p>
                        <p className="text-gray-800">{profile.age}</p>
                      </div>
                    )}
                    
                    {profile.location && (
                      <div className="p-4 bg-purple-50 rounded-xl">
                        <p className="text-sm text-purple-600 font-medium mb-1">Location</p>
                        <p className="text-gray-800">{profile.location}</p>
                      </div>
                    )}
                    
                    {profile.mental_health_goals && profile.mental_health_goals.length > 0 && (
                      <div className="p-4 bg-purple-50 rounded-xl">
                        <p className="text-sm text-purple-600 font-medium mb-2">Mental Health Goals</p>
                        <ul className="space-y-1">
                          {profile.mental_health_goals.map((goal, idx) => (
                            <li key={idx} className="text-gray-800 flex items-start space-x-2">
                              <span className="text-purple-500">•</span>
                              <span>{goal}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {profile.coping_strategies && profile.coping_strategies.length > 0 && (
                      <div className="p-4 bg-purple-50 rounded-xl">
                        <p className="text-sm text-purple-600 font-medium mb-2">Effective Coping Strategies</p>
                        <ul className="space-y-1">
                          {profile.coping_strategies.map((strategy, idx) => (
                            <li key={idx} className="text-gray-800 flex items-start space-x-2">
                              <span className="text-purple-500">•</span>
                              <span>{strategy}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {profile.triggers && profile.triggers.length > 0 && (
                      <div className="p-4 bg-purple-50 rounded-xl">
                        <p className="text-sm text-purple-600 font-medium mb-2">Known Triggers</p>
                        <ul className="space-y-1">
                          {profile.triggers.map((trigger, idx) => (
                            <li key={idx} className="text-gray-800 flex items-start space-x-2">
                              <span className="text-purple-500">•</span>
                              <span>{trigger}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {profile.emotional_state && (
                      <div className="p-4 bg-purple-50 rounded-xl">
                        <p className="text-sm text-purple-600 font-medium mb-1">Current Emotional State</p>
                        <p className="text-gray-800 capitalize">{profile.emotional_state.replace('_', ' ')}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">No profile information yet</p>
                    <p className="text-sm">Share information about yourself in our chat!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'todos' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-purple-100">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">Wellness Tasks</h3>
                
                {todos.length > 0 ? (
                  <div className="space-y-4">
                    {todos.map((todo, idx) => (
                      <div key={idx} className="p-4 border-2 border-purple-100 rounded-xl hover:border-purple-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start space-x-3 flex-1">
                            {getStatusIcon(todo.status)}
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800">{todo.task}</h4>
                              <p className="text-xs text-gray-500 mt-1">Status: {formatStatus(todo.status)}</p>
                              {todo.solutions && todo.solutions.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs font-medium text-gray-700">Suggested solutions:</p>
                                  {todo.solutions.map((solution, sidx) => (
                                    <p key={sidx} className="text-sm text-gray-600 flex items-start space-x-2">
                                      <span className="text-purple-500">→</span>
                                      <span>{solution}</span>
                                    </p>
                                  ))}
                                </div>
                              )}
                              {todo.notes && (
                                <div className="mt-2 p-2 bg-blue-50 rounded">
                                  <p className="text-xs font-medium text-blue-700">Notes:</p>
                                  <p className="text-xs text-blue-600">{todo.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(todo.category)}`}>
                            {formatCategory(todo.category)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-2">
                          {todo.time_to_complete && (
                            <span className="flex items-center space-x-1">
                              <span>⏱️ {todo.time_to_complete} min</span>
                            </span>
                          )}
                          {todo.priority && (
                            <span className="flex items-center space-x-1">
                              <span>⚡ Priority: {todo.priority}/5</span>
                            </span>
                          )}
                          {todo.due_date && (
                            <span className="flex items-center space-x-1">
                              <span>📅 Due: {new Date(todo.due_date).toLocaleDateString()}</span>
                            </span>
                          )}
                          {todo.completed_at && (
                            <span className="flex items-center space-x-1 text-green-600">
                              <CheckCircle className="w-3 h-3" />
                              <span>Completed: {new Date(todo.completed_at).toLocaleDateString()}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">No wellness tasks yet</p>
                    <p className="text-sm">Share your goals in our chat to get started!</p>
                    <button
                      onClick={() => setActiveTab('chat')}
                      className="mt-4 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
                    >
                      Go to Chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MentalHealthAgent;