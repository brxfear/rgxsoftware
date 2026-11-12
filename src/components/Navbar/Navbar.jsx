import React, { useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { auth } from '../../lib/firebase';
import { ShoppingCart, LogIn, User, MessageCircle, Package, LogOut, ChevronDown } from 'lucide-react';
import './Navbar.css';

const UserMenu = ({ user, onAccountClick }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const label = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Hesabım';
  const go = (tab) => {
    setOpen(false);
    onAccountClick(tab);
  };

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="user-avatar" referrerPolicy="no-referrer" />
        ) : (
          <User size={15} />
        )}
        <span className="user-email-text">{label}</span>
        <ChevronDown size={14} className={`user-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <strong>{user.displayName || label}</strong>
            <span>{user.email}</span>
          </div>
          <button role="menuitem" onClick={() => go('profile')}><User size={15} /> Hesabım</button>
          <button role="menuitem" onClick={() => go('orders')}><Package size={15} /> Siparişlerim</button>
          <button
            role="menuitem"
            className="danger"
            onClick={async () => {
              setOpen(false);
              await signOut(auth);
              toast.success('Çıkış yapıldı.');
            }}
          >
            <LogOut size={15} /> Çıkış yap
          </button>
        </div>
      )}
    </div>
  );
};

const Navbar = ({ activeSection, onSectionChange, user, onAuthClick, onAccountClick, cartCount, onCartClick }) => {
  return (
    <header className="navbar-fixed-container">
      <div className="glass-bar nav-inner">
        {/* Logo */}
        <div className="nav-brand" onClick={() => onSectionChange('home')}>
          <img src="/logo.webp" alt="RGX Software" className="brand-logo-img" width="40" height="40" />
          <div className="brand-text">
            <span className="brand-title">RGX</span>
            <span className="brand-tag">SOFTWARE</span>
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
            onClick={() => {
              onSectionChange('products');
              document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
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
            <UserMenu user={user} onAccountClick={onAccountClick} />
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
