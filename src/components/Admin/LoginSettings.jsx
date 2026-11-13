// Yöneticinin kendi giriş bilgileri: kullanıcı adı (sunucuda tutulur) ve şifre (Firebase Auth).
// Şifre, mevcut hesaba (aynı kullanıcı) e-posta/şifre girişi olarak bağlanır; e-posta panelde gösterilmez.
import React, { useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
} from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { auth } from '../../lib/firebase';
import { loggedBatch } from '../../lib/adminLog';
import { authErrorMessage } from '../../lib/authErrors';

const api = async (method, body) => {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch('/api/admin-username', {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || `İstek başarısız (${r.status})`);
  return d;
};

const LoginSettings = ({ me }) => {
  const [username, setUsername] = useState('');
  const [current, setCurrent] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [oldPw, setOldPw] = useState('');
  const [busy, setBusy] = useState(false);

  const user = auth.currentUser;
  const hasPassword = !!user?.providerData?.some((p) => p.providerId === 'password');
  const hasGoogle = !!user?.providerData?.some((p) => p.providerId === 'google.com');

  useEffect(() => {
    api('GET')
      .then((d) => {
        setCurrent(d.username);
        setUsername(d.username || '');
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const saveUsername = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api('POST', { username: username.trim().toLowerCase() });
      setCurrent(d.username);
      setUsername(d.username);
      toast.success('Kullanıcı adı kaydedildi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error('Şifre en az 8 karakter olmalı.');
    if (pw !== pw2) return toast.error('Şifreler eşleşmiyor.');
    setBusy(true);
    const apply = () =>
      hasPassword ? updatePassword(user, pw) : linkWithCredential(user, EmailAuthProvider.credential(user.email, pw));
    try {
      try {
        await apply();
      } catch (err) {
        if (err?.code !== 'auth/requires-recent-login') throw err;
        // Güvenlik gereği kimliği yeniden doğrula, sonra tekrar dene
        if (hasGoogle) await reauthenticateWithPopup(user, new GoogleAuthProvider());
        else if (oldPw) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, oldPw));
        else throw new Error('Güvenlik için mevcut şifreni de gir.');
        await apply();
      }
      await loggedBatch({
        me,
        action: 'update',
        targetType: 'admin',
        targetId: me.id,
        summary: hasPassword ? 'Giriş şifresini değiştirdi' : 'Kullanıcı adı/şifre ile girişi açtı (şifre belirledi)',
        ops: () => {},
      });
      setPw('');
      setPw2('');
      setOldPw('');
      toast.success(hasPassword ? 'Şifre değiştirildi' : 'Şifre belirlendi; artık kullanıcı adı/şifre ile girebilirsin');
    } catch (err) {
      toast.error(err.code ? authErrorMessage(err) : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-card adm-card-pad">
      <h2 className="adm-card-title">Giriş bilgilerim</h2>
      <p className="adm-muted adm-help">
        Google'a ek olarak <strong>kullanıcı adı veya e-posta + şifre</strong> ile de girebilmek için ikisini belirle.
        E-postan panelde hiçbir yerde görünmez.
      </p>

      <form onSubmit={saveUsername}>
        <label className="adm-field">
          <span className="adm-label">Kullanıcı adı {current && <em className="adm-you">(şu an: {current})</em>}</span>
          <input
            className="adm-input"
            value={username}
            maxLength={24}
            placeholder={loaded ? 'ör. rgx.kurucu' : 'Yükleniyor…'}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
          />
        </label>
        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-ghost" disabled={busy || !username || username === current}>Kullanıcı adını kaydet</button>
        </div>
      </form>

      <form onSubmit={savePassword} className="adm-pw-form">
        <span className="adm-label">{hasPassword ? 'Şifreyi değiştir' : 'Şifre belirle'}</span>
        {hasPassword && !hasGoogle && (
          <input className="adm-input" type="password" autoComplete="current-password" placeholder="Mevcut şifre" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        )}
        <input className="adm-input" type="password" autoComplete="new-password" placeholder="Yeni şifre (en az 8 karakter)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="adm-input" type="password" autoComplete="new-password" placeholder="Yeni şifre (tekrar)" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-primary" disabled={busy || !pw}>{hasPassword ? 'Şifreyi değiştir' : 'Şifreyi belirle'}</button>
        </div>
      </form>
    </div>
  );
};

export default LoginSettings;
