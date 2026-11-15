// Admin → Kampanya: sitedeki kampanya alanı/şeridi (settings/campaign) ve indirim kodları (coupons/{KOD}).
import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { toDate } from '../../lib/db';
import { loggedWrite } from '../../lib/adminLog';

const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '');
const fromLocal = (v) => (v ? new Date(v).toISOString() : '');
const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);

const EMPTY = { active: false, show_bar: true, show_hero: true, badge: 'BLACK WEEK', badge_en: '', title1: 'BLACK', title2: 'WEEK', subtitle: 'tüm ürünlerde', subtitle_en: 'on everything in the store', percent: 30, code: 'BLACKWEEK', date_label: '', starts_at: '', ends_at: '' };

const upsertCoupon = async (me, code, data, existing) => {
  const payload = { code, percent: Math.min(90, Math.max(1, Number(data.percent) || 0)), active: data.active !== false, max_uses: Math.max(0, parseInt(data.max_uses, 10) || 0), note: String(data.note || '').slice(0, 120), ends_at: data.ends_at ? Timestamp.fromDate(new Date(data.ends_at)) : null, updated_at: serverTimestamp() };
  await loggedWrite({
    me, mode: existing ? 'update' : 'set', collectionName: 'coupons', id: code, targetType: 'coupon', action: existing ? 'update' : 'create',
    data: existing ? payload : { ...payload, uses: 0, created_at: serverTimestamp() },
    summary: `İndirim kodu ${existing ? 'güncellendi' : 'eklendi'}: ${code} (%${payload.percent}${payload.ends_at ? `, bitiş ${new Date(data.ends_at).toLocaleString('tr-TR')}` : ''})`,
  });
};

const CouponForm = ({ me, initial, onClose }) => {
  const [f, setF] = useState({ code: initial?.code || '', percent: initial?.percent ?? 10, active: initial?.active !== false, max_uses: initial?.max_uses || 0, note: initial?.note || '', ends_at: initial?.ends_at ? toDate(initial.ends_at).toISOString() : '' });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    const code = cleanCode(f.code);
    if (code.length < 3) return toast.error('Kod en az 3 karakter olmalı.');
    setBusy(true);
    try {
      await upsertCoupon(me, code, f, !!initial?.code);
      toast.success('Kod kaydedildi');
      onClose();
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <form className="adm-drawer adm-drawer-sm" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <header className="adm-drawer-head">
          <h2>{initial?.code ? `Kod: ${initial.code}` : 'Yeni indirim kodu'}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </header>
        <div className="adm-drawer-body">
          <label className="adm-field"><span className="adm-label">Kod</span><input className="adm-input" value={f.code} disabled={!!initial?.code} onChange={(e) => setF((x) => ({ ...x, code: cleanCode(e.target.value) }))} placeholder="BLACKWEEK" required /></label>
          <div className="adm-grid-2">
            <label className="adm-field"><span className="adm-label">İndirim (%)</span><input className="adm-input" type="number" min={1} max={90} value={f.percent} onChange={(e) => setF((x) => ({ ...x, percent: e.target.value }))} /></label>
            <label className="adm-field"><span className="adm-label">Kullanım sınırı (0 = sınırsız)</span><input className="adm-input" type="number" min={0} value={f.max_uses} onChange={(e) => setF((x) => ({ ...x, max_uses: e.target.value }))} /></label>
          </div>
          <label className="adm-field"><span className="adm-label">Bitiş (boş = süresiz)</span><input className="adm-input" type="datetime-local" value={toLocal(f.ends_at)} onChange={(e) => setF((x) => ({ ...x, ends_at: fromLocal(e.target.value) }))} /></label>
          <label className="adm-field"><span className="adm-label">Not</span><input className="adm-input" value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} placeholder="ör. YouTuber X'e özel" /></label>
          <label className="adm-switch"><input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} /><span className="adm-switch-track"><span /></span>Aktif</label>
        </div>
        <footer className="adm-drawer-foot">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>Vazgeç</button>
          <button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </footer>
      </form>
    </div>
  );
};

const AdminCampaign = ({ me }) => {
  const [c, setC] = useState(null);
  const [saving, setSaving] = useState(false);
  const [coupons, setCoupons] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'campaign')).then((s) => setC({ ...EMPTY, ...(s.exists() ? s.data() : {}) }));
    return onSnapshot(collection(db, 'coupons'), (s) => setCoupons(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setCoupons([]));
  }, []);

  if (!c) return <p className="adm-muted">Yükleniyor…</p>;
  const set = (k) => (e) => setC((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { last_log_id: _l, updated_at: _u, ...rest } = c;
      const data = { ...rest, code: cleanCode(c.code), percent: Math.min(90, Math.max(1, Number(c.percent) || 0)), updated_at: serverTimestamp() };
      await loggedWrite({ me, mode: 'set', collectionName: 'settings', id: 'campaign', targetType: 'settings', action: 'update', data, summary: `Kampanya ${data.active ? 'yayında' : 'kapalı'}: ${data.title1} ${data.title2} (%${data.percent}, kod ${data.code || '—'})` });
      // Kampanya kodu indirim kodu olarak da geçerli olsun
      if (data.code) {
        const existing = coupons?.some((x) => x.id === data.code);
        await upsertCoupon(me, data.code, { percent: data.percent, active: data.active, ends_at: data.ends_at, note: 'Kampanya kodu', max_uses: coupons?.find((x) => x.id === data.code)?.max_uses || 0 }, existing);
      }
      toast.success('Kampanya kaydedildi');
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cp) => {
    if (!confirm(`${cp.id} kodu silinsin mi?`)) return;
    try {
      await loggedWrite({ me, mode: 'delete', collectionName: 'coupons', id: cp.id, current: cp, targetType: 'coupon', summary: `İndirim kodu silindi: ${cp.id}` });
    } catch (err) {
      toast.error(err.code || err.message);
    }
  };

  return (
    <div className="adm-stack">
      <form className="adm-card adm-card-pad" onSubmit={save}>
        <h2 className="adm-card-title">Kampanya alanı</h2>
        <p className="adm-muted adm-help">Ana sayfanın en üstünde büyük kampanya alanı ve tüm sayfalarda üstte ince şerit olarak görünür. Bitiş tarihi geçince kendiliğinden kalkar.</p>
        <div className="adm-camp-switches">
          <label className="adm-switch"><input type="checkbox" checked={!!c.active} onChange={set('active')} /><span className="adm-switch-track"><span /></span>Yayında</label>
          <label className="adm-switch"><input type="checkbox" checked={c.show_hero !== false} onChange={set('show_hero')} /><span className="adm-switch-track"><span /></span>Ana sayfa alanı</label>
          <label className="adm-switch"><input type="checkbox" checked={c.show_bar !== false} onChange={set('show_bar')} /><span className="adm-switch-track"><span /></span>Üst şerit</label>
        </div>
        <div className="adm-grid-2">
          <label className="adm-field"><span className="adm-label">Başlık 1. satır (gümüş)</span><input className="adm-input" value={c.title1} onChange={set('title1')} placeholder="BLACK" /></label>
          <label className="adm-field"><span className="adm-label">Başlık 2. satır (kırmızı)</span><input className="adm-input" value={c.title2} onChange={set('title2')} placeholder="WEEK" /></label>
        </div>
        <div className="adm-grid-2">
          <label className="adm-field"><span className="adm-label">Rozet</span><input className="adm-input" value={c.badge} onChange={set('badge')} placeholder="BLACK WEEK" /></label>
          <label className="adm-field"><span className="adm-label">Tarih etiketi (opsiyonel)</span><input className="adm-input" value={c.date_label} onChange={set('date_label')} placeholder="10 – 17 Kasım" /></label>
        </div>
        <div className="adm-grid-2">
          <label className="adm-field"><span className="adm-label">İndirim (%)</span><input className="adm-input" type="number" min={1} max={90} value={c.percent} onChange={set('percent')} /></label>
          <label className="adm-field"><span className="adm-label">İndirim kodu</span><input className="adm-input" value={c.code} onChange={(e) => setC((x) => ({ ...x, code: cleanCode(e.target.value) }))} placeholder="BLACKWEEK" /></label>
        </div>
        <div className="adm-grid-2">
          <label className="adm-field"><span className="adm-label">Alt yazı (TR)</span><input className="adm-input" value={c.subtitle} onChange={set('subtitle')} /></label>
          <label className="adm-field"><span className="adm-label">Alt yazı (EN)</span><input className="adm-input" value={c.subtitle_en} onChange={set('subtitle_en')} /></label>
        </div>
        <div className="adm-grid-2">
          <label className="adm-field"><span className="adm-label">Başlangıç</span><input className="adm-input" type="datetime-local" value={toLocal(c.starts_at)} onChange={(e) => setC((x) => ({ ...x, starts_at: fromLocal(e.target.value) }))} /></label>
          <label className="adm-field"><span className="adm-label">Bitiş (geri sayım)</span><input className="adm-input" type="datetime-local" value={toLocal(c.ends_at)} onChange={(e) => setC((x) => ({ ...x, ends_at: fromLocal(e.target.value) }))} /></label>
        </div>
        <p className="adm-muted adm-help">Kaydedince bu kod indirim kodu olarak da oluşturulur/güncellenir; müşteri ödeme ekranında tek tıkla uygulayabilir. Kartla ödemede indirimi sunucu uygular.</p>
        <div className="adm-form-actions"><button className="adm-btn adm-btn-primary" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
      </form>

      <section className="adm-card">
        <div className="adm-card-head adm-card-pad">
          <div>
            <h2 className="adm-card-title">İndirim kodları</h2>
            <p className="adm-muted">Kampanya dışında YouTuber/medya için özel kodlar da açabilirsin.</p>
          </div>
          <button className="adm-btn adm-btn-primary" onClick={() => setEditing({})}><Plus size={15} /> Yeni kod</button>
        </div>
        {coupons === null ? (
          <p className="adm-muted adm-card-pad">Yükleniyor…</p>
        ) : !coupons.length ? (
          <p className="adm-muted adm-card-pad">Henüz kod yok.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Kod</th><th>İndirim</th><th>Kullanım</th><th>Bitiş</th><th>Durum</th><th /></tr></thead>
              <tbody>
                {coupons.map((cp) => {
                  const ended = cp.ends_at && toDate(cp.ends_at) < new Date();
                  return (
                    <tr key={cp.id}>
                      <td><code>{cp.id}</code>{cp.note && <><br /><small className="adm-muted">{cp.note}</small></>}</td>
                      <td>%{cp.percent}</td>
                      <td>{cp.uses || 0}{cp.max_uses ? ` / ${cp.max_uses}` : ''}</td>
                      <td className="adm-nowrap">{cp.ends_at ? toDate(cp.ends_at).toLocaleString('tr-TR') : 'süresiz'}</td>
                      <td><span className={`adm-pill adm-pill-${cp.active === false || ended ? 'muted' : 'ok'}`}>{cp.active === false ? 'Kapalı' : ended ? 'Süresi doldu' : 'Aktif'}</span></td>
                      <td className="adm-nowrap">
                        <button className="adm-icon-btn" onClick={() => setEditing({ ...cp, code: cp.id })} aria-label="Düzenle"><Pencil size={14} /></button>{' '}
                        <button className="adm-icon-btn danger" onClick={() => remove(cp)} aria-label="Sil"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && <CouponForm me={me} initial={editing.code ? editing : null} onClose={() => setEditing(null)} />}
    </div>
  );
};

export default AdminCampaign;
