import React from 'react';
import { ShoppingCart, LogIn, User, ShieldCheck, Flame, MessageCircle } from 'lucide-react';
import './Navbar.css';

const Navbar = ({ activeSection, onSectionChange, user, onAuthClick, cartCount, onCartClick, language, onLanguageToggle }) => {
  return (
    <header className="navbar-fixed-container">
      <div className="glass-bar nav-inner">
        {/* Logo */}
        <div className="nav-brand" onClick={() => onSectionChange('home')}>
          <div className="brand-logo-gem">
            <span className="gem-text">R</span>
          </div>
          <div className="brand-text">
            <span className="brand-title">RGX SOFTWARE</span>
            <span className="brand-tag">PRIVATE</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="nav-menu">
          <button
            className={`nav-link ${activeSection === 'home' ? 'active' : ''}`}
            onClick={() => {
              onSectionChange('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Ana Sayfa
          </button>

          <button
            className={`nav-link ${activeSection === 'products' ? 'active' : ''}`}
            onClick={() => onSectionChange('products')}
          >
            Ürünler
          </button>

          <a href="#how-it-works" className="nav-link" onClick={() => onSectionChange('home')}>
            Nasıl Çalışır?
          </a>

          <a href="#reviews" className="nav-link" onClick={() => onSectionChange('home')}>
            Yorumlar
          </a>

          <a href="#faq" className="nav-link" onClick={() => onSectionChange('home')}>
            SSS
          </a>

          <a
            href="https://discord.gg/dQ5u8TRAxr"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link nav-discord-link"
          >
            <MessageCircle size={15} /> Discord
          </a>
        </nav>

        {/* Right Actions */}
        <div className="nav-actions">
          {/* Status Badge */}
          <div className="nav-status-badge hidden-sm">
            <span className="status-dot-green"></span>
            <span>TÜM SİSTEMLER AKTİF</span>
          </div>

          {/* User Auth */}
          {user ? (
            <div className="user-button">
              <User size={15} />
              <span className="user-email-text">{user.email.split('@')[0]}</span>
            </div>
          ) : (
            <button className="auth-btn" onClick={onAuthClick}>
              <LogIn size={15} /> <span>Giriş Yap</span>
            </button>
          )}

          {/* Cart Capsule */}
          <button className="cart-btn" onClick={onCartClick} aria-label="Sepet">
            <ShoppingCart size={17} />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
