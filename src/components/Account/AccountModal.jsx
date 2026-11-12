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
import './AccountModal.css';

const STATUS = {
  'Waiting for Confirmation': { label: 'Onay bekliyor', tone: 'warn' },
  pending_payment: { label: 'Ödeme bekleniyor', tone: 'muted' },
  paid: { label: 'Ödendi — hazırlanıyor', tone: 'info' },
  Completed: { label: 'Teslim edildi', tone: 'ok' },
  Canceled: { label: 'İptal edildi', tone: 'bad' },
};
const statusOf = (s = '') => STATUS[s] || (s.startsWith('failed') ? { label: 'Ödeme başarısız', tone: 'bad' } : { label: s || '—', tone: 'muted' });
const tl = (n) => '₺' + (Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
const fmt = (v) => toDate(v)?.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—';

const AccountModal = ({ isOpen, onClose, user, initialTab = 'profile', onProfileUpdated }) => {
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
        toast.error('Siparişler yüklenemedi.');
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
      toast.success('Profil güncellendi.');
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    toast.success('Çıkış yapıldı.');
    onClose();
  };

  const resetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success('Şifre sıfırlama bağlantısı e-postana gönderildi.');
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
          toast.error('Hesabı silmek için şifreni gir.');
          return;
        }
        await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(user.email, password));
      }
      await useCartStore.getState().clearCart();
      await deleteUser(auth.currentUser);
      toast.success('Hesabın silindi.');
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
      <div className="acc-modal" role="dialog" aria-modal="true" aria-label="Hesabım" onClick={(e) => e.stopPropagation()}>
        <header className="acc-head">
          <div className="acc-identity">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="acc-avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="acc-avatar acc-avatar-letter">{initial}</span>
            )}
            <div>
              <strong>{user.displayName || 'Hesabım'}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <button className="acc-icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </header>

        <nav className="acc-tabs">
          <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}><User size={15} /> Profil</button>
          <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}><Package size={15} /> Siparişlerim</button>
        </nav>

        <div className="acc-body">
          {tab === 'profile' && (
            <>
              <form className="acc-section" onSubmit={saveName}>
                <label className="acc-label" htmlFor="acc-name">Görünen ad</label>
                <div className="acc-row">
                  <input id="acc-name" className="acc-input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Adın" />
                  <button className="acc-btn acc-btn-primary" disabled={savingName || name.trim() === (user.displayName || '')}>
                    {savingName ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                </div>
              </form>

              <div className="acc-section">
                <span className="acc-label">E-posta</span>
                <div className="acc-static">{user.email}</div>
              </div>

              <div className="acc-section">
                <span className="acc-label">Giriş yöntemi</span>
                <div className="acc-static acc-providers">
                  {isGoogle && <span className="acc-chip"><GoogleIcon /> Google</span>}
                  {hasPassword && <span className="acc-chip"><KeyRound size={13} /> E-posta ve şifre</span>}
                </div>
                {hasPassword && (
                  <button type="button" className="acc-link" onClick={resetPassword}>Şifre sıfırlama bağlantısı gönder</button>
                )}
              </div>

              <div className="acc-actions">
                <button className="acc-btn acc-btn-ghost" onClick={logout}><LogOut size={15} /> Çıkış yap</button>
              </div>

              <div className="acc-danger">
                {!confirmDelete ? (
                  <button className="acc-link acc-link-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} /> Hesabımı sil
                  </button>
                ) : (
                  <div className="acc-danger-box">
                    <p>
                      Hesabın kalıcı olarak silinir ve bu işlem geri alınamaz. Geçmiş siparişlerin kayıtlarımızda kalır,
                      ama artık onlara bu hesapla erişemezsin.
                    </p>
                    {!isGoogle && hasPassword && (
                      <input
                        className="acc-input"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Onay için şifren"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    )}
                    <div className="acc-row">
                      <button className="acc-btn acc-btn-ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>Vazgeç</button>
                      <button className="acc-btn acc-btn-danger" onClick={removeAccount} disabled={busy}>
                        {busy ? 'Siliniyor…' : isGoogle ? 'Google ile onayla ve sil' : 'Kalıcı olarak sil'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'orders' && (
            <div className="acc-orders">
              {orders === null && <p className="acc-muted">Yükleniyor…</p>}
              {orders?.length === 0 && (
                <p className="acc-muted">Henüz siparişin yok. Kart ile ödemelerde key ve kurulum bilgileri e-postana gönderilir.</p>
              )}
              {orders?.map((o) => {
                const st = statusOf(o.status);
                return (
                  <article key={o.id} className="acc-order">
                    <div className="acc-order-top">
                      <code>#{(o.merchant_oid || o.id).slice(-8)}</code>
                      <span className={`acc-pill acc-pill-${st.tone}`}>{st.label}</span>
                    </div>
                    <ul>
                      {(o.items || []).map((i, idx) => (
                        <li key={idx}>
                          <span>{i.name} <em>· {i.durationLabel}{i.quantity > 1 ? ` × ${i.quantity}` : ''}</em></span>
                        </li>
                      ))}
                    </ul>
                    <div className="acc-order-foot">
                      <span>{fmt(o.created_at)}</span>
                      <strong>{tl(o.total_amount)}</strong>
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
