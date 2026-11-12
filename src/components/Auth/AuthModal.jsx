import React, { useState } from 'react';
import { X, Mail, Lock } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { auth } from '../../lib/firebase';
import { authErrorMessage } from '../../lib/authErrors';
import GoogleIcon from '../GoogleIcon';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Giriş yapıldı. Tekrar hoş geldin!');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Hesabın oluşturuldu.');
      }
      onClose();
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      toast.success('Google ile giriş yapıldı.');
      onClose();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      toast.error('Önce e-posta adresini yaz.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Şifre sıfırlama bağlantısı e-postana gönderildi.');
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="glass-panel auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <h2 className="cyber-font neon-text">{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</h2>
          <button onClick={onClose} className="close-btn" aria-label="Kapat"><X /></button>
        </div>

        <button type="button" className="auth-google-btn" onClick={handleGoogle} disabled={loading}>
          <GoogleIcon /> Google ile devam et
        </button>
        <div className="auth-or"><span>veya e-posta ile</span></div>

        <form onSubmit={handleAuth} className="auth-form">
          <div className="input-group">
            <Mail className="input-icon" size={18} />
            <input
              type="email"
              placeholder="E-posta"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="glass-input"
            />
          </div>
          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input
              type="password"
              placeholder="Şifre"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="glass-input"
            />
          </div>

          <button type="submit" className="neon-button auth-submit" disabled={loading}>
            {loading ? 'İşleniyor...' : isLogin ? 'Giriş Yap' : 'Hesap Oluştur'}
          </button>
        </form>

        <div className="auth-footer">
          <p onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
          </p>
          {isLogin && <p onClick={handleReset}>Şifremi unuttum</p>}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
