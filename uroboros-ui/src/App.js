import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';
import Header from './Header-Component/Header';

function App() {
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileMeta({
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      lastModified: new Date(file.lastModified).toLocaleDateString(),
    });

    const formData = new FormData();
    formData.append('binary', file);

    setStatus('processing');
    addLog(`Uploading "${file.name}" to Uroboros backend...`);
    addLog('Executing disassembly pipeline...');

    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    try {
      const response = await fetch(`${API_BASE_URL}/api/disassemble`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.code) {
        setCode(data.code);
        setStatus('success');
        addLog('Disassembly finished successfully.');
      } else {
        setStatus('error');
        const err = data.error || 'Unknown disassembly failure.';
        setCode(`// Error: ${err}`);
        addLog(`Error: ${err}`);
      }
    } catch (error) {
      setStatus('error');
      setCode('// Server error: Unable to reach disassembly service.');
      addLog(`Network Error: ${error.message}`);
    }
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

  // --- NEW: Reassembly Logic ---
  const handleReassemble = async () => {
    setStatus('processing');
    addLog('Sending modified assembly to Uroboros reassembly pipeline...');
    
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    try {
      const response = await fetch(`${API_BASE_URL}/api/reassemble`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assembly: code,
          originalName: fileMeta?.name || 'binary'
        }),
      });

      if (response.ok) {
        addLog('Reassembly successful. Downloading new ELF binary...');
        
        // Convert the response to a Blob for downloading the executable
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
        const errMsg = errorData.error || 'Compilation failed';
        setStatus('error');
        addLog(`Reassembly Error: ${errMsg}`);
      }
    } catch (error) {
      setStatus('error');
      addLog(`Network Error during reassembly: ${error.message}`);
    }
  };

  return (
    <div className="main-layout">
      <Header />

      <div className="toolbar">
        <div className="toolbar-left">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={status === 'processing'}
          >
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

          <button
            className="btn btn-secondary"
            onClick={handleDownloadAssembly}
            disabled={status !== 'success'}
          >
            Download .s
          </button>

          <button
            className="btn btn-accent"
            onClick={handleReassemble}
            disabled={status !== 'success'}
          >
            Reassemble Binary
          </button>
        </div>
      </div>

      <div className="app-container">
        <div className="left-pane">
          <div className="pane-header">
            <span className="pane-title">Disassembly View (.s)</span>
            <span className="pane-subtitle">Syntax: GNU Assembler</span>
          </div>

          <div className="editor-container">
            <Editor
              height="100%"
              defaultLanguage="assembly"
              theme="light"
              value={code}
              onChange={(newValue) => setCode(newValue || '')}
              options={{
                minimap: { enabled: true },
                fontSize: 13,
                fontFamily: 'Consolas, "Fira Code", monospace',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        <div className="right-pane">
          <div className="tab-headers">
            <button
              className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              Output Logs
            </button>
            <button
              className={`tab-btn ${activeTab === 'meta' ? 'active' : ''}`}
              onClick={() => setActiveTab('meta')}
            >
              ELF Info & Options
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'logs' ? (
              <div className="console-view">
                <div className="console-output">
                  {logs.map((log, i) => (
                    <div key={i} className="console-line">{log}</div>
                  ))}
                </div>
                <button className="clear-logs-btn" onClick={() => setLogs([])}>
                  Clear Console
                </button>
              </div>
            ) : (
              <div className="meta-view">
                <div className="card">
                  <h4>Binary Metadata</h4>
                  <div className="card-item">
                    <span>File Name:</span>
                    <strong>{fileMeta?.name || 'None'}</strong>
                  </div>
                  <div className="card-item">
                    <span>Size:</span>
                    <strong>{fileMeta?.size || 'N/A'}</strong>
                  </div>
                  <div className="card-item">
                    <span>Target Format:</span>
                    <strong>ELF (x86/x86_64)</strong>
                  </div>
                </div>

                <div className="card">
                  <h4>Uroboros Pipeline Flags</h4>
                  <label className="checkbox-item">
                    <input type="checkbox" defaultChecked /> Reconstruct Symbol Table
                  </label>
                  <label className="checkbox-item">
                    <input type="checkbox" defaultChecked /> Instrument Addresses
                  </label>
                  <label className="checkbox-item">
                    <input type="checkbox" /> Strip Non-Recoverable Sections
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;