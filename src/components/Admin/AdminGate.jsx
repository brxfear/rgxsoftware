import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { Lock, Mail, LogOut, ShieldAlert, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth, GOOGLE_LOGIN_ENABLED } from '../../lib/firebase';
import { isAdminUser } from '../../lib/db';
import { authErrorMessage } from '../../lib/authErrors';
import AdminDashboard from './AdminDashboard';
import GoogleIcon from '../GoogleIcon';
import './AdminDashboard.css';

const AdminGate = () => {
  const [state, setState] = useState({ status: 'loading', user: null });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return setState({ status: 'signedOut', user: null });
      setState({ status: 'loading', user });
      const admin = await isAdminUser(user);
      setState({ status: admin ? 'admin' : 'notAdmin', user });
    });
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (state.status === 'admin') return <AdminDashboard user={state.user} />;

  return (
    <div className="adm-gate">
      <div className="adm-gate-card">
        <img src="/logo.webp" alt="RGX Software" className="adm-gate-logo" />
        <h1>Yönetim Paneli</h1>

        {state.status === 'loading' && <p className="adm-muted">Yetki kontrol ediliyor…</p>}

        {state.status === 'signedOut' && (
          <form onSubmit={login} className="adm-gate-form">
            <p className="adm-muted">Admin hesabınla giriş yap.</p>
            {GOOGLE_LOGIN_ENABLED && (
              <>
                <button type="button" className="adm-btn adm-btn-ghost adm-btn-block adm-google" onClick={googleLogin} disabled={busy}>
                  <GoogleIcon /> Google ile giriş yap
                </button>
                <div className="adm-or"><span>veya</span></div>
              </>
            )}
            <label className="adm-input-icon">
              <Mail size={16} />
              <input type="email" placeholder="E-posta" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="adm-input-icon">
              <Lock size={16} />
              <input type="password" placeholder="Şifre" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button className="adm-btn adm-btn-primary adm-btn-block" disabled={busy}>
              {busy ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>
        )}

        {state.status === 'notAdmin' && (
          <div className="adm-gate-denied">
            <ShieldAlert size={28} />
            <p>
              <strong>{state.user.email}</strong> hesabının admin yetkisi yok.
            </p>
            <p className="adm-muted">
              Yetki vermek için Firestore'da <code>admins</code> koleksiyonuna bu UID ile bir belge ekle:
            </p>
            <button
              className="adm-uid"
              onClick={() => {
                navigator.clipboard?.writeText(state.user.uid);
                toast.success('UID kopyalandı');
              }}
            >
              <code>{state.user.uid}</code> <Copy size={14} />
            </button>
            <button className="adm-btn adm-btn-ghost adm-btn-block" onClick={() => signOut(auth)}>
              <LogOut size={15} /> Çıkış yap
            </button>
          </div>
        )}

        <Link to="/" className="adm-back-link">← Siteye dön</Link>
      </div>
    </div>
  );
};

export default AdminGate;
