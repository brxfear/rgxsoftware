// Admin → Bayiler: bayi ekle/düzenle, limitler, indirim, bakiye düzeltme, bayi kuralları/rehberi.
import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Plus, Pencil, Wallet, X, KeyRound, ArrowLeftRight } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { toDate, getPlans } from '../../lib/db';
import { loggedWrite } from '../../lib/adminLog';

const api = async (action, body) => {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(`/api/reseller?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || `İstek başarısız (${r.status})`);
  return d;
};

const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const istanbulDay = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
// Medya kotasının haftası (İstanbul, pazartesi başlar) — sunucudaki weekKey ile aynı
const weekStart = () => {
  const dt = new Date(`${istanbulDay()}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};

const STATUS = { active: ['Aktif', 'ok'], suspended: ['Askıda', 'bad'], pending: ['Başvuru bekliyor', 'warn'], rejected: ['Reddedildi', 'muted'] };
const ROLE = { reseller: 'Bayi', media: 'Medya', both: 'Bayi + Medya' };

/** Mevcut kaydı admin-save'e gönderilecek biçime çevirir (hızlı onay/red için) */
const payloadFrom = (r, over = {}) => ({
  uid: r.uid, display_name: r.display_name, status: r.status, role: r.role || 'reseller', discount_pct: r.discount_pct || 0,
  daily_limit: r.daily_limit || 0, monthly_limit: r.monthly_limit || 0, notes: r.notes || '', is_test: !!r.is_test,
  media: { enabled: r.media?.enabled !== false, weekly_limit: r.media?.weekly_limit || 0, allowed: r.media?.allowed || [] },
  ...over,
});

const ResellerForm = ({ initial, products, onClose }) => {
  const isNew = !initial?.uid;
  const [f, setF] = useState({
    email: initial?.email || '',
    display_name: initial?.display_name || '',
    status: initial?.status || 'active',
    discount_pct: initial?.discount_pct ?? 0,
    daily_limit: initial?.daily_limit ?? 20,
    monthly_limit: initial?.monthly_limit ?? 300,
    initial_balance: 0,
    notes: initial?.notes || '',
    is_test: !!initial?.is_test,
    role: initial?.role || 'reseller',
    media: { enabled: initial?.media?.enabled !== false, weekly_limit: initial?.media?.weekly_limit ?? 3, allowed: initial?.media?.allowed || [] },
  });
  const toggleAllowed = (k) => setF((x) => ({ ...x, media: { ...x.media, allowed: x.media.allowed.includes(k) ? x.media.allowed.filter((a) => a !== k) : [...x.media.allowed, k] } }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('admin-save', { ...f, uid: initial?.uid });
      toast.success(isNew ? (r.created ? 'Bayi eklendi — şifre belirleme e-postası gönderildi' : 'Bayi eklendi (mevcut hesaba bağlandı)') : 'Bayi güncellendi');
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <form className="adm-drawer" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <header className="adm-drawer-head">
          <h2>{isNew ? 'Yeni bayi' : `Bayi: ${initial.display_name}`}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </header>
        <div className="adm-drawer-body">
          <div className="adm-grid-2">
            <label className="adm-field">
              <span className="adm-label">Bayi adı *</span>
              <input className="adm-input" value={f.display_name} onChange={set('display_name')} maxLength={40} required />
            </label>
            <label className="adm-field">
              <span className="adm-label">E-posta {isNew ? '*' : '(değiştirilemez)'}</span>
              <input className="adm-input" type="email" value={f.email} onChange={set('email')} disabled={!isNew} required={isNew} />
            </label>
          </div>
          {isNew && <p className="adm-muted adm-help">Bu e-postayla hesap yoksa açılır ve kişiye “şifreni belirle” e-postası gider; varsa mevcut hesap bayi yapılır. Bayi siteye bu hesapla girip /reseller adresinden panele ulaşır.</p>}
          <div className="adm-grid-2">
            <label className="adm-field">
              <span className="adm-label">Durum</span>
              <select className="adm-input" value={f.status} onChange={set('status')}>
                <option value="active">Aktif</option>
                <option value="pending">Başvuru bekliyor</option>
                <option value="suspended">Askıda (key çıkaramaz)</option>
                <option value="rejected">Reddedildi</option>
              </select>
            </label>
            <label className="adm-field">
              <span className="adm-label">Ek indirim (%)</span>
              <input className="adm-input" type="number" min={0} max={90} value={f.discount_pct} onChange={set('discount_pct')} />
            </label>
          </div>
          <div className="adm-grid-2">
            <label className="adm-field">
              <span className="adm-label">Günlük key limiti (0 = sınırsız)</span>
              <input className="adm-input" type="number" min={0} value={f.daily_limit} onChange={set('daily_limit')} />
            </label>
            <label className="adm-field">
              <span className="adm-label">Aylık key limiti (0 = sınırsız)</span>
              <input className="adm-input" type="number" min={0} value={f.monthly_limit} onChange={set('monthly_limit')} />
            </label>
          </div>
          {isNew && (
            <label className="adm-field">
              <span className="adm-label">Açılış bakiyesi ($)</span>
              <input className="adm-input" type="number" min={0} step="0.01" value={f.initial_balance} onChange={set('initial_balance')} />
            </label>
          )}
          {initial?.application && (
            <div className="adm-app-box">
              <strong>Başvuru</strong>
              <span>Discord: <code>{initial.application.discord}</code></span>
              {initial.application.channel_url && <span>Kanal: <a href={initial.application.channel_url} target="_blank" rel="noopener noreferrer">{initial.application.channel_url}</a></span>}
              {initial.application.about && <p>{initial.application.about}</p>}
            </div>
          )}
          <label className="adm-field">
            <span className="adm-label">Rol</span>
            <select className="adm-input" value={f.role} onChange={set('role')}>
              <option value="reseller">Bayi (bakiye yükler, key satın alır)</option>
              <option value="media">Medya (sadece haftalık ücretsiz key)</option>
              <option value="both">Bayi + Medya</option>
            </select>
          </label>
          {f.role !== 'reseller' && (
            <div className="adm-media-box">
              <div className="adm-grid-2">
                <label className="adm-field">
                  <span className="adm-label">Haftalık ücretsiz key hakkı</span>
                  <input className="adm-input" type="number" min={0} max={100} value={f.media.weekly_limit} onChange={(e) => setF((x) => ({ ...x, media: { ...x.media, weekly_limit: e.target.value } }))} />
                </label>
                {f.role === 'both' && <label className="adm-switch" style={{ alignSelf: 'end', marginBottom: 10 }}>
                  <input type="checkbox" checked={f.media.enabled} onChange={(e) => setF((x) => ({ ...x, media: { ...x.media, enabled: e.target.checked } }))} />
                  <span className="adm-switch-track"><span /></span>
                  Medya kotası açık
                </label>}
              </div>
              <span className="adm-label">Hangi ürün/planlardan çıkarabilir (sadece bunlar görünür)</span>
              <div className="adm-media-allowed">
                {(products || []).filter((p) => !p.test_only || f.is_test).map((p) => (
                  <div key={p.id} className="adm-media-prod">
                    <strong>{p.name}</strong>
                    <div>
                      {getPlans(p).map((pl) => {
                        const k = `${p.id}:${pl.id}`;
                        return (
                          <label key={k} className={`adm-chip ${f.media.allowed.includes(k) ? 'on' : ''}`}>
                            <input type="checkbox" checked={f.media.allowed.includes(k)} onChange={() => toggleAllowed(k)} hidden />
                            {pl.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="adm-muted adm-help">Ör. haftada 3 adet “3 Gün”: hakkı 3 yap, sadece External’ın 3 Gün planını seç. Hak her pazartesi yenilenir; keyler stoktan ücretsiz çekilir.</p>
            </div>
          )}
          <label className="adm-switch">
            <input type="checkbox" checked={f.is_test} onChange={(e) => setF((x) => ({ ...x, is_test: e.target.checked }))} />
            <span className="adm-switch-track"><span /></span>
            Test bayisi (sadece test ürünlerini de görür; gerçek bayiler test ürünlerini görmez)
          </label>
          <label className="adm-field">
            <span className="adm-label">Not (sadece yöneticiler görür)</span>
            <textarea className="adm-input" rows={3} value={f.notes} onChange={set('notes')} />
          </label>
          <p className="adm-muted adm-help">Bayinin ödediği fiyat: ürün planındaki “Bayi $” fiyatı (boşsa satış fiyatı) eksi bu ek indirim.</p>
        </div>
        <footer className="adm-drawer-foot">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>Vazgeç</button>
          <button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </footer>
      </form>
    </div>
  );
};

const BalanceForm = ({ reseller, onClose }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('admin-balance', { uid: reseller.uid, amount_usd: Number(amount), note });
      toast.success(`Yeni bakiye: ${usd(r.balance)}`);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <form className="adm-drawer adm-drawer-sm" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <header className="adm-drawer-head">
          <h2>Bakiye — {reseller.display_name}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </header>
        <div className="adm-drawer-body">
          <p className="adm-muted">Mevcut bakiye: <strong>{usd(reseller.balance_usd)}</strong></p>
          <label className="adm-field">
            <span className="adm-label">Tutar ($) — eklemek için 25, düşmek için -25</span>
            <input className="adm-input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
          </label>
          <label className="adm-field">
            <span className="adm-label">Açıklama</span>
            <input className="adm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Havale ile yükleme / iade" maxLength={200} />
          </label>
        </div>
        <footer className="adm-drawer-foot">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>Vazgeç</button>
          <button className="adm-btn adm-btn-primary" disabled={busy || !Number(amount)}>{busy ? 'İşleniyor…' : 'Uygula'}</button>
        </footer>
      </form>
    </div>
  );
};

const ResellerDetail = ({ reseller }) => {
  const [keys, setKeys] = useState(null);
  const [txs, setTxs] = useState(null);
  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'reseller_keys'), where('reseller_id', '==', reseller.uid), orderBy('created_at', 'desc'), limit(20)), (s) => setKeys(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setKeys([]));
    const u2 = onSnapshot(query(collection(db, 'reseller_tx'), where('reseller_id', '==', reseller.uid), orderBy('at', 'desc'), limit(20)), (s) => setTxs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setTxs([]));
    return () => {
      u1();
      u2();
    };
  }, [reseller.uid]);
  const fmt = (v) => toDate(v)?.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) || '—';
  return (
    <div className="adm-rs-detail">
      <div>
        <h4><KeyRound size={14} /> Son keyler</h4>
        {keys === null ? <p className="adm-muted">…</p> : !keys.length ? <p className="adm-muted">Key yok.</p> : (
          <ul>{keys.map((k) => <li key={k.id}><code>{k.key}</code><span>{k.product_name} · {k.plan_label} · {usd(k.price_usd)}{k.note ? ` · ${k.note}` : ''}</span><small>{fmt(k.created_at)}</small></li>)}</ul>
        )}
      </div>
      <div>
        <h4><ArrowLeftRight size={14} /> Son işlemler</h4>
        {txs === null ? <p className="adm-muted">…</p> : !txs.length ? <p className="adm-muted">İşlem yok.</p> : (
          <ul>{txs.map((t) => <li key={t.id}><strong className={t.amount_usd >= 0 ? 'pos' : 'neg'}>{t.amount_usd >= 0 ? '+' : ''}{usd(t.amount_usd)}</strong><span>{t.note}</span><small>{fmt(t.at)} · bakiye {usd(t.balance_after)}</small></li>)}</ul>
        )}
      </div>
    </div>
  );
};

const ResellerSettings = ({ me, kind = 'reseller' }) => {
  const isMedia = kind === 'media';
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getDoc(doc(db, 'settings', 'reseller')).then((s) => {
      const d = s.exists() ? s.data() : {};
      setForm({ rules: d.rules || '', guide: d.guide || '', min_topup_usd: d.min_topup_usd ?? 5, signup_open: d.signup_open !== false, default_daily_limit: d.default_daily_limit ?? 20, default_monthly_limit: d.default_monthly_limit ?? 300, default_discount_pct: d.default_discount_pct ?? 0, auto_approve: d.auto_approve === true, media_rules: d.media_rules || '', media_signup_open: d.media_signup_open ?? d.signup_open !== false, media_auto_approve: d.media_auto_approve ?? d.auto_approve === true });
    });
  }, []);
  if (!form) return null;
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await loggedWrite({ me, mode: 'set', collectionName: 'settings', id: 'reseller', targetType: 'settings', action: 'update', data: {
          rules: form.rules,
          guide: form.guide,
          min_topup_usd: Math.max(1, Number(form.min_topup_usd) || 5),
          signup_open: !!form.signup_open,
          auto_approve: !!form.auto_approve,
          media_rules: form.media_rules || '',
          media_signup_open: !!form.media_signup_open,
          media_auto_approve: !!form.media_auto_approve,
          default_daily_limit: Math.max(0, parseInt(form.default_daily_limit, 10) || 0),
          default_monthly_limit: Math.max(0, parseInt(form.default_monthly_limit, 10) || 0),
          default_discount_pct: Math.min(90, Math.max(0, Number(form.default_discount_pct) || 0)),
          updated_at: serverTimestamp(),
        },
        summary: isMedia
          ? `Medya ayarları güncellendi (başvuru ${form.media_signup_open ? 'açık' : 'kapalı'}, otomatik onay ${form.media_auto_approve ? 'açık' : 'kapalı'})`
          : `Bayi ayarları güncellendi (başvuru ${form.signup_open ? 'açık' : 'kapalı'}, varsayılan günlük ${form.default_daily_limit || '∞'} / aylık ${form.default_monthly_limit || '∞'})`,
      });
      toast.success('Kaydedildi');
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setSaving(false);
    }
  };
  const actions = <div className="adm-form-actions"><button className="adm-btn adm-btn-primary" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button></div>;
  if (isMedia) {
    return (
      <form className="adm-card adm-card-pad" onSubmit={save}>
        <h2 className="adm-card-title">Medya programı ayarları</h2>
        <label className="adm-switch">
          <input type="checkbox" checked={form.media_signup_open} onChange={(e) => setForm((x) => ({ ...x, media_signup_open: e.target.checked }))} />
          <span className="adm-switch-track"><span /></span>
          Medya başvuruları açık (sitede /media → “Başvur”)
        </label>
        <label className="adm-switch">
          <input type="checkbox" checked={form.media_auto_approve} onChange={(e) => setForm((x) => ({ ...x, media_auto_approve: e.target.checked }))} />
          <span className="adm-switch-track"><span /></span>
          Medya başvurularını otomatik onayla (kapalıyken sen onaylarsın — önerilen)
        </label>
        <label className="adm-field">
          <span className="adm-label">Medya şartları (başvuru formunda ve medya panelinde görünür)</span>
          <textarea className="adm-input" rows={6} value={form.media_rules} onChange={(e) => setForm((x) => ({ ...x, media_rules: e.target.value }))} placeholder="- Haftada en az 1 video&#10;- Videoda rgx.wtf linki…" />
        </label>
        {actions}
      </form>
    );
  }
  return (
    <form className="adm-card adm-card-pad" onSubmit={save}>
      <h2 className="adm-card-title">Bayilik ayarları</h2>
      <label className="adm-switch">
        <input type="checkbox" checked={form.signup_open} onChange={(e) => setForm((x) => ({ ...x, signup_open: e.target.checked }))} />
        <span className="adm-switch-track"><span /></span>
        Bayi başvuruları açık (sitede /reseller → “Başvur”)
      </label>
      <label className="adm-switch">
        <input type="checkbox" checked={form.auto_approve} onChange={(e) => setForm((x) => ({ ...x, auto_approve: e.target.checked }))} />
        <span className="adm-switch-track"><span /></span>
        Bayi başvurularını otomatik onayla (kapalıyken sen onaylarsın — önerilen)
      </label>
      <div className="adm-grid-2">
        <label className="adm-field">
          <span className="adm-label">Yeni bayi: günlük key limiti (0 = sınırsız)</span>
          <input className="adm-input" type="number" min={0} value={form.default_daily_limit} onChange={(e) => setForm((x) => ({ ...x, default_daily_limit: e.target.value }))} />
        </label>
        <label className="adm-field">
          <span className="adm-label">Yeni bayi: aylık key limiti (0 = sınırsız)</span>
          <input className="adm-input" type="number" min={0} value={form.default_monthly_limit} onChange={(e) => setForm((x) => ({ ...x, default_monthly_limit: e.target.value }))} />
        </label>
      </div>
      <label className="adm-field">
        <span className="adm-label">Yeni bayi: ek indirim (%)</span>
        <input className="adm-input" type="number" min={0} max={90} value={form.default_discount_pct} onChange={(e) => setForm((x) => ({ ...x, default_discount_pct: e.target.value }))} />
      </label>
      <p className="adm-muted adm-help">Kendi açılan bayiler 0 bakiye ile başlar; key çıkarmak için önce bakiye yüklemeleri gerekir. İstediğin bayiyi listeden askıya alabilir, limitini değiştirebilirsin.</p>
      <label className="adm-field">
        <span className="adm-label">Bayi kuralları</span>
        <textarea className="adm-input" rows={6} value={form.rules} onChange={(e) => setForm((x) => ({ ...x, rules: e.target.value }))} placeholder="- Keyleri sadece kendi müşterilerine sat&#10;- Fiyatların sitedeki fiyatın altına inmesin…" />
      </label>
      <label className="adm-field">
        <span className="adm-label">Rehber (kurulum / loader / emulator)</span>
        <textarea className="adm-input" rows={6} value={form.guide} onChange={(e) => setForm((x) => ({ ...x, guide: e.target.value }))} />
      </label>
      <label className="adm-field">
        <span className="adm-label">En az bakiye yükleme ($)</span>
        <input className="adm-input" type="number" min={1} value={form.min_topup_usd} onChange={(e) => setForm((x) => ({ ...x, min_topup_usd: e.target.value }))} />
      </label>
      <div className="adm-form-actions"><button className="adm-btn adm-btn-primary" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
    </form>
  );
};

const AdminResellers = ({ me, products, kind = 'reseller' }) => {
  const isMedia = kind === 'media';
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [balanceFor, setBalanceFor] = useState(null);
  const [open, setOpen] = useState(null);
  const today = istanbulDay();

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'resellers'), orderBy('created_at', 'desc')),
        (s) => setList(s.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((r) => (isMedia ? r.role === 'media' || r.role === 'both' : r.role !== 'media'))),
        (err) => toast.error('Bayiler okunamadı: ' + err.code),
      ),
    [isMedia],
  );

  const totalBal = (list || []).reduce((s, r) => s + (r.balance_usd || 0), 0);
  const pending = (list || []).filter((r) => r.status === 'pending');
  const decide = async (r, status) => {
    try {
      await api('admin-save', payloadFrom(r, { status }));
      toast.success(status === 'active' ? `${r.display_name} onaylandı` : `${r.display_name} reddedildi`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="adm-stack">
      {pending.length > 0 && (
        <section className="adm-card">
          <div className="adm-card-head adm-card-pad">
            <div>
              <h2 className="adm-card-title">Bekleyen başvurular ({pending.length})</h2>
              <p className="adm-muted">{isMedia ? 'Onaylarsan medya paneli açılır. Onaydan önce “Düzenle”den haftalık key hakkını ve ürünleri seç.' : 'Onaylarsan bayi paneli açılır.'}</p>
            </div>
          </div>
          <ul className="adm-ann-list adm-hwid-list">
            {pending.map((r) => (
              <li key={r.uid}>
                <div className="adm-hwid-main">
                  <div className="adm-hwid-top">
                    <span className="adm-pill adm-pill-info">{ROLE[r.role] || 'Bayi'}</span>
                    <strong>{r.display_name}</strong>
                    <span className="adm-muted">{r.email} · Discord: {r.application?.discord || '—'}</span>
                  </div>
                  {r.application?.channel_url && <a href={r.application.channel_url} target="_blank" rel="noopener noreferrer">{r.application.channel_url}</a>}
                  {r.application?.about && <p className="adm-muted">{r.application.about}</p>}
                </div>
                <div className="adm-ann-actions">
                  <button className="adm-btn adm-btn-ghost" onClick={() => setEditing(r)}><Pencil size={14} /> Düzenle</button>
                  <button className="adm-btn adm-btn-primary" onClick={() => decide(r, 'active')}>Onayla</button>
                  <button className="adm-btn adm-btn-ghost" onClick={() => decide(r, 'rejected')}>Reddet</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="adm-card">
        <div className="adm-card-head adm-card-pad">
          <div>
            <h2 className="adm-card-title">{isMedia ? 'Medya hesapları' : 'Bayiler'}</h2>
            <p className="adm-muted">{!list ? 'Yükleniyor…' : isMedia ? `${list.length} medya hesabı` : `${list.length} bayi · toplam bakiye ${usd(totalBal)}`}</p>
          </div>
          <button className="adm-btn adm-btn-primary" onClick={() => setEditing(isMedia ? { role: 'media', status: 'active', media: { enabled: true, weekly_limit: 3, allowed: [] } } : {})}><Plus size={15} /> {isMedia ? 'Yeni medya hesabı' : 'Yeni bayi'}</button>
        </div>
        {list && !list.length && <p className="adm-muted adm-card-pad">{isMedia ? 'Henüz medya hesabı yok.' : 'Henüz bayi yok.'}</p>}
        {isMedia && list?.length > 0 && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Hesap</th><th>Durum</th><th>Bu hafta</th><th>Ürün / plan</th><th>Kanal</th><th /></tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const used = r.media_usage?.week === weekStart() ? r.media_usage.count || 0 : 0;
                  return (
                    <tr key={r.uid}>
                      <td><strong>{r.display_name}</strong>{r.role === 'both' && <> <span className="adm-pill adm-pill-info">+ Bayi</span></>}<br /><small className="adm-muted">{r.email} · {r.application?.discord || '—'}</small></td>
                      <td><span className={`adm-pill adm-pill-${STATUS[r.status]?.[1] || 'muted'}`}>{STATUS[r.status]?.[0] || r.status}</span></td>
                      <td>{used} / {r.media?.weekly_limit || 0}</td>
                      <td>{r.media?.allowed?.length || 0}</td>
                      <td>{r.application?.channel_url ? <a href={r.application.channel_url} target="_blank" rel="noopener noreferrer">Kanal ↗</a> : '—'}</td>
                      <td className="adm-nowrap"><button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing(r)}><Pencil size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isMedia && list?.length > 0 && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Bayi</th><th>Durum</th><th>Bakiye</th><th>Bugün</th><th>Bu ay</th><th>İndirim</th><th>Toplam</th><th /></tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const u = r.usage || {};
                  const day = u.day === today ? u.day_count || 0 : 0;
                  const month = u.month === today.slice(0, 7) ? u.month_count || 0 : 0;
                  return (
                    <React.Fragment key={r.uid}>
                      <tr className="adm-row-click" onClick={() => setOpen(open === r.uid ? null : r.uid)}>
                        <td><strong>{r.display_name}</strong>{r.self_signup && <> <span className="adm-pill adm-pill-muted">kendi açtı</span></>}{r.is_test && <> <span className="adm-pill adm-pill-info">TEST</span></>}<br /><small className="adm-muted">{r.email}</small></td>
                        <td><span className={`adm-pill adm-pill-${STATUS[r.status]?.[1] || 'muted'}`}>{STATUS[r.status]?.[0] || r.status}</span>{r.role && r.role !== 'reseller' && <> <span className="adm-pill adm-pill-info">{ROLE[r.role]}</span></>}</td>
                        <td><strong>{usd(r.balance_usd)}</strong></td>
                        <td>{day}{r.daily_limit ? ` / ${r.daily_limit}` : ' / ∞'}</td>
                        <td>{month}{r.monthly_limit ? ` / ${r.monthly_limit}` : ' / ∞'}</td>
                        <td>%{r.discount_pct || 0}</td>
                        <td>{r.total_keys || 0} key · {usd(r.total_spent_usd)}</td>
                        <td className="adm-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button className="adm-icon-btn" title="Bakiye" onClick={() => setBalanceFor(r)}><Wallet size={14} /></button>{' '}
                          <button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                        </td>
                      </tr>
                      {open === r.uid && (
                        <tr><td colSpan={8}><ResellerDetail reseller={r} /></td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {!isMedia && <p className="adm-muted adm-help">
        Bayi key çıkarınca keyler Ürünler → Key stoğu’ndan düşer (stok bayi ve müşteriler için ortaktır). Bayi fiyatlarını ürün düzenleme ekranındaki planlarda “Bayi $” alanından gir.
      </p>}
      <ResellerSettings me={me} kind={kind} />
      {editing && <ResellerForm initial={editing.uid || editing.role ? editing : null} products={products} onClose={() => setEditing(null)} />}
      {balanceFor && <BalanceForm reseller={balanceFor} onClose={() => setBalanceFor(null)} />}
    </div>
  );
};

export default AdminResellers;
