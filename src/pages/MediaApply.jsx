// /media sayfasındaki medya (içerik üreticisi) başvuru formu. Sunucuda bayi başvurusuyla aynı
// uç noktayı kullanır (role: 'media'); yönetici Admin → Bayiler → Bekleyen başvurulardan onaylar.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Loader2, LogIn, Send, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { useShopStore } from '../store/useShopStore';

const PLATFORMS = ['YouTube', 'TikTok', 'Twitch', 'Kick', 'Instagram', 'X / Twitter', 'Diğer'];

const TXT = {
  tr: {
    title: 'Medya başvurusu', sub: 'Formu doldur, ekibimiz kanalını inceleyip onaylasın. Onaylanınca medya panelin açılır.',
    login: 'Başvurmak için giriş yap', name: 'Kanal / yayıncı adın', platform: 'Platform', channel: 'Kanal / profil linkin', followers: 'Takipçi / abone sayısı',
    discord: 'Discord kullanıcı adın', about: 'Ne tür içerik üretiyorsun? (ortalama izlenme, yayın sıklığı)', accept: 'Medya programı şartlarını okudum ve kabul ediyorum.',
    send: 'Başvuruyu gönder', done: 'Başvurun alındı! İncelenince Discord’dan ve panelinden haber alacaksın.', closed: 'Başvurular şu an kapalı. Bilgi için Discord’dan yazabilirsin.',
    pending: 'Başvurun inceleniyor', pendingSub: 'Genelde birkaç gün içinde dönüş yapıyoruz. Sonuç panelinde ve Discord’da görünecek.',
    active: 'Hesabın aktif', activeSub: 'Panelinden haftalık keylerini çıkarabilirsin.', open: 'Panele git',
    rejected: 'Başvurun onaylanmadı', rejectedSub: 'Detay için Discord’dan bize yazabilirsin.',
    already: 'Bu hesapla zaten bir bayi / medya hesabın var.', rules: 'Şartlar',
  },
  en: {
    title: 'Media application', sub: 'Fill in the form and our team will review your channel. Once approved, your media panel opens.',
    login: 'Sign in to apply', name: 'Channel / creator name', platform: 'Platform', channel: 'Channel / profile link', followers: 'Followers / subscribers',
    discord: 'Your Discord username', about: 'What kind of content do you make? (avg. views, upload rate)', accept: 'I have read and accept the media program terms.',
    send: 'Send application', done: 'Application received! You will hear from us on Discord and in your panel.', closed: 'Applications are closed right now. Ask us on Discord.',
    pending: 'Your application is under review', pendingSub: 'We usually reply within a few days. The result shows in your panel and on Discord.',
    active: 'Your account is active', activeSub: 'Grab your weekly keys from your panel.', open: 'Open panel',
    rejected: 'Your application was not approved', rejectedSub: 'Message us on Discord for details.',
    already: 'This account already has a reseller / media account.', rules: 'Terms',
  },
};

const api = async (method, body) => {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch('/api/reseller?action=signup', {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || `Hata (${r.status})`);
  return d;
};

const MediaApply = ({ lang }) => {
  const s = TXT[lang] || TXT.tr;
  const user = useShopStore((st) => st.user);
  const authReady = useShopStore((st) => st.authReady);
  const reseller = useShopStore((st) => st.reseller);
  const [info, setInfo] = useState(null);
  const [f, setF] = useState({ name: '', platform: 'YouTube', channel: '', followers: '', discord: '', about: '' });
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (!user) return;
    api('GET').then(setInfo).catch(() => setInfo({ open: false }));
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const about = [`Platform: ${f.platform}`, f.followers && `Takipçi: ${f.followers}`, f.about.trim()].filter(Boolean).join('\n');
      await api('POST', { display_name: f.name, role: 'media', discord: f.discord, channel_url: f.channel.trim(), about, accept_rules: accept });
      toast.success(s.done);
      const snap = await getDoc(doc(db, 'resellers', user.uid));
      useShopStore.setState({ reseller: snap.exists() ? { uid: snap.id, ...snap.data() } : null });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (!authReady) {
    body = <div className="md-apply-state"><Loader2 size={20} className="spin" /></div>;
  } else if (!user) {
    body = (
      <div className="md-apply-state">
        <button className="btn-primary" onClick={() => useShopStore.getState().openAuth()}><LogIn size={16} /> {s.login}</button>
      </div>
    );
  } else if (reseller) {
    const st = reseller.status;
    const [Icon, tone, title, sub] =
      st === 'active' ? [CheckCircle2, 'ok', s.active, s.activeSub]
      : st === 'rejected' ? [XCircle, 'bad', s.rejected, s.rejectedSub]
      : st === 'pending' ? [Clock, 'warn', s.pending, s.pendingSub]
      : [CheckCircle2, 'ok', s.already, ''];
    body = (
      <div className={`md-apply-state md-apply-${tone}`}>
        <Icon size={28} />
        <strong>{title}</strong>
        {sub && <p>{sub}</p>}
        {st === 'active' && <Link className="btn-primary" to="/media-panel">{s.open} <ArrowRight size={16} /></Link>}
      </div>
    );
  } else if (info && (info.media_open ?? info.open) === false) {
    body = <div className="md-apply-state"><p>{s.closed}</p></div>;
  } else {
    const valid = accept && f.name.trim().length >= 2 && f.discord.trim().length >= 2 && /^https?:\/\//i.test(f.channel.trim());
    body = (
      <form className="md-apply-form" onSubmit={submit}>
        <div className="md-apply-grid">
          <label><span>{s.name}</span><input value={f.name} maxLength={40} required onChange={set('name')} placeholder="ör. RGX Clips" /></label>
          <label><span>{s.platform}</span>
            <select value={f.platform} onChange={set('platform')}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
          <label><span>{s.channel}</span><input value={f.channel} maxLength={200} required onChange={set('channel')} placeholder="https://youtube.com/@kanal" /></label>
          <label><span>{s.followers}</span><input value={f.followers} maxLength={20} onChange={set('followers')} placeholder="ör. 12.000" /></label>
          <label><span>{s.discord}</span><input value={f.discord} maxLength={60} required onChange={set('discord')} placeholder="kullaniciadi" /></label>
        </div>
        <label><span>{s.about}</span><textarea rows={3} maxLength={500} value={f.about} onChange={set('about')} /></label>
        {(info?.media_rules || info?.rules) && <div className="md-apply-rules"><strong>{s.rules}</strong>{info.media_rules || info.rules}</div>}
        <label className="md-apply-check"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /> {s.accept}</label>
        <button className="btn-primary" disabled={busy || !valid}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />} {s.send}</button>
      </form>
    );
  }

  return (
    <section className="md-apply" id="apply">
      <div className="md-apply-head">
        <h2>{s.title}</h2>
        <p>{s.sub}</p>
      </div>
      {body}
    </section>
  );
};

export default MediaApply;
