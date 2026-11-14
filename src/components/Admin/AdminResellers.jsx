// Admin → Bayiler: bayi ekle/düzenle, limitler, indirim, bakiye düzeltme, bayi kuralları/rehberi.
import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Plus, Pencil, Wallet, X, KeyRound, ArrowLeftRight } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { toDate } from '../../lib/db';
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

const ResellerForm = ({ initial, onClose }) => {
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
  });
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
                <option value="suspended">Askıda (key çıkaramaz)</option>
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

const ResellerSettings = ({ me }) => {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getDoc(doc(db, 'settings', 'reseller')).then((s) => {
      const d = s.exists() ? s.data() : {};
      setForm({ rules: d.rules || '', guide: d.guide || '', min_topup_usd: d.min_topup_usd ?? 5 });
    });
  }, []);
  if (!form) return null;
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await loggedWrite({ me, mode: 'set', collectionName: 'settings', id: 'reseller', targetType: 'settings', action: 'update', data: { rules: form.rules, guide: form.guide, min_topup_usd: Math.max(1, Number(form.min_topup_usd) || 5), updated_at: serverTimestamp() }, summary: 'Bayi kuralları / rehberi güncellendi' });
      toast.success('Kaydedildi');
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="adm-card adm-card-pad" onSubmit={save}>
      <h2 className="adm-card-title">Bayi paneli metinleri</h2>
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

const AdminResellers = ({ me }) => {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [balanceFor, setBalanceFor] = useState(null);
  const [open, setOpen] = useState(null);
  const today = istanbulDay();

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'resellers'), orderBy('created_at', 'desc')),
        (s) => setList(s.docs.map((d) => ({ uid: d.id, ...d.data() }))),
        (err) => toast.error('Bayiler okunamadı: ' + err.code),
      ),
    [],
  );

  const totalBal = (list || []).reduce((s, r) => s + (r.balance_usd || 0), 0);

  return (
    <div className="adm-stack">
      <section className="adm-card">
        <div className="adm-card-head adm-card-pad">
          <div>
            <h2 className="adm-card-title">Bayiler</h2>
            <p className="adm-muted">{list ? `${list.length} bayi · toplam bakiye ${usd(totalBal)}` : 'Yükleniyor…'}</p>
          </div>
          <button className="adm-btn adm-btn-primary" onClick={() => setEditing({})}><Plus size={15} /> Yeni bayi</button>
        </div>
        {list && !list.length && <p className="adm-muted adm-card-pad">Henüz bayi yok.</p>}
        {list?.length > 0 && (
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
                        <td><strong>{r.display_name}</strong><br /><small className="adm-muted">{r.email}</small></td>
                        <td><span className={`adm-pill adm-pill-${r.status === 'active' ? 'ok' : 'bad'}`}>{r.status === 'active' ? 'Aktif' : 'Askıda'}</span></td>
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
      <p className="adm-muted adm-help">
        Bayi key çıkarınca keyler Ürünler → Key stoğu’ndan düşer (stok bayi ve müşteriler için ortaktır). Bayi fiyatlarını ürün düzenleme ekranındaki planlarda “Bayi $” alanından gir.
      </p>
      <ResellerSettings me={me} />
      {editing && <ResellerForm initial={editing.uid ? editing : null} onClose={() => setEditing(null)} />}
      {balanceFor && <BalanceForm reseller={balanceFor} onClose={() => setBalanceFor(null)} />}
    </div>
  );
};

export default AdminResellers;
