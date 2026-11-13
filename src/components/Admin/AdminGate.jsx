import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, signInWithCustomToken, GoogleAuthProvider, signOut } from 'firebase/auth';
import { ShieldAlert, User, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth } from '../../lib/firebase';
import { isGoogleUser } from '../../lib/db';
import { getMyAdminRecord } from '../../lib/adminLog';
import { authErrorMessage } from '../../lib/authErrors';
import AdminDashboard from './AdminDashboard';
import GoogleIcon from '../GoogleIcon';
import './AdminDashboard.css';

// Yönetim paneline Google ile ya da kullanıcı adı/e-posta + şifre ile, sadece yönetici listesindeki hesaplar girebilir.
const AdminGate = () => {
  const [state, setState] = useState({ status: 'loading', user: null });
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const passwordLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.token) throw new Error(d?.error || 'Giriş yapılamadı.');
      if (auth.currentUser) await signOut(auth);
      await signInWithCustomToken(auth, d.token);
      setPassword('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return setState({ status: 'signedOut', user: null });
      setState({ status: 'loading', user });
      const admin = await getMyAdminRecord(user);
      setState({ status: admin ? 'admin' : 'denied', user, admin });
    });
  }, []);

  const googleLogin = async () => {
    setBusy(true);
    try {
      if (auth.currentUser) await signOut(auth);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        toast.error(authErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  if (state.status === 'admin') return <AdminDashboard admin={state.admin} />;

  const user = state.user;

  return (
    <div className="adm-gate">
      <div className="adm-gate-card">
        <img src="/logo.webp" alt="RGX Software" className="adm-gate-logo" />
        <h1>Yönetim Paneli</h1>

        {state.status === 'loading' && <p className="adm-muted">Yetki kontrol ediliyor…</p>}

        {state.status === 'signedOut' && (
          <div className="adm-gate-form">
            <p className="adm-muted">Sadece yetkili yöneticiler giriş yapabilir.</p>
            <form className="adm-login-form" onSubmit={passwordLogin}>
              <label className="adm-input-icon">
                <User size={16} />
                <input placeholder="Kullanıcı adı veya e-posta" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
              </label>
              <label className="adm-input-icon">
                <Lock size={16} />
                <input type="password" placeholder="Şifre" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              <button className="adm-btn adm-btn-primary adm-btn-block adm-login-btn" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
            </form>
            <div className="adm-or"><span>veya</span></div>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-block adm-google" onClick={googleLogin} disabled={busy}>
              <GoogleIcon /> {busy ? 'Bekleniyor…' : 'Google ile giriş yap'}
            </button>
          </div>
        )}

        {state.status === 'denied' && (
          <div className="adm-gate-denied">
            <ShieldAlert size={28} />
            <p><strong>{user.email || 'Bu hesap'}</strong> yönetici olarak yetkilendirilmemiş.</p>
            <p className="adm-muted">
              {isGoogleUser(user)
                ? 'Yetkili bir yönetici, panelden bu e-postayı eklemeli.'
                : 'Mağaza hesabıyla değil, yönetici kullanıcı adı/şifresi ya da yetkili Google hesabıyla gir.'}
            </p>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-block" onClick={() => signOut(auth)} disabled={busy}>
              Çıkış yap ve yönetici olarak gir
            </button>
          </div>
        )}

        <Link to="/" className="adm-back-link">← Siteye dön</Link>
      </div>
    </div>
  );
};

export default AdminGate;
