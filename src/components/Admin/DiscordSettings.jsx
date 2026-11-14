// Admin → Ayarlar → Discord: davet linki, vouch kanalı ve bot durumu / eşitleme.
import React, { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { auth, db } from '../../lib/firebase';
import { loggedWrite } from '../../lib/adminLog';
import { useShopStore } from '../../store/useShopStore';

const api = async (method, path, body) => {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || `İstek başarısız (${r.status})`);
  return data;
};

const INVITE_RE = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+\/?$/i;

const DiscordSettings = ({ me }) => {
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState({ invite_url: '', vouch_channel_id: '' });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ loading: true, data: null, error: null });
  const [syncing, setSyncing] = useState(false);

  const loadStatus = async () => {
    setStatus((s) => ({ ...s, loading: true }));
    try {
      setStatus({ loading: false, data: await api('GET', '/api/discord?action=status'), error: null });
    } catch (err) {
      setStatus({ loading: false, data: null, error: err.message });
    }
  };

  useEffect(() => {
    getDoc(doc(db, 'settings', 'discord'))
      .then((s) => {
        const d = s.exists() ? s.data() : {};
        setCurrent(d);
        setForm({ invite_url: d.invite_url || 'https://discord.gg/rgxsoftware1', vouch_channel_id: d.vouch_channel_id || '' });
      })
      .catch((err) => toast.error('Discord ayarları okunamadı: ' + err.code));
    loadStatus();
  }, []);

  if (!current) return <section className="adm-card adm-card-pad"><p className="adm-muted">Yükleniyor…</p></section>;

  const save = async (e) => {
    e.preventDefault();
    const invite = form.invite_url.trim();
    const channel = form.vouch_channel_id.trim();
    if (!INVITE_RE.test(invite)) return toast.error('Davet linki https://discord.gg/… biçiminde olmalı.');
    if (channel && !/^\d{15,25}$/.test(channel)) return toast.error('Kanal kimliği sadece rakamlardan oluşur.');
    const changed = [];
    if (invite !== (current.invite_url || '')) changed.push('davet linki');
    if (channel !== (current.vouch_channel_id || '')) changed.push('vouch kanalı');
    if (!changed.length) return toast('Değişiklik yok');
    setSaving(true);
    try {
      const { last_log_id: _l, updated_at: _u, ...rest } = current;
      const data = { ...rest, invite_url: invite, vouch_channel_id: channel, updated_at: serverTimestamp() };
      await loggedWrite({ me, mode: 'set', collectionName: 'settings', id: 'discord', targetType: 'settings', action: 'update', data, summary: `Discord ayarları güncellendi (${changed.join(', ')})` });
      setCurrent(data);
      useShopStore.setState((s) => ({ discord: { ...s.discord, ...data } }));
      toast.success('Discord ayarları kaydedildi');
    } catch (err) {
      toast.error('Kaydedilemedi: ' + (err.code || err.message));
    } finally {
      setSaving(false);
    }
  };

  const sync = async (full) => {
    if (full && !confirm('Kanal baştan taransın mı? Kanaldan silinmiş yorumlar sitedeki listeden de kaldırılır.')) return;
    setSyncing(true);
    try {
      const r = await api('POST', '/api/discord?action=sync', { full });
      toast.success(`${r.added} yorum işlendi${r.removed ? `, ${r.removed} kaldırıldı` : ''}`);
      loadStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const st = status.data;
  const channels = (st?.guilds || []).flatMap((g) => g.channels.map((c) => ({ ...c, guild: g.name })));
  const inviteUrl = st?.application_id
    ? `https://discord.com/oauth2/authorize?client_id=${st.application_id}&scope=bot&permissions=66560`
    : null;

  return (
    <section className="adm-card adm-card-pad">
      <h2 className="adm-card-title">Discord</h2>
      <form onSubmit={save}>
        <label className="adm-field">
          <span className="adm-label">Sunucu davet linki</span>
          <input className="adm-input" value={form.invite_url} placeholder="https://discord.gg/…" onChange={(e) => setForm((f) => ({ ...f, invite_url: e.target.value }))} />
        </label>
        <p className="adm-muted adm-help">Sitedeki tüm Discord düğmeleri (üst bar, ana sayfa, SSS, ödeme, müşteri paneli) bu linki kullanır.</p>

        <label className="adm-field">
          <span className="adm-label">Vouch (yorum) kanalı</span>
          {channels.length ? (
            <select className="adm-input" value={form.vouch_channel_id} onChange={(e) => setForm((f) => ({ ...f, vouch_channel_id: e.target.value }))}>
              <option value="">— Kanal seç —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.guild} · #{c.name}</option>
              ))}
            </select>
          ) : (
            <input className="adm-input" value={form.vouch_channel_id} placeholder="Kanal kimliği (ör. 1234567890123456789)" onChange={(e) => setForm((f) => ({ ...f, vouch_channel_id: e.target.value }))} />
          )}
        </label>
        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-primary" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </form>

      <h3 className="adm-card-title" style={{ marginTop: 18 }}>Vouch botu</h3>
      {status.loading ? (
        <p className="adm-muted">Bot kontrol ediliyor…</p>
      ) : status.error ? (
        <>
          <p className="adm-muted adm-help">Bota ulaşılamadı: {status.error}</p>
          <button className="adm-btn adm-btn-ghost" onClick={loadStatus}>Tekrar dene</button>
        </>
      ) : !st?.configured ? (
        <p className="adm-muted adm-help">
          Bot henüz bağlı değil. Vercel → Settings → Environment Variables'a <code>DISCORD_BOT_TOKEN</code> ekleyip yeniden deploy et.
        </p>
      ) : (
        <>
          <ul className="adm-env-list">
            <li>Bot: <strong>{st.bot.username}</strong></li>
            <li>Sunucular: {st.guilds.length ? st.guilds.map((g) => g.name).join(', ') : <span className="adm-pill adm-pill-warn">Bot hiçbir sunucuda değil</span>}</li>
            <li>
              Mesaj içeriği izni:{' '}
              <span className={`adm-pill adm-pill-${st.content_intent ? 'ok' : 'warn'}`}>{st.content_intent ? 'Açık' : 'Kapalı — Developer Portal → Bot → Message Content Intent'}</span>
            </li>
            <li>Sitedeki yorum sayısı: <strong>{st.vouch_count}</strong>{st.last_run && <> · son eşitleme {new Date(st.last_run).toLocaleString('tr-TR')}</>}</li>
          </ul>
          {!st.guilds.length && inviteUrl && (
            <p className="adm-muted adm-help">
              Botu sunucuna eklemek için: <a href={inviteUrl} target="_blank" rel="noopener noreferrer">bu bağlantıyı aç</a> (sadece kanalları görme ve mesaj geçmişini okuma izni ister).
            </p>
          )}
          <p className="adm-muted adm-help">Yeni yorumlar, biri yorumlar sayfasını açtığında en fazla 10 dakikada bir ve her gün otomatik olarak çekilir.</p>
          <div className="adm-form-actions">
            <button className="adm-btn adm-btn-ghost" onClick={() => sync(true)} disabled={syncing || !current.vouch_channel_id}>Baştan tara</button>
            <button className="adm-btn adm-btn-primary" onClick={() => sync(false)} disabled={syncing || !current.vouch_channel_id}>{syncing ? 'Çekiliyor…' : 'Şimdi çek'}</button>
          </div>
        </>
      )}
    </section>
  );
};

export default DiscordSettings;
