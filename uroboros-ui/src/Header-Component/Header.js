import React from 'react';
import './Header.css';

function Header() {
  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="header-title">Uroboros</h1>
        <span className="header-subtitle">Disassembly & Reassembly Pipeline</span>
      </div>
    </header>
  );
}

export default Header;