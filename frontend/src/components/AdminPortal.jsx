import React, { useState, useEffect } from 'react';
import { Upload, Database, FileText, Trash2, CheckCircle, AlertCircle, BarChart3, Download, RefreshCw } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

const AdminPortal = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/rag-stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setUploadResult(null);
      } else {
        setUploadResult({
          success: false,
          message: 'Please upload a CSV file'
        });
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setUploadResult(null);
      } else {
        setUploadResult({
          success: false,
          message: 'Please upload a CSV file'
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/admin/upload-csv`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          message: data.message,
          documents_added: data.documents_added,
          chunks_created: data.chunks_created
        });
        setFile(null);
        await loadStats();
      } else {
        setUploadResult({
          success: false,
          message: data.detail || 'Upload failed'
        });
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClearKnowledge = async () => {
    if (!window.confirm('Are you sure you want to clear all knowledge base? This will reset to default knowledge.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/clear-knowledge`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setUploadResult({
          success: true,
          message: 'Knowledge base cleared and reinitialized with defaults'
        });
        await loadStats();
      } else {
        const data = await response.json();
        setUploadResult({
          success: false,
          message: data.detail || 'Failed to clear knowledge base'
        });
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleCSV = `question,answer
"What is anxiety?","Anxiety is a natural stress response characterized by feelings of worry, nervousness, or unease. Common symptoms include rapid heartbeat, sweating, and difficulty concentrating."
"How can I practice mindfulness?","Mindfulness involves being present in the moment without judgment. Start with 5-10 minutes of focused breathing daily, gradually increasing duration as you become comfortable."
"What are coping strategies for stress?","Effective coping strategies include regular exercise, deep breathing techniques, maintaining a healthy sleep schedule, talking to supportive friends or family, and practicing relaxation techniques."`;

    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_mental_health_qa.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-indigo-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Admin Portal</h1>
                <p className="text-sm text-gray-500">Mental Health Knowledge Base Management</p>
              </div>
            </div>
            <button
              onClick={loadStats}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-8 h-8 text-indigo-500" />
              <span className="text-sm text-gray-500">Documents</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">
              {stats?.total_documents || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Total Q&A pairs</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="w-8 h-8 text-purple-500" />
              <span className="text-sm text-gray-500">Chunks</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">
              {stats?.total_chunks || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Vector embeddings</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-pink-100">
            <div className="flex items-center justify-between mb-2">
              <Upload className="w-8 h-8 text-pink-500" />
              <span className="text-sm text-gray-500">Uploads</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">
              {stats?.csv_uploads || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">CSV files uploaded</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <span className="text-sm text-gray-500">Status</span>
            </div>
            <p className="text-xl font-bold text-gray-800">
              {stats?.vectorstore_initialized ? 'Active' : 'Inactive'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.last_upload ? new Date(stats.last_upload).toLocaleDateString() : 'No uploads yet'}
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-indigo-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Upload Knowledge Base</h2>
            <button
              onClick={downloadSampleCSV}
              className="flex items-center space-x-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Download Sample CSV</span>
            </button>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">📋 CSV Format Requirements:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Must contain columns: <code className="bg-blue-100 px-1 rounded">question</code> and <code className="bg-blue-100 px-1 rounded">answer</code></li>
              <li>• Each row represents one Q&A pair</li>
              <li>• File will be automatically chunked for optimal retrieval</li>
              <li>• Supports any mental health related content</li>
            </ul>
          </div>

          {/* Drag and Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-3 border-dashed rounded-2xl p-12 transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 bg-gray-50'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className={`p-4 rounded-full ${dragActive ? 'bg-indigo-100' : 'bg-gray-200'}`}>
                <Upload className={`w-12 h-12 ${dragActive ? 'text-indigo-600' : 'text-gray-400'}`} />
              </div>
              
              {file ? (
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-800">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-700">
                    Drag and drop your CSV file here
                  </p>
                  <p className="text-sm text-gray-500">or click to browse</p>
                </div>
              )}

              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              
              <label
                htmlFor="file-upload"
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 cursor-pointer transition-all shadow-lg hover:shadow-xl"
              >
                Browse Files
              </label>
            </div>
          </div>

          {/* Upload Button */}
          {file && (
            <div className="mt-6 flex items-center space-x-4">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>Upload to Knowledge Base</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => {
                  setFile(null);
                  setUploadResult(null);
                }}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className={`mt-6 p-4 rounded-lg border-2 ${
              uploadResult.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start space-x-3">
                {uploadResult.success ? (
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                )}
                <div className="flex-1">
                  <p className={`font-semibold ${
                    uploadResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {uploadResult.success ? 'Success!' : 'Error'}
                  </p>
                  <p className={`text-sm mt-1 ${
                    uploadResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {uploadResult.message}
                  </p>
                  {uploadResult.success && uploadResult.documents_added && (
                    <div className="mt-2 text-sm text-green-700">
                      <p>📄 Documents added: {uploadResult.documents_added}</p>
                      <p>🔗 Chunks created: {uploadResult.chunks_created}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Knowledge Base Management */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-red-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Danger Zone</h2>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Clear Knowledge Base</h3>
                <p className="text-sm text-red-700">
                  This will delete all uploaded knowledge and reset to default mental health information.
                  This action cannot be undone.
                </p>
              </div>
              <button
                onClick={handleClearKnowledge}
                disabled={loading}
                className="ml-4 flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All</span>
              </button>
            </div>
          </div>
        </div>

        {/* How RAG Works */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-purple-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">How RAG System Works</h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">CSV Upload & Chunking</h3>
                <p className="text-sm text-gray-600">
                  Admin uploads CSV with Q&A pairs. Each document is automatically chunked into smaller pieces for optimal retrieval.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold">2</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Vector Embeddings</h3>
                <p className="text-sm text-gray-600">
                  Text is converted to vector embeddings using sentence-transformers and stored in ChromaDB.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">RAG as Tool</h3>
                <p className="text-sm text-gray-600">
                  The agent has access to search_knowledge tool. When users ask mental health questions, agent calls this tool.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold">4</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Similarity Search & Response</h3>
                <p className="text-sm text-gray-600">
                  ChromaDB retrieves most relevant chunks based on semantic similarity, agent incorporates them into response.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-4">
          <p>Mental Health AI Agent Admin Portal v1.0</p>
          <p className="mt-1">Powered by LangGraph + ChromaDB + RAG</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;