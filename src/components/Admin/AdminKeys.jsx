// Admin → Key stoğu: plan bazında stok, key ekleme, bayi siparişleri (stok yokken) ve verilen keyler.
import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { KeyRound, PackageCheck, Undo2 } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { getPlans, sortCategories, toDate } from '../../lib/db';
import { KeyStockDrawer } from './Fulfillment';
import { useKeyCounts } from './useKeyCounts';

const api = async (action, body) => {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(`/api/reseller?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || `İstek başarısız (${r.status})`);
  return d;
};
const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const fmt = (v) => toDate(v)?.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) || '—';

const ResellerOrders = () => {
  const [list, setList] = useState(null);
  const [texts, setTexts] = useState({});
  const [busy, setBusy] = useState(null);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'reseller_orders'), where('status', '==', 'pending'), orderBy('created_at', 'desc'), limit(100)),
        (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
          console.error(err);
          setList([]);
        },
      ),
    [],
  );

  const fulfill = async (o) => {
    setBusy(o.id);
    try {
      await api('admin-fulfill', { order_id: o.id, keys: texts[o.id] || '' });
      toast.success('Keyler bayiye teslim edildi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };
  const cancel = async (o) => {
    const reason = prompt(`${o.reseller_name} siparişi iptal edilsin ve ${usd(o.cost_usd)} iade edilsin mi? İstersen sebep yaz:`, '');
    if (reason === null) return;
    setBusy(o.id);
    try {
      await api('admin-cancel-order', { order_id: o.id, reason });
      toast.success('İptal edildi, bakiye iade edildi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="adm-card">
      <div className="adm-card-head adm-card-pad">
        <div>
          <h2 className="adm-card-title">Bayi siparişleri — teslim bekleyen {list ? `(${list.length})` : ''}</h2>
          <p className="adm-muted">Bayi, stok yetmediğinde sipariş verebilir; bakiyesi düşer. Keyleri buraya (her satıra bir tane) yapıştırıp teslim et ya da iptal edip parayı iade et.</p>
        </div>
      </div>
      {list === null ? (
        <p className="adm-muted adm-card-pad">Yükleniyor…</p>
      ) : !list.length ? (
        <p className="adm-muted adm-card-pad">Bekleyen bayi siparişi yok.</p>
      ) : (
        <ul className="adm-ann-list adm-hwid-list">
          {list.map((o) => {
            const n = (texts[o.id] || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).length;
            return (
              <li key={o.id}>
                <div className="adm-hwid-main">
                  <div className="adm-hwid-top">
                    <span className="adm-pill adm-pill-warn">Bekliyor</span>
                    <strong>{o.reseller_name}</strong>
                    <span>{o.quantity} × {o.product_name} ({o.plan_label})</span>
                    <span className="adm-muted">ödendi {usd(o.cost_usd)} · {fmt(o.created_at)}</span>
                  </div>
                  {o.note && <p className="adm-muted">Not: {o.note}</p>}
                  <textarea className="adm-input" rows={Math.min(6, Math.max(2, o.quantity))} placeholder={`${o.quantity} key — her satıra bir tane`} value={texts[o.id] || ''} onChange={(e) => setTexts((t) => ({ ...t, [o.id]: e.target.value }))} />
                  <small className={n === o.quantity ? 'adm-ok' : 'adm-muted'}>{n} / {o.quantity} key girildi</small>
                </div>
                <div className="adm-ann-actions" style={{ flexDirection: 'column' }}>
                  <button className="adm-btn adm-btn-primary" disabled={busy === o.id || n !== o.quantity} onClick={() => fulfill(o)}><PackageCheck size={14} /> Teslim et</button>
                  <button className="adm-btn adm-btn-ghost" disabled={busy === o.id} onClick={() => cancel(o)}><Undo2 size={14} /> İptal + iade</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const IssuedKeys = () => {
  const [list, setList] = useState(null);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'reseller_keys'), orderBy('created_at', 'desc'), limit(40)),
        (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setList([]),
      ),
    [],
  );
  const [names, setNames] = useState({});
  useEffect(
    () => onSnapshot(collection(db, 'resellers'), (s) => setNames(Object.fromEntries(s.docs.map((d) => [d.id, d.get('display_name')])))),
    [],
  );
  return (
    <section className="adm-card">
      <div className="adm-card-head adm-card-pad">
        <div>
          <h2 className="adm-card-title">Bayilere verilen son keyler</h2>
          <p className="adm-muted">Stoktan otomatik çekilenler ve senin teslim ettiklerin.</p>
        </div>
      </div>
      {list === null ? (
        <p className="adm-muted adm-card-pad">Yükleniyor…</p>
      ) : !list.length ? (
        <p className="adm-muted adm-card-pad">Henüz bayiye key verilmedi.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table adm-table-compact">
            <thead><tr><th>Bayi</th><th>Ürün</th><th>Key</th><th>Fiyat</th><th>Kaynak</th><th>Tarih</th></tr></thead>
            <tbody>
              {list.map((k) => (
                <tr key={k.id}>
                  <td>{names[k.reseller_id] || '—'}</td>
                  <td>{k.product_name} · {k.plan_label}</td>
                  <td><code>{k.key.length > 12 ? `${k.key.slice(0, 5)}…${k.key.slice(-4)}` : k.key}</code></td>
                  <td>{usd(k.price_usd)}</td>
                  <td>{k.order_id ? <span className="adm-pill adm-pill-info">elle teslim</span> : <span className="adm-pill adm-pill-muted">stok</span>}</td>
                  <td className="adm-nowrap adm-muted">{fmt(k.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const AdminKeys = ({ products, categories, me }) => {
  const counts = useKeyCounts();
  const [drawer, setDrawer] = useState(null);
  const ordered = sortCategories(categories).flatMap((c) => products.filter((p) => p.category_id === c.id));
  const rest = products.filter((p) => !categories.some((c) => c.id === p.category_id));

  return (
    <div className="adm-stack">
      <ResellerOrders />
      <section className="adm-card">
        <div className="adm-card-head adm-card-pad">
          <div>
            <h2 className="adm-card-title">Key stoğu</h2>
            <p className="adm-muted">Müşteri teslimatları ve bayilerin “Key oluştur”u bu stoktan çeker. Stok biterse bayi sipariş verir, yukarıda görünür.</p>
          </div>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Ürün</th><th>Planlar (stokta)</th><th>Toplam</th><th /></tr></thead>
            <tbody>
              {[...ordered, ...rest].map((p) => {
                const c = counts[p.id] || {};
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong>{p.test_only && <> <span className="adm-pill adm-pill-info">TEST</span></>}</td>
                    <td>
                      <div className="adm-stock-plans">
                        {getPlans(p).map((pl) => {
                          const n = c[pl.id] || 0;
                          return <span key={pl.id} className={`adm-pill adm-pill-${n === 0 ? 'bad' : n < 5 ? 'warn' : 'ok'}`}>{pl.label}: {n}</span>;
                        })}
                      </div>
                    </td>
                    <td><strong>{c._total || 0}</strong></td>
                    <td className="adm-nowrap"><button className="adm-btn adm-btn-ghost" onClick={() => setDrawer(p)}><KeyRound size={14} /> Key ekle / yönet</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <IssuedKeys />
      {drawer && <KeyStockDrawer product={drawer} me={me} onClose={() => setDrawer(null)} />}
    </div>
  );
};

export default AdminKeys;

