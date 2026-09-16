import React from 'react';
import './Header.css';

function Header() {
  return (
    <header className="site-header">
      <div className="header-logo">
        <a href="/">Uroboros</a>
      </div>
      <nav className="header-navigation">
        <ul>
          <li><a href="/">Tool</a></li>
          <li><a href="/about">About</a></li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
