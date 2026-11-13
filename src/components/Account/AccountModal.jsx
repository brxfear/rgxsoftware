import React, { useEffect, useState } from 'react';
import {
  signOut,
  updateProfile,
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { X, User, Package, LogOut, Trash2, KeyRound } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth, db } from '../../lib/firebase';
import { toDate } from '../../lib/db';
import { authErrorMessage } from '../../lib/authErrors';
import { useCartStore } from '../../store/useCartStore';
import GoogleIcon from '../GoogleIcon';
import { useT, planLabel, translate } from '../../i18n';
import { fmtMoney } from '../../lib/currency';
import OrderDelivery from './OrderDelivery';
import './AccountModal.css';

const STATUS_KEY = {
  'Waiting for Confirmation': ['waiting', 'warn'],
  pending_payment: ['pending', 'muted'],
  paid: ['paid', 'info'],
  Completed: ['done', 'ok'],
  Canceled: ['canceled', 'bad'],
};
const statusOf = (s = '', t) => {
  const k = STATUS_KEY[s] || (s.startsWith('failed') ? ['failed', 'bad'] : null);
  return k ? { label: t(`account.status.${k[0]}`), tone: k[1] } : { label: s || '—', tone: 'muted' };
};

const AccountModal = ({ isOpen, onClose, user, initialTab = 'profile', onProfileUpdated }) => {
  const { t, lang } = useT();
  const fmt = (v) => toDate(v)?.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—';
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState(user?.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [orders, setOrders] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isGoogle = !!user?.providerData?.some((p) => p.providerId === 'google.com');
  const hasPassword = !!user?.providerData?.some((p) => p.providerId === 'password');

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setName(user?.displayName || '');
      setConfirmDelete(false);
      setPassword('');
    }
  }, [isOpen, initialTab, user]);

  useEffect(() => {
    if (!isOpen || tab !== 'orders' || !user) return;
    let cancelled = false;
    setOrders(null);
    getDocs(query(collection(db, 'orders'), where('user_id', '==', user.uid), orderBy('created_at', 'desc'), limit(50)))
      .then((snap) => !cancelled && setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((err) => {
        console.error(err);
        if (!cancelled) setOrders([]);
        toast.error(translate('account.ordersFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, tab, user]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const saveName = async (e) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 40);
    setSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: clean || null });
      onProfileUpdated?.();
      toast.success(t('account.saved'));
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    toast.success(t('nav.loggedOut'));
    onClose();
  };

  const resetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success(t('auth.resetSent'));
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  };

  const removeAccount = async () => {
    setBusy(true);
    try {
      // Silmeden önce kimliği yeniden doğrula (Firebase güvenlik şartı)
      if (isGoogle) {
        await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
      } else if (hasPassword) {
        if (!password) {
          toast.error(t('account.needPassword'));
          return;
        }
        await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(user.email, password));
      }
      await useCartStore.getState().clearCart();
      await deleteUser(auth.currentUser);
      toast.success(t('account.deleted'));
      onClose();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const initial = (user.displayName || user.email || '?')[0].toUpperCase();

  return (
    <div className="acc-overlay" onClick={onClose}>
      <div className="acc-modal" role="dialog" aria-modal="true" aria-label={t('account.title')} onClick={(e) => e.stopPropagation()}>
        <header className="acc-head">
          <div className="acc-identity">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="acc-avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="acc-avatar acc-avatar-letter">{initial}</span>
            )}
            <div>
              <strong>{user.displayName || t('account.title')}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <button className="acc-icon-btn" onClick={onClose} aria-label={t('modal.close')}><X size={18} /></button>
        </header>

        <nav className="acc-tabs">
          <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}><User size={15} /> {t('account.profile')}</button>
          <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}><Package size={15} /> {t('account.orders')}</button>
        </nav>

        <div className="acc-body">
          {tab === 'profile' && (
            <>
              <form className="acc-section" onSubmit={saveName}>
                <label className="acc-label" htmlFor="acc-name">{t('account.displayName')}</label>
                <div className="acc-row">
                  <input id="acc-name" className="acc-input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('account.namePh')} />
                  <button className="acc-btn acc-btn-primary" disabled={savingName || name.trim() === (user.displayName || '')}>
                    {savingName ? t('account.saving') : t('account.save')}
                  </button>
                </div>
              </form>

              <div className="acc-section">
                <span className="acc-label">{t('account.email')}</span>
                <div className="acc-static">{user.email}</div>
              </div>

              <div className="acc-section">
                <span className="acc-label">{t('account.method')}</span>
                <div className="acc-static acc-providers">
                  {isGoogle && <span className="acc-chip"><GoogleIcon /> Google</span>}
                  {hasPassword && <span className="acc-chip"><KeyRound size={13} /> {t('account.passwordMethod')}</span>}
                </div>
                {hasPassword && (
                  <button type="button" className="acc-link" onClick={resetPassword}>{t('account.sendReset')}</button>
                )}
              </div>

              <div className="acc-actions">
                <button className="acc-btn acc-btn-ghost" onClick={logout}><LogOut size={15} /> {t('account.logout')}</button>
              </div>

              <div className="acc-danger">
                {!confirmDelete ? (
                  <button className="acc-link acc-link-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} /> {t('account.delete')}
                  </button>
                ) : (
                  <div className="acc-danger-box">
                    <p>{t('account.deleteWarn')}</p>
                    {!isGoogle && hasPassword && (
                      <input
                        className="acc-input"
                        type="password"
                        autoComplete="current-password"
                        placeholder={t('account.passwordConfirm')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    )}
                    <div className="acc-row">
                      <button className="acc-btn acc-btn-ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>{t('account.cancel')}</button>
                      <button className="acc-btn acc-btn-danger" onClick={removeAccount} disabled={busy}>
                        {busy ? t('account.deleting') : isGoogle ? t('account.deleteGoogle') : t('account.deleteForever')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'orders' && (
            <div className="acc-orders">
              {orders === null && <p className="acc-muted">{t('account.loading')}</p>}
              {orders?.length === 0 && (
                <p className="acc-muted">{t('account.noOrders')}</p>
              )}
              {orders?.map((o) => {
                const st = statusOf(o.status, t);
                return (
                  <article key={o.id} className="acc-order">
                    <div className="acc-order-top">
                      <code>#{(o.merchant_oid || o.id).slice(-8)}</code>
                      <span className={`acc-pill acc-pill-${st.tone}`}>{st.label}</span>
                    </div>
                    <ul>
                      {(o.items || []).map((i, idx) => (
                        <li key={idx}>
                          <span>{i.name} <em>· {planLabel(i.durationLabel, lang)}{i.quantity > 1 ? ` × ${i.quantity}` : ''}</em></span>
                        </li>
                      ))}
                    </ul>
                    <OrderDelivery delivery={o.delivery} />
                    <div className="acc-order-foot">
                      <span>{fmt(o.created_at)}</span>
                      <strong>{fmtMoney(o.total_amount, o.currency || 'USD')}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountModal;
