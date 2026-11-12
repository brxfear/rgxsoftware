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
import { useT } from '../../i18n';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose }) => {
  const { t } = useT();
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
        toast.success(t('auth.welcome'));
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success(t('auth.created'));
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
      toast.success(t('auth.googleOk'));
      onClose();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      toast.error(t('auth.resetNeedEmail'));
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(t('auth.resetSent'));
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="glass-panel auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <h2 className="cyber-font neon-text">{isLogin ? t('auth.login') : t('auth.register')}</h2>
          <button onClick={onClose} className="close-btn" aria-label={t('modal.close')}><X /></button>
        </div>

        <button type="button" className="auth-google-btn" onClick={handleGoogle} disabled={loading}>
          <GoogleIcon /> {t('auth.google')}
        </button>
        <div className="auth-or"><span>{t('auth.orEmail')}</span></div>

        <form onSubmit={handleAuth} className="auth-form">
          <div className="input-group">
            <Mail className="input-icon" size={18} />
            <input
              type="email"
              placeholder={t('auth.email')}
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
              placeholder={t('auth.password')}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="glass-input"
            />
          </div>

          <button type="submit" className="neon-button auth-submit" disabled={loading}>
            {loading ? t('auth.processing') : isLogin ? t('auth.login') : t('auth.create')}
          </button>
        </form>

        <div className="auth-footer">
          <p onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? t('auth.toRegister') : t('auth.toLogin')}
          </p>
          {isLogin && <p onClick={handleReset}>{t('auth.forgot')}</p>}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
