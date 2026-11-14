import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { ShoppingCart, LogIn, User, Package, LogOut, ChevronDown, KeyRound, Store, Star, HelpCircle, Workflow, Menu, X, LayoutDashboard } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useT } from '../../i18n';
import { useShopStore, useDiscordUrl } from '../../store/useShopStore';
import { useCartStore } from '../../store/useCartStore';
import './Navbar.css';

const DiscordIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path fill="currentColor" d="M20.32 4.37A19.8 19.8 0 0 0 15.4 2.8a13.8 13.8 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.5 0 12.6 12.6 0 0 0-.64-1.29 19.7 19.7 0 0 0-4.92 1.53C.6 9.05-.24 13.6.18 18.1a19.9 19.9 0 0 0 6.04 3.05c.49-.66.92-1.36 1.29-2.1a12.9 12.9 0 0 1-2.03-.97l.5-.39a14.2 14.2 0 0 0 12.06 0l.5.39c-.65.38-1.33.71-2.04.97.37.74.8 1.44 1.29 2.1a19.8 19.8 0 0 0 6.04-3.05c.5-5.2-.84-9.72-3.57-13.73ZM8.02 15.33c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.1 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.1 2.15 2.42 0 1.34-.94 2.42-2.15 2.42Z" />
  </svg>
);

const useOutside = (open, setOpen) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open, setOpen]);
  return ref;
};

const UserMenu = ({ user }) => {
  const { t } = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, setOpen);
  const label = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || t('nav.account');
  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {user.photoURL ? <img src={user.photoURL} alt="" className="user-avatar" referrerPolicy="no-referrer" /> : <span className="user-letter">{label[0].toUpperCase()}</span>}
        <span className="user-email-text">{label}</span>
        <ChevronDown size={14} className={`user-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <strong>{user.displayName || label}</strong>
          </div>
          <button role="menuitem" onClick={() => go('/account')}><LayoutDashboard size={15} /> {t('nav.panel')}</button>
          <button role="menuitem" onClick={() => go('/account/orders')}><Package size={15} /> {t('nav.orders')}</button>
          <button role="menuitem" onClick={() => go('/account/keys')}><KeyRound size={15} /> {t('nav.keys')}</button>
          <button role="menuitem" onClick={() => go('/account/settings')}><User size={15} /> {t('nav.account')}</button>
          <button
            role="menuitem"
            className="danger"
            onClick={async () => {
              setOpen(false);
              await signOut(auth);
              toast.success(t('nav.loggedOut'));
            }}
          >
            <LogOut size={15} /> {t('nav.logout')}
          </button>
        </div>
      )}
    </div>
  );
};

const LangSwitch = () => {
  const { lang, setLang, t } = useT();
  return (
    <div className="lang-switch" role="group" aria-label={t('nav.langLabel')}>
      {['tr', 'en'].map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)} aria-pressed={lang === l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

const fmtCount = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '')}k+` : String(n));

const Navbar = () => {
  const { t } = useT();
  const { pathname } = useLocation();
  const user = useShopStore((s) => s.user);
  const members = useShopStore((s) => s.discord?.member_count);
  const discordUrl = useDiscordUrl();
  const cartCount = useCartStore((s) => s.cart.reduce((n, i) => n + i.quantity, 0));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { to: '/products', label: t('nav.products'), icon: Store, match: (p) => p.startsWith('/products') },
    { to: '/reviews', label: t('nav.reviews'), icon: Star, match: (p) => p.startsWith('/reviews') },
    { to: '/#how-it-works', label: t('nav.how'), icon: Workflow },
    { to: '/#faq', label: t('nav.faq'), icon: HelpCircle },
  ];

  return (
    <header className={`navbar-fixed-container ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="glass-bar nav-inner">
        <Link to="/" className="nav-brand" aria-label="RGX Software">
          <img src="/logo.webp" alt="" className="brand-logo-img" width="40" height="40" />
          <div className="brand-text">
            <span className="brand-title">RGX</span>
            <span className="brand-tag">SOFTWARE</span>
          </div>
        </Link>

        <nav className="nav-menu">
          {links.map(({ to, label, icon: Icon, match }) => (
            <NavLink key={to} to={to} className={() => `nav-link ${match?.(pathname) ? 'active' : ''}`}>
              <Icon size={15} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="nav-discord-pill" aria-label="Discord">
            <DiscordIcon size={17} />
            {members ? <span>{fmtCount(members)}</span> : <span className="hidden-xs">Discord</span>}
          </a>

          <LangSwitch />

          {user ? (
            <UserMenu user={user} />
          ) : (
            <button className="auth-btn" onClick={() => useShopStore.getState().openAuth()}>
              <LogIn size={15} /> <span>{t('nav.login')}</span>
            </button>
          )}

          <button className="cart-btn" onClick={() => useShopStore.getState().openCart()} aria-label={t('nav.cart')}>
            <ShoppingCart size={17} />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>

          <button className="nav-burger" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="nav-mobile glass-bar">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setMobileOpen(false)}><Icon size={17} /> {label}</Link>
          ))}
          <a href={discordUrl} target="_blank" rel="noopener noreferrer"><DiscordIcon size={17} /> Discord</a>
          {user && <Link to="/account" onClick={() => setMobileOpen(false)}><LayoutDashboard size={17} /> {t('nav.panel')}</Link>}
        </nav>
      )}
    </header>
  );
};

export default Navbar;
