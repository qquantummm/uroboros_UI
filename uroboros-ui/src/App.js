import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';
import Header from './Header-Component/Header';

function App() {
  const [code, setCode] = useState('// Upload an ELF executable to see Uroboros output here...');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('binary', file);

    setIsUploading(true);
    setCode('// Processing file with Uroboros... Please wait.');

    try {
      const response = await fetch('http://localhost:3001/api/disassemble', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (data.code) {
        setCode(data.code);
      } else {
        setCode('// Error: ' + data.error);
      }
    } catch (error) {
      setCode('// Server error occurred.');
    }
    setIsUploading(false);
  };

  return (
    <div className="main-layout">
      {/* 1. The Full-Width Header goes at the top */}
      <Header />

      {/* 2. The Split-Screen layout goes underneath */}
      <div className="app-container">
        
        {/* Left Pane: Controls & Terminal Editor */}
        <div className="left-pane">
          <div className="controls">
            <input type="file" onChange={handleFileUpload} disabled={isUploading} />
          </div>
          
          <div className="editor-container">
            <Editor 
              height="100%" 
              defaultLanguage="assembly" 
              theme="vs-dark" 
              value={code} 
              onChange={(newValue) => setCode(newValue)}
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </div>
        </div>

        {/* Right Pane: Blank for future development */}
        <div className="right-pane">
          <h2 style={{ padding: '20px', color: '#888' }}>Future Development Area</h2>
        </div>

      </div>
    </div>
  );
}

export default App;