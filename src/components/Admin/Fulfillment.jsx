// Key stoğu ve sipariş teslimatı (yönetici paneli).
// - license_keys: { product_id, plan_id, key, status: available|used|removed, order_id, created_at, added_by, last_log_id }
// - Teslimat sipariş belgesine yazılır: order.delivery = { items: [{ product_id, plan_id, name, durationLabel, keys[], link, note }], delivered_at, delivered_by }
import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { X, KeyRound, Plus, Eye, EyeOff, PackageCheck, Wand2, Link2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db } from '../../lib/firebase';
import { getPlans } from '../../lib/db';
import { loggedBatch } from '../../lib/adminLog';

/** "mega.nz/..." gibi şemasız linklere https:// ekler. */
const normalizeLink = (v) => {
  const s = String(v || '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
};

const mask = (k) => (k.length <= 8 ? '••••••' : `${k.slice(0, 4)}••••${k.slice(-4)}`);

/* ------------------------------------------------------------------ */
/* Ürün key stoğu                                                      */
/* ------------------------------------------------------------------ */
export const KeyStockDrawer = ({ product, me, onClose }) => {
  const plans = getPlans(product);
  const [keys, setKeys] = useState([]);
  const [planId, setPlanId] = useState(plans[0]?.id || '');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState({});
  const [showUsed, setShowUsed] = useState(false);

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'license_keys'), where('product_id', '==', product.id)), (snap) =>
        setKeys(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)))
      ),
    [product.id]
  );

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const planLabel = (id) => plans.find((p) => p.id === id)?.label || id;
  const lines = [...new Set(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
  const existing = new Set(keys.filter((k) => k.status !== 'removed').map((k) => k.key));
  const dupes = lines.filter((l) => existing.has(l));

  const add = async () => {
    const fresh = lines.filter((l) => !existing.has(l));
    if (!planId) return toast.error('Plan seç.');
    if (!fresh.length) return toast.error(dupes.length ? 'Bu keylerin hepsi zaten stokta.' : 'En az bir key gir (her satıra bir tane).');
    if (fresh.length > 400) return toast.error('Tek seferde en fazla 400 key eklenebilir.');
    setSaving(true);
    try {
      await loggedBatch({
        me,
        action: 'create',
        targetType: 'key',
        targetId: product.id,
        summary: `${fresh.length} key eklendi — ${product.name} (${planLabel(planId)})`,
        ops: (batch, logId) => {
          fresh.forEach((key) =>
            batch.set(doc(collection(db, 'license_keys')), {
              product_id: product.id,
              plan_id: planId,
              key,
              status: 'available',
              order_id: null,
              added_by: me.nickname,
              created_at: serverTimestamp(),
              last_log_id: logId,
            })
          );
        },
      });
      toast.success(`${fresh.length} key eklendi${dupes.length ? ` (${dupes.length} tekrar atlandı)` : ''}`);
      setText('');
    } catch (err) {
      toast.error('Eklenemedi: ' + (err.code || err.message));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (k) => {
    if (!confirm('Bu key stoktan kaldırılsın mı?')) return;
    try {
      await loggedBatch({
        me,
        action: 'delete',
        targetType: 'key',
        targetId: k.id,
        summary: `Key stoktan kaldırıldı — ${product.name} (${planLabel(k.plan_id)}) ${mask(k.key)}`,
        ops: (batch, logId) => batch.update(doc(db, 'license_keys', k.id), { status: 'removed', last_log_id: logId }),
      });
    } catch (err) {
      toast.error('Kaldırılamadı: ' + (err.code || err.message));
    }
  };

  const shown = keys.filter((k) => (showUsed ? k.status !== 'removed' : k.status === 'available'));
  const availableByPlan = (id) => keys.filter((k) => k.plan_id === id && k.status === 'available').length;

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <div className="adm-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="adm-drawer-head">
          <h2><KeyRound size={18} /> Key stoğu — {product.name}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </header>
        <div className="adm-drawer-body">
          <div className="adm-key-plans">
            {plans.map((p) => (
              <div key={p.id} className={`adm-key-plan ${availableByPlan(p.id) ? '' : 'empty'}`}>
                <span>{p.label}</span>
                <strong>{availableByPlan(p.id)}</strong>
                <small>stokta</small>
              </div>
            ))}
          </div>

          <div className="adm-field">
            <span className="adm-label">Key ekle</span>
            <select className="adm-input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <label className="adm-field">
            <span className="adm-label">Keyler — her satıra bir key ({lines.length} key{dupes.length ? `, ${dupes.length} tanesi zaten var` : ''})</span>
            <textarea className="adm-input adm-mono" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY'} />
          </label>
          <div className="adm-form-actions">
            <button className="adm-btn adm-btn-primary" onClick={add} disabled={saving || !lines.length}>
              <Plus size={16} /> {saving ? 'Ekleniyor…' : 'Stoğa ekle'}
            </button>
          </div>

          <div className="adm-key-list-head">
            <span className="adm-label">{showUsed ? 'Tüm keyler' : 'Stoktaki keyler'} ({shown.length})</span>
            <label className="adm-switch adm-switch-sm">
              <input type="checkbox" checked={showUsed} onChange={(e) => setShowUsed(e.target.checked)} />
              <span className="adm-switch-track"><span /></span>
              Kullanılanları da göster
            </label>
          </div>
          <div className="adm-key-list">
            {shown.map((k) => (
              <div key={k.id} className={`adm-key-row ${k.status}`}>
                <code>{revealed[k.id] ? k.key : mask(k.key)}</code>
                <span className="adm-muted">{planLabel(k.plan_id)}</span>
                {k.status === 'used' ? (
                  <span className="adm-pill adm-pill-muted">#{(k.order_id || '').slice(-6)}</span>
                ) : (
                  <span className="adm-pill adm-pill-ok">stokta</span>
                )}
                <button className="adm-icon-btn" onClick={() => setRevealed((r) => ({ ...r, [k.id]: !r[k.id] }))} aria-label="Göster/gizle">
                  {revealed[k.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {k.status === 'available' && (
                  <button className="adm-icon-btn danger" onClick={() => remove(k)} aria-label="Kaldır"><X size={14} /></button>
                )}
              </div>
            ))}
            {!shown.length && <p className="adm-muted">Stokta key yok.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sipariş teslimatı                                                   */
/* ------------------------------------------------------------------ */
const initialDelivery = (order) => {
  const prev = order.delivery?.items || [];
  return (order.items || []).map((it, idx) => {
    const p = prev[idx] || {};
    return {
      product_id: it.product_id,
      plan_id: it.plan_id || '',
      name: it.name,
      durationLabel: it.durationLabel || '',
      quantity: it.quantity || 1,
      keysText: (p.keys || []).join('\n'),
      link: p.link || '',
      note: p.note || '',
      stockIds: {}, // key metni -> license_keys doc id (stoktan seçilenler)
    };
  });
};

export const DeliveryPanel = ({ order, me }) => {
  const [rows, setRows] = useState(() => initialDelivery(order));
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(null);
  const delivered = !!order.delivery?.delivered_at;
  const canDeliver = ['paid', 'Completed'].includes(order.status);

  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const rowKeys = (r) => r.keysText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const fillFromStock = (i) => {
    const r = rows[i];
    const need = Math.max(0, r.quantity - rowKeys(r).length);
    if (!need) return toast('Bu kalem için yeterli key girilmiş.');
    setFilling(i);
    const q = query(collection(db, 'license_keys'), where('product_id', '==', r.product_id), where('status', '==', 'available'));
    getDocs(q)
      .then((snap) => {
        const taken = new Set(rows.flatMap((x) => Object.values(x.stockIds)));
        const pick = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((k) => (!r.plan_id || k.plan_id === r.plan_id) && !taken.has(k.id))
          .slice(0, need);
        if (!pick.length) {
          toast.error('Bu ürün/plan için stokta key yok — elle gir.');
          return;
        }
        const keys = [...rowKeys(r), ...pick.map((k) => k.key)];
        const stockIds = { ...r.stockIds };
        pick.forEach((k) => { stockIds[k.key] = k.id; });
        setRow(i, { keysText: keys.join('\n'), stockIds });
        if (pick.length < need) toast(`Stokta sadece ${pick.length} key vardı.`);
      })
      .catch((err) => toast.error('Stok okunamadı: ' + err.code))
      .finally(() => setFilling(null));
  };

  const deliver = async () => {
    const items = rows.map((r) => ({
      product_id: r.product_id,
      plan_id: r.plan_id,
      name: r.name,
      durationLabel: r.durationLabel,
      keys: rowKeys(r),
      link: normalizeLink(r.link),
      note: r.note.trim(),
    }));
    if (!items.some((it) => it.keys.length || it.link || it.note)) return toast.error('En az bir key, link ya da not gir.');
    const missing = rows.filter((r, i) => items[i].keys.length < r.quantity && !items[i].link && !items[i].note);
    if (missing.length && !confirm('Bazı kalemlerde adet kadar key yok. Yine de teslim edilsin mi?')) return;

    // Stoktan seçilen ve hâlâ metinde duran keyler
    const stockUse = rows.flatMap((r, i) => items[i].keys.filter((k) => r.stockIds[k]).map((k) => r.stockIds[k]));

    setSaving(true);
    try {
      // Seçilen stok keyleri hâlâ boşta mı?
      for (const id of stockUse) {
        const s = await getDoc(doc(db, 'license_keys', id));
        if (s.get('status') !== 'available') throw new Error('Seçilen bir key az önce başka siparişe verildi; tekrar "Stoktan doldur" de.');
      }
      const keyCount = items.reduce((n, it) => n + it.keys.length, 0);
      await loggedBatch({
        me,
        action: delivered ? 'update' : 'status',
        targetType: 'order',
        targetId: order.id,
        summary: `Sipariş #${(order.merchant_oid || order.id).slice(-6)} ${delivered ? 'teslimatı güncellendi' : 'teslim edildi'} (${order.customer_name || '—'}): ${keyCount} key${items.some((it) => it.link) ? ', link' : ''}${items.some((it) => it.note) ? ', not' : ''}${stockUse.length ? ` · ${stockUse.length} stoktan` : ''}`,
        ops: (batch, logId) => {
          batch.update(doc(db, 'orders', order.id), {
            delivery: { items, delivered_at: serverTimestamp(), delivered_by: me.nickname },
            status: 'Completed',
            last_log_id: logId,
          });
          stockUse.forEach((id) =>
            batch.update(doc(db, 'license_keys', id), { status: 'used', order_id: order.id, used_at: serverTimestamp(), last_log_id: logId })
          );
        },
      });
      setRows((rs) => rs.map((r) => ({ ...r, stockIds: {} })));
      toast.success(delivered ? 'Teslimat güncellendi' : 'Sipariş teslim edildi');
    } catch (err) {
      toast.error(err.message || err.code);
    } finally {
      setSaving(false);
    }
  };

  const totalNeeded = useMemo(() => rows.reduce((n, r) => n + r.quantity, 0), [rows]);

  if (!canDeliver) {
    return (
      <div className="adm-delivery-locked">
        <PackageCheck size={14} />{' '}
        {order.payment_method === 'shopier'
          ? 'Teslimat, Shopier ödemesi gelince açılır. Ödeme otomatik algılanır.'
          : order.status === 'Waiting for Confirmation'
            ? 'Önce havale ödemesini kontrol edip aşağıdan "Ödendi" olarak işaretle; sonra teslim edebilirsin.'
            : 'Ödemesi alınmamış sipariş teslim edilemez.'}
      </div>
    );
  }

  return (
    <div className="adm-delivery">
      <div className="adm-delivery-head">
        <span className="adm-label"><PackageCheck size={14} /> Teslimat {delivered && <em className="adm-pill adm-pill-ok">teslim edildi · {order.delivery.delivered_by}</em>}</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="adm-delivery-item">
          <div className="adm-delivery-title">
            <strong>{r.name}</strong> <span className="adm-muted">· {r.durationLabel}{r.quantity > 1 ? ` × ${r.quantity}` : ''}</span>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-xs" onClick={() => fillFromStock(i)} disabled={filling === i}>
              <Wand2 size={13} /> {filling === i ? 'Aranıyor…' : 'Stoktan doldur'}
            </button>
          </div>
          <textarea
            className="adm-input adm-mono"
            rows={Math.max(2, r.quantity)}
            placeholder={r.quantity > 1 ? `${r.quantity} key — her satıra bir tane` : 'Lisans key'}
            value={r.keysText}
            onChange={(e) => setRow(i, { keysText: e.target.value })}
          />
          <div className="adm-grid-2">
            <label className="adm-input-icon adm-input-icon-sm">
              <Link2 size={14} />
              <input placeholder="İndirme linki (opsiyonel)" value={r.link} onChange={(e) => setRow(i, { link: e.target.value })} />
            </label>
            <input className="adm-input" placeholder="Not (kurulum, şifre vb. — opsiyonel)" value={r.note} onChange={(e) => setRow(i, { note: e.target.value })} />
          </div>
        </div>
      ))}
      <div className="adm-form-actions">
        <span className="adm-muted">{rows.reduce((n, r) => n + rowKeys(r).length, 0)} / {totalNeeded} key</span>
        <button className="adm-btn adm-btn-primary" onClick={deliver} disabled={saving}>
          <PackageCheck size={16} /> {saving ? 'Kaydediliyor…' : delivered ? 'Teslimatı güncelle' : 'Teslim et'}
        </button>
      </div>
    </div>
  );
};
