// Müşteri paneli: Loader (satın alınan ürünlerin indirme linkleri) ve HWID sıfırlama talepleri.
import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Download, Cpu, Loader2, Package, CalendarClock } from 'lucide-react';
import { db } from '../../lib/firebase';
import { toDate } from '../../lib/db';
import { useShopStore } from '../../store/useShopStore';
import { useT } from '../../i18n';

const PAID = ['paid', 'Completed'];

const safeUrl = (u) => {
  const s = String(u || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? null : `https://${s}`;
};

/** Satın alınan (ödenmiş) ürünler — tekrarsız */
const ownedProducts = (orders) => {
  const map = new Map();
  for (const o of orders || []) {
    if (!PAID.includes(o.status)) continue;
    for (const i of o.items || []) if (i.product_id && !map.has(i.product_id)) map.set(i.product_id, i.name);
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }));
};

export const LoaderTab = ({ orders }) => {
  const { t } = useT();
  const storeProducts = useShopStore((s) => s.products);
  const owned = useMemo(() => ownedProducts(orders), [orders]);
  const [extra, setExtra] = useState({});

  // Mağazada artık görünmeyen ürünlerin bilgisini ayrıca çek
  useEffect(() => {
    const missing = owned.filter((o) => !storeProducts.some((p) => p.id === o.id));
    if (!missing.length) return;
    Promise.all(missing.map((m) => getDoc(doc(db, 'products', m.id)).then((s) => [m.id, s.exists() ? s.data() : null]).catch(() => [m.id, null]))).then((rows) =>
      setExtra(Object.fromEntries(rows)),
    );
  }, [owned, storeProducts]);

  return (
    <>
      <div className="ap-section-head"><div><h2>{t('acc.tabs.loader')}</h2><p>{t('acc.loaderSub')}</p></div></div>
      {orders === null ? (
        <p className="acc-muted">{t('account.loading')}</p>
      ) : !owned.length ? (
        <div className="ap-empty"><Package size={22} /><p>{t('acc.noLoader')}</p></div>
      ) : (
        <div className="ap-keys">
          {owned.map((o) => {
            const p = storeProducts.find((x) => x.id === o.id) || extra[o.id] || {};
            const url = safeUrl(p.loader_url);
            return (
              <div key={o.id} className="ap-key-card ap-loader">
                <img src={p.image_url || '/logo.webp'} alt="" />
                <div className="ap-loader-info">
                  <strong>{p.name || o.name}</strong>
                  {p.loader_note && <span>{p.loader_note}</span>}
                  {!url && <span className="acc-muted-inline">{t('acc.loaderSoon')}</span>}
                </div>
                {url && <a className="ap-btn-primary" href={url} target="_blank" rel="noopener noreferrer"><Download size={16} /> {t('acc.download')}</a>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export const HwidTab = ({ user, orders }) => {
  const { t, lang } = useT();
  const [reqs, setReqs] = useState(null);
  const [key, setKey] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'hwid_requests'), where('uid', '==', user.uid), orderBy('created_at', 'desc'), limit(50)),
        (s) => setReqs(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setReqs([]),
      ),
    [user.uid],
  );

  const keys = useMemo(
    () =>
      (orders || []).flatMap((o) =>
        (o.delivery?.items || []).flatMap((i) => (i.keys || []).map((k) => ({ key: k, product_id: i.product_id || null, product_name: i.name }))),
      ),
    [orders],
  );

  const send = async (e) => {
    e.preventDefault();
    const k = keys.find((x) => x.key === key);
    if (!k) return;
    if (reqs?.some((r) => r.key === k.key && r.status === 'pending')) return toast.error(t('acc.hwidPending'));
    setBusy(true);
    try {
      await addDoc(collection(db, 'hwid_requests'), {
        uid: user.uid,
        source: 'customer',
        key: k.key,
        product_id: k.product_id,
        product_name: k.product_name || '',
        reason: reason.trim().slice(0, 500),
        status: 'pending',
        created_at: serverTimestamp(),
      });
      toast.success(t('acc.hwidSent'));
      setKey('');
      setReason('');
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setBusy(false);
    }
  };

  const ST = { pending: ['warn', t('acc.st.pending')], approved: ['ok', t('acc.st.approved')], rejected: ['bad', t('acc.st.rejected')] };

  return (
    <>
      <div className="ap-section-head"><div><h2>{t('acc.tabs.hwid')}</h2><p>{t('acc.hwidSub')}</p></div></div>
      {orders !== null && !keys.length ? (
        <div className="ap-empty"><Cpu size={22} /><p>{t('acc.noKeys')}</p></div>
      ) : (
        <form className="ap-panel ap-hwid-form" onSubmit={send}>
          <label className="acc-label" htmlFor="hw-key">{t('acc.hwidKey')}</label>
          <select id="hw-key" className="acc-input" value={key} onChange={(e) => setKey(e.target.value)} required>
            <option value="">—</option>
            {keys.map((k) => <option key={k.key} value={k.key}>{k.product_name} · {k.key}</option>)}
          </select>
          <label className="acc-label" htmlFor="hw-reason">{t('acc.hwidReason')}</label>
          <input id="hw-reason" className="acc-input" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder={t('acc.hwidReasonPh')} />
          <button className="acc-btn acc-btn-primary" disabled={busy || !key}>{busy ? <Loader2 size={15} className="spin" /> : <Cpu size={15} />} {t('acc.hwidSend')}</button>
        </form>
      )}
      <h3 className="ap-sub-title">{t('acc.hwidMine')}</h3>
      {reqs === null ? (
        <p className="acc-muted">{t('account.loading')}</p>
      ) : !reqs.length ? (
        <p className="acc-muted">{t('acc.hwidNone')}</p>
      ) : (
        <div className="acc-orders">
          {reqs.map((r) => (
            <article key={r.id} className="acc-order">
              <div className="acc-order-top">
                <code>{r.product_name}</code>
                <span className={`acc-pill acc-pill-${ST[r.status]?.[0] || 'muted'}`}>{ST[r.status]?.[1] || r.status}</span>
              </div>
              <p className="ap-hwid-key">{r.key}</p>
              {r.reason && <p className="acc-muted-inline">{r.reason}</p>}
              {r.admin_note && <p className="ap-hwid-note">↳ {r.admin_note}</p>}
              <div className="acc-order-foot"><span><CalendarClock size={12} /> {toDate(r.created_at)?.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB') || '—'}</span></div>
            </article>
          ))}
        </div>
      )}
    </>
  );
};
