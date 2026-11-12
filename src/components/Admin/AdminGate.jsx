import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth } from '../../lib/firebase';
import { isGoogleUser } from '../../lib/db';
import { getMyAdminRecord } from '../../lib/adminLog';
import { authErrorMessage } from '../../lib/authErrors';
import AdminDashboard from './AdminDashboard';
import GoogleIcon from '../GoogleIcon';
import './AdminDashboard.css';

// Yönetim paneline sadece Google ile, e-postası admins listesinde olan hesaplar girebilir.
const AdminGate = () => {
  const [state, setState] = useState({ status: 'loading', user: null });
  const [busy, setBusy] = useState(false);

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
            <p className="adm-muted">Sadece yetkili Google hesapları giriş yapabilir.</p>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-block adm-google" onClick={googleLogin} disabled={busy}>
              <GoogleIcon /> {busy ? 'Bekleniyor…' : 'Google ile giriş yap'}
            </button>
          </div>
        )}

        {state.status === 'denied' && (
          <div className="adm-gate-denied">
            <ShieldAlert size={28} />
            {isGoogleUser(user) ? (
              <p><strong>{user.email}</strong> yönetici olarak yetkilendirilmemiş.</p>
            ) : (
              <p>Yönetim paneline sadece Google hesabıyla girilir. Şu an <strong>{user.email || 'başka bir yöntemle'}</strong> giriş yapılmış.</p>
            )}
            <p className="adm-muted">Yetkili bir yönetici, panelden bu e-postayı eklemeli.</p>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-block adm-google" onClick={googleLogin} disabled={busy}>
              <GoogleIcon /> Başka Google hesabıyla giriş yap
            </button>
          </div>
        )}

        <Link to="/" className="adm-back-link">← Siteye dön</Link>
      </div>
    </div>
  );
};

export default AdminGate;
