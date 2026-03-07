import React from 'react';
import { ShoppingCart, LogIn, User, Globe, Shield, Terminal } from 'lucide-react';
import './Navbar.css';

const Navbar = ({ activeSection, onSectionChange, user, onAuthClick, cartCount, onCartClick, language, onLanguageToggle, t }) => {
  return (
    <nav className="navbar-container">
      <div className="container nav-content">
        <div className="nav-logo cyber-font neon-text">
          BRX.STORE
        </div>

        <div className="capsule-nav">
          <button
            className={`nav-capsule ${activeSection === 'home' ? 'active' : ''}`}
            onClick={() => onSectionChange('home')}
          >
            <Globe size={16} /> <span>{t('navbar.home')}</span>
          </button>

          <button
            className={`nav-capsule ${activeSection === 'products' ? 'active' : ''}`}
            onClick={() => onSectionChange('products')}
          >
            <Terminal size={16} /> <span>{t('navbar.products')}</span>
          </button>

          <a
            href="https://discord.gg/brx"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-capsule"
          >
            <Shield size={16} /> <span>{t('navbar.support')}</span>
          </a>
        </div>

        <div className="nav-actions">
          <button className="lang-capsule" onClick={onLanguageToggle}>
            <span className={language === 'tr' ? 'active-lang' : ''}>TR</span>
            <span className="lang-divider">|</span>
            <span className={language === 'en' ? 'active-lang' : ''}>EN</span>
          </button>

          {user ? (
            <div className="user-capsule">
              <User size={16} />
              <span className="user-email">{user.email.split('@')[0]}</span>
            </div>
          ) : (
            <button className="auth-capsule" onClick={onAuthClick}>
              <LogIn size={16} /> <span>{t('navbar.auth')}</span>
            </button>
          )}

          <button className="cart-capsule" onClick={onCartClick}>
            <ShoppingCart size={18} />
            {cartCount > 0 && <span className="capsule-badge">{cartCount}</span>}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
