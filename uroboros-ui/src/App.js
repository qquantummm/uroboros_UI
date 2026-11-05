import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';
import Header from './Header-Component/Header';

function App() {
  // --- State for Modal Flow ---
  const [showModal, setShowModal] = useState(true);
  const [modalFile, setModalFile] = useState(null);
  const [errorLog, setErrorLog] = useState('');

  // --- State for Main Application Dashboard ---
  const [code, setCode] = useState('// Upload an ELF binary to view reassembleable assembly...\n');
  const [status, setStatus] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [activeTab, setActiveTab] = useState('logs');
  const [fileMeta, setFileMeta] = useState(null);
  const [logs, setLogs] = useState(['[system] Ready. Awaiting ELF executable upload.']);
  const fileInputRef = useRef(null);

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  };

  // --- 1. Core Uroboros Processing Function ---
  const runUroboros = async (fileToProcess, isFromModal = false) => {
    if (!fileToProcess) return;

    // Update metadata for the right pane
    setFileMeta({
      name: fileToProcess.name,
      size: `${(fileToProcess.size / 1024).toFixed(2)} KB`,
      lastModified: new Date(fileToProcess.lastModified).toLocaleDateString(),
    });

    setStatus('processing');
    if (isFromModal) setErrorLog('');
    
    addLog(`Uploading "${fileToProcess.name}" to Uroboros backend...`);
    addLog('Executing python3 uroboros.py pipeline...');

    const formData = new FormData();
    formData.append('binary', fileToProcess);
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    try {
      const response = await fetch(`${API_BASE_URL}/api/disassemble`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok && data.code) {
        // Success: set code and hide modal
        setCode(data.code);
        setStatus('success');
        addLog('Disassembly finished successfully.');
        if (isFromModal) setShowModal(false);
      } else {
        // Error: Show error in popup if modal is open, or in logs if using top toolbar
        setStatus('error');
        const err = data.error || 'Uroboros pipeline failed to process binary.';
        if (isFromModal) setErrorLog(err);
        addLog(`Error: ${err}`);
      }
    } catch (error) {
      setStatus('error');
      const networkErr = 'Server error: Could not connect to backend.';
      if (isFromModal) setErrorLog(networkErr);
      addLog(`Network Error: ${error.message}`);
    }
  };

  // --- Modal Button Handlers ---
  const handleModalOk = () => {
    if (!modalFile) {
      setErrorLog('Please select a binary file first.');
      return;
    }
    runUroboros(modalFile, true);
  };

  const handleModalCancel = () => {
    setModalFile(null);
    setErrorLog('');
    setStatus('idle');
  };

  // --- Toolbar Button Handlers (for uploading a 2nd file later) ---
  const handleToolbarUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) runUroboros(file, false);
  };

  const handleDownloadAssembly = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileMeta?.name || 'disassembled'}.s`;
    link.click();
    URL.revokeObjectURL(url);
    addLog('Assembly code exported as file.');
  };

  const handleReassemble = async () => {
    setStatus('processing');
    addLog('Sending modified assembly to Uroboros reassembly pipeline...');
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/reassemble`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assembly: code, originalName: fileMeta?.name || 'binary' }),
      });

      if (response.ok) {
        addLog('Reassembly successful. Downloading new ELF binary...');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reassembled_${fileMeta?.name || 'out.elf'}`;
        link.click();
        URL.revokeObjectURL(url);
        setStatus('success');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setStatus('error');
        addLog(`Reassembly Error: ${errorData.error || 'Compilation failed'}`);
      }
    } catch (error) {
      setStatus('error');
      addLog(`Network Error during reassembly: ${error.message}`);
    }
  };

  return (
    <div className="main-layout">
      <Header />

      {/* 1. Start-up Popup Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Select Binary for Uroboros</h2>
            
            <div className="modal-body">
              <input 
                type="file" 
                onChange={(e) => setModalFile(e.target.files?.[0])} 
                className="file-input" 
              />
              
              {status === 'processing' && (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p>Running python3 uroboros.py...</p>
                </div>
              )}

              {errorLog && (
                <div className="error-log">
                  <strong>final.error:</strong>
                  <pre>{errorLog}</pre>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={handleModalCancel} disabled={status === 'processing'}>Cancel</button>
              <button className="btn btn-primary" onClick={handleModalOk} disabled={status === 'processing'}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Dashboard (Blurs when modal is open) */}
      <div className={`dashboard-wrapper ${showModal ? 'blurred' : ''}`}>
        
        {/* Top Action Bar */}
        <div className="toolbar">
          <div className="toolbar-left">
            <input type="file" ref={fileInputRef} onChange={handleToolbarUpload} style={{ display: 'none' }} />
            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={status === 'processing'}>
              {status === 'processing' ? 'Processing...' : 'Upload ELF Binary'}
            </button>
            {fileMeta && (
              <span className="file-chip">
                <span className="file-chip-name">{fileMeta.name}</span>
                <span className="file-chip-size">({fileMeta.size})</span>
              </span>
            )}
          </div>

          <div className="toolbar-right">
            <span className={`status-indicator status-${status}`}>
              <span className="dot"></span>
              {status.toUpperCase()}
            </span>
            <button className="btn btn-secondary" onClick={handleDownloadAssembly} disabled={status !== 'success'}>
              Download .s
            </button>
            <button className="btn btn-accent" onClick={handleReassemble} disabled={status !== 'success'}>
              Reassemble Binary
            </button>
          </div>
        </div>

        {/* Split Workbench Panes */}
        <div className="app-container">
          {/* Left Pane: Monaco Editor */}
          <div className="left-pane">
            <div className="pane-header">
              <span className="pane-title">final.s</span>
              <span className="pane-subtitle">Syntax: GNU Assembler</span>
            </div>
            <div className="editor-container">
              <Editor
                height="100%"
                defaultLanguage="assembly"
                theme="light"
                value={code}
                onChange={(newValue) => setCode(newValue || '')}
                options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
              />
            </div>
          </div>

          {/* Right Pane: Logs & Tooling Panel */}
          <div className="right-pane">
            <div className="tab-headers">
              <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>Output Logs</button>
              <button className={`tab-btn ${activeTab === 'meta' ? 'active' : ''}`} onClick={() => setActiveTab('meta')}>ELF Info & Options</button>
            </div>
            <div className="tab-content">
              {activeTab === 'logs' ? (
                <div className="console-view">
                  <div className="console-output">
                    {logs.map((log, i) => <div key={i} className="console-line">{log}</div>)}
                  </div>
                  <button className="clear-logs-btn" onClick={() => setLogs([])}>Clear Console</button>
                </div>
              ) : (
                <div className="meta-view">
                  <div className="card">
                    <h4>Binary Metadata</h4>
                    <div className="card-item"><span>File Name:</span><strong>{fileMeta?.name || 'None'}</strong></div>
                    <div className="card-item"><span>Size:</span><strong>{fileMeta?.size || 'N/A'}</strong></div>
                    <div className="card-item"><span>Target Format:</span><strong>ELF (x86/x86_64)</strong></div>
                  </div>
                  <div className="card">
                    <h4>Uroboros Pipeline Flags</h4>
                    <label className="checkbox-item"><input type="checkbox" defaultChecked /> Reconstruct Symbol Table</label>
                    <label className="checkbox-item"><input type="checkbox" defaultChecked /> Instrument Addresses</label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;