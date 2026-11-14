// Admin → Durum: ürünlerin tespit durumunu tek ekrandan değiştir (sitedeki Durum sayfası buradan beslenir).
import React, { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { loggedWrite } from '../../lib/adminLog';
import { statusHistory, fmtUptime, STATUS_TONE } from '../../lib/status';
import { sortCategories, toDate } from '../../lib/db';

const OPTIONS = [
  ['undetected', 'Undetected · Online'],
  ['testing', 'Test ediliyor'],
  ['updating', 'Güncelleniyor (bakımda)'],
  ['detected', 'Detected · Kapalı'],
];
const LABEL = Object.fromEntries(OPTIONS);

const AdminStatus = ({ products, categories, me }) => {
  const [busy, setBusy] = useState(null);

  const change = async (p, status) => {
    const prev = p.status || 'undetected';
    if (prev === status) return;
    setBusy(p.id);
    try {
      const log = Array.isArray(p.status_log) ? p.status_log : [];
      await loggedWrite({
        me, mode: 'update', collectionName: 'products', id: p.id, targetType: 'product', action: 'status',
        data: { status, status_log: [...log, { from: prev, to: status, at: new Date().toISOString() }].slice(-80), updated_at: serverTimestamp() },
        summary: `Ürün "${p.name}" durumu: ${LABEL[prev]} → ${LABEL[status]}`,
      });
      toast.success(`${p.name}: ${LABEL[status]}`);
    } catch (err) {
      toast.error('Kaydedilemedi: ' + (err.code || err.message));
    } finally {
      setBusy(null);
    }
  };

  const setAll = async (status) => {
    if (!confirm(`Tüm ürünler "${LABEL[status]}" yapılsın mı?`)) return;
    for (const p of products) if ((p.status || 'undetected') !== status && !p.test_only) await change(p, status);
  };

  const groups = sortCategories(categories)
    .map((c) => ({ c, items: products.filter((p) => p.category_id === c.id && !p.test_only) }))
    .filter((g) => g.items.length);

  return (
    <section className="adm-card">
      <div className="adm-card-head adm-card-pad">
        <div>
          <h2 className="adm-card-title">Ürün durumları</h2>
          <p className="adm-muted">Burada seçtiğin durum sitedeki Durum sayfasında, ürün kartlarında ve bayi panelinde görünür; her değişiklik 30 günlük geçmişe yazılır.</p>
        </div>
        <div className="adm-form-actions" style={{ margin: 0 }}>
          <button className="adm-btn adm-btn-ghost" onClick={() => setAll('undetected')}>Hepsi Undetected</button>
          <button className="adm-btn adm-btn-ghost" onClick={() => setAll('updating')}>Hepsi bakımda</button>
        </div>
      </div>
      {groups.map(({ c, items }) => (
        <div key={c.id} className="adm-status-group">
          <h3>{c.name}</h3>
          {items.map((p) => {
            const h = statusHistory(p);
            const s = p.status || 'undetected';
            return (
              <div key={p.id} className="adm-status-row">
                <img src={p.image_url || '/logo.webp'} alt="" />
                <div className="adm-status-info">
                  <strong>{p.name}</strong>
                  <span className="adm-muted">
                    30 gün: {fmtUptime(h.uptime)} · son değişiklik {h.lastChange ? h.lastChange.toLocaleString('tr-TR') : toDate(p.created_at)?.toLocaleDateString('tr-TR') || '—'}
                  </span>
                  <div className="adm-status-bars">
                    {h.bars.map((b, i) => <i key={i} className={`st-${STATUS_TONE[b.status]}`} title={`${b.date.toLocaleDateString('tr-TR')} · ${LABEL[b.status] || 'veri yok'}`} />)}
                  </div>
                </div>
                <div className="adm-status-pick">
                  {OPTIONS.map(([v, l]) => (
                    <button key={v} className={`adm-st-btn st-${STATUS_TONE[v]} ${s === v ? 'on' : ''}`} disabled={busy === p.id} onClick={() => change(p, v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
};

export default AdminStatus;
