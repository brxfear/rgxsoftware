import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FolderTree,
  LogOut,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Upload,
  Link2,
  Eye,
  EyeOff,
  ChevronDown,
  Wallet,
  Clock,
  CheckCircle2,
  Menu,
  UserCog,
  ScrollText,
  CreditCard,
  Settings,
  KeyRound,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth, db } from '../../lib/firebase';
import { toDate, getStartPrice, getPlans } from '../../lib/db';
import { fmtUsd, fmtMoney } from '../../lib/currency';
import { fileToCompressedDataUrl } from './imageUtils';
import { loggedWrite, adminIdForEmail, logAdminLogin } from '../../lib/adminLog';
import { KeyStockDrawer, DeliveryPanel } from './Fulfillment';
import { useKeyCounts } from './useKeyCounts';
import LoginSettings from './LoginSettings';
import './AdminDashboard.css';

/* ------------------------------------------------------------------ */
/* Sabitler & yardımcılar                                              */
/* ------------------------------------------------------------------ */
const ORDER_STATUSES = [
  { value: 'Waiting for Confirmation', label: 'Onay bekliyor', tone: 'warn' },
  { value: 'pending_payment', label: 'Ödeme bekleniyor', tone: 'muted' },
  { value: 'paid', label: 'Ödendi', tone: 'info' },
  { value: 'Completed', label: 'Teslim edildi', tone: 'ok' },
  { value: 'Canceled', label: 'İptal', tone: 'bad' },
  { value: 'payment_review', label: 'Ödeme incelemede', tone: 'warn' },
];

const PAID = ['paid', 'Completed'];
const isShopier = (o) => o.payment_method === 'shopier';

/** Ödeme durumu (teslimattan ayrı gösterilir). */
const paymentBadge = (o) => {
  if (PAID.includes(o.status)) return { label: isShopier(o) ? 'Ödendi · Shopier' : 'Ödendi · havale onaylı', tone: 'ok' };
  if (o.status === 'Waiting for Confirmation') return { label: 'Havale bekleniyor', tone: 'warn' };
  if (o.status === 'pending_payment') return { label: 'Ödenmedi', tone: 'muted' };
  if (o.status === 'payment_review') return { label: 'Ödeme incelemede', tone: 'warn' };
  if (o.status === 'Canceled') return { label: 'İptal', tone: 'bad' };
  return { label: 'Ödeme başarısız', tone: 'bad' };
};

/** Teslimat durumu. */
const deliveryBadge = (o) =>
  o.status === 'Completed' ? { label: 'Teslim edildi', tone: 'ok' } : PAID.includes(o.status) ? { label: 'Teslim bekliyor', tone: 'warn' } : null;

const OrderBadges = ({ o }) => {
  const p = paymentBadge(o);
  const d = deliveryBadge(o);
  return (
    <span className="adm-badges">
      <span className={`adm-pill adm-pill-${p.tone}`}>{p.label}</span>
      {d && <span className={`adm-pill adm-pill-${d.tone}`}>{d.label}</span>}
    </span>
  );
};

/** Bu sipariş için panelde izin verilen durum değişiklikleri. */
const allowedStatuses = (o) => {
  if (isShopier(o)) {
    // Shopier ödemesini sadece sunucu onaylar; yönetici yalnızca teslim/iptal edebilir
    return PAID.includes(o.status) ? ['paid', 'Completed'] : ['Canceled'];
  }
  return ['Waiting for Confirmation', 'paid', 'Completed', 'Canceled'];
};

const statusMeta = (value = '') => {
  const found = ORDER_STATUSES.find((s) => s.value === value);
  if (found) return found;
  if (value.startsWith('failed')) return { value, label: 'Ödeme başarısız', tone: 'bad' };
  return { value, label: value || '—', tone: 'muted' };
};

const REVENUE_STATUSES = ['paid', 'Completed'];

const fmtDate = (v) => {
  const d = toDate(v);
  return d
    ? d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
};

const slugify = (s) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const newPlanId = () => 'pl_' + Math.random().toString(36).slice(2, 8);

const docBytes = (obj) => new Blob([JSON.stringify(obj)]).size;
const MAX_DOC_BYTES = 950 * 1024;

const FIELD_LABELS = {
  name: 'ad', description: 'açıklama', details: 'detaylar', description_en: 'EN açıklama', details_en: 'EN detaylar', category_id: 'kategori',
  price_1day: '1 gün fiyatı', price_7day: '7 gün fiyatı', price_30day: '30 gün fiyatı', price_lifetime: 'sınırsız fiyatı',
  plans: 'planlar', image_url: 'kapak görseli', video_url: 'video', extra_images: 'ek görseller', is_available: 'satış durumu', slug: 'slug',
};

/** Değişen alanları okunur bir özete çevirir (görseller için sadece "değişti"). */
const changeSummary = (before = {}, after = {}) => {
  const parts = [];
  Object.keys(FIELD_LABELS).forEach((k) => {
    if (!(k in after)) return;
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a ?? '') === JSON.stringify(b ?? '')) return;
    if (k === 'plans') parts.push(`planlar: ${(b || []).map((pl) => `${pl.label} ${fmtUsd(pl.price_usd)}`).join(', ')}`);
    else if (['image_url', 'extra_images', 'details', 'description', 'details_en', 'description_en'].includes(k)) parts.push(`${FIELD_LABELS[k]} değişti`);
    else if (k === 'is_available') parts.push(b ? 'satışa açıldı' : 'gizlendi');
    else parts.push(`${FIELD_LABELS[k]}: ${a ?? '—'} → ${b ?? '—'}`);
  });
  return parts.join(', ') || 'değişiklik yok';
};

const money = (amount, currency) => fmtMoney(amount, currency || 'USD');

/** Yönetici API çağrısı (Firebase ID token ile). */
const adminApi = async (method, path, body) => {
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

/** Siparişleri para birimine göre toplayıp "$120 · ₺4.520" gibi gösterir. */
const sumByCurrency = (orders) => {
  const sums = {};
  orders.forEach((o) => {
    const c = o.currency || 'USD';
    sums[c] = (sums[c] || 0) + (Number(o.total_amount) || 0);
  });
  const parts = Object.entries(sums).map(([c, v]) => money(v, c));
  return parts.length ? parts.join(' · ') : money(0, 'USD');
};

const orderLabel = (o) => `#${(o.merchant_oid || o.id).slice(-6)} (${o.customer_name || 'isimsiz'}, ${money(o.total_amount, o.currency)})`;

const useCollection = (path, order = 'created_at', dir = 'desc', max = 500) => {
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const q = query(collection(db, path), orderBy(order, dir), limit(max));
    return onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setReady(true);
      },
      (err) => {
        console.error(path, err);
        toast.error(`${path} okunamadı: ${err.code || err.message}`);
        setReady(true);
      }
    );
  }, [path, order, dir, max]);
  return [rows, ready];
};

/* ------------------------------------------------------------------ */
/* Küçük UI parçaları                                                  */
/* ------------------------------------------------------------------ */
const StatusPill = ({ status }) => {
  const m = statusMeta(status);
  return <span className={`adm-pill adm-pill-${m.tone}`}>{m.label}</span>;
};

const Empty = ({ children }) => <div className="adm-empty">{children}</div>;

const ImageField = ({ label, value, onChange, hint }) => {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(value && !value.startsWith('data:') ? 'url' : 'upload');

  const onFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await fileToCompressedDataUrl(file));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-field">
      <span className="adm-label">{label}</span>
      <div className="adm-image-field">
        <div className="adm-image-preview">
          {value ? <img src={value} alt="" /> : <span>Görsel yok</span>}
        </div>
        <div className="adm-image-actions">
          <div className="adm-seg">
            <button type="button" className={mode === 'upload' ? 'on' : ''} onClick={() => setMode('upload')}>
              <Upload size={13} /> Yükle
            </button>
            <button type="button" className={mode === 'url' ? 'on' : ''} onClick={() => setMode('url')}>
              <Link2 size={13} /> URL
            </button>
          </div>
          {mode === 'upload' ? (
            <>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
              <button type="button" className="adm-btn adm-btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? 'İşleniyor…' : 'Dosya seç'}
              </button>
            </>
          ) : (
            <input
              className="adm-input"
              placeholder="https://…"
              value={value?.startsWith('data:') ? '' : value || ''}
              onChange={(e) => onChange(e.target.value.trim())}
            />
          )}
          {value && (
            <button type="button" className="adm-link-danger" onClick={() => onChange('')}>
              Görseli kaldır
            </button>
          )}
          {hint && <small className="adm-muted">{hint}</small>}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Genel bakış                                                         */
/* ------------------------------------------------------------------ */
const Overview = ({ orders, products, categories, go }) => {
  const revenue = sumByCurrency(orders.filter((o) => REVENUE_STATUSES.includes(o.status)));
  const waiting = orders.filter((o) => o.status === 'Waiting for Confirmation' || o.status === 'paid');
  const today = new Date().toDateString();
  const todayCount = orders.filter((o) => toDate(o.created_at)?.toDateString() === today).length;

  const cards = [
    { icon: Wallet, label: 'Toplam ciro', value: revenue, sub: 'Ödenen + teslim edilen' },
    { icon: Clock, label: 'İşlem bekleyen', value: waiting.length, sub: 'Onay / teslim bekliyor', action: () => go('orders', 'action') },
    { icon: ShoppingBag, label: 'Bugünkü sipariş', value: todayCount, sub: `Toplam ${orders.length} sipariş` },
    { icon: Package, label: 'Ürün', value: products.length, sub: `${categories.length} kategori` },
  ];

  return (
    <>
      <div className="adm-stats">
        {cards.map(({ icon: Icon, label, value, sub, action }) => (
          <button key={label} className={`adm-stat ${action ? 'clickable' : ''}`} onClick={action} disabled={!action}>
            <span className="adm-stat-icon"><Icon size={18} /></span>
            <span className="adm-stat-label">{label}</span>
            <strong className="adm-stat-value">{value}</strong>
            <span className="adm-stat-sub">{sub}</span>
          </button>
        ))}
      </div>

      <section className="adm-card">
        <header className="adm-card-head">
          <h2>İşlem bekleyen siparişler</h2>
          <button className="adm-btn adm-btn-ghost" onClick={() => go('orders')}>Tüm siparişler</button>
        </header>
        {waiting.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <tbody>
                {waiting.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.customer_name || '—'}</strong>
                      <div className="adm-muted">{o.customer_email}</div>
                    </td>
                    <td>{(o.items || []).map((i) => `${i.name} (${i.durationLabel})`).join(', ')}</td>
                    <td className="adm-num">{money(o.total_amount, o.currency)}</td>
                    <td><OrderBadges o={o} /></td>
                    <td className="adm-muted">{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Bekleyen sipariş yok. 🎉</Empty>
        )}
      </section>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Siparişler                                                          */
/* ------------------------------------------------------------------ */
const Orders = ({ orders, initialFilter, me }) => {
  const [filter, setFilter] = useState(initialFilter || 'all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const counts = useMemo(() => {
    const c = { all: orders.length, action: 0 };
    orders.forEach((o) => {
      c[o.status] = (c[o.status] || 0) + 1;
      if (o.status === 'Waiting for Confirmation' || o.status === 'paid') c.action++;
    });
    return c;
  }, [orders]);

  const shown = orders.filter((o) => {
    if (filter === 'action' && !(o.status === 'Waiting for Confirmation' || o.status === 'paid')) return false;
    if (filter !== 'all' && filter !== 'action' && o.status !== filter) return false;
    if (!search) return true;
    const hay = `${o.id} ${o.customer_name} ${o.customer_email} ${o.customer_phone} ${(o.items || []).map((i) => i.name).join(' ')}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const setStatus = async (o, status) => {
    if (status === 'paid' && !isShopier(o) && !confirm('Havale/EFT ödemesinin hesabına geçtiğini kontrol ettin mi? Sipariş "ödendi" olarak işaretlenecek.')) return;
    if (status === 'Canceled' && isShopier(o) && !PAID.includes(o.status)) {
      if (!confirm('Ödenmemiş Shopier siparişi iptal edilsin mi? Geçici Shopier ödeme sayfası da silinir.')) return;
      try {
        await adminApi('POST', '/api/shopier-cancel', { order_id: o.id });
        toast.success('Sipariş iptal edildi');
      } catch (err) {
        toast.error(err.message);
      }
      return;
    }
    try {
      await loggedWrite({
        me, mode: 'update', collectionName: 'orders', id: o.id, targetType: 'order', action: 'status',
        data: { status, updated_at: serverTimestamp() },
        summary: `Sipariş ${orderLabel(o)} durumu: ${statusMeta(o.status).label} → ${statusMeta(status).label}`,
      });
      toast.success(`Durum: ${statusMeta(status).label}`);
    } catch (err) {
      toast.error('Güncellenemedi: ' + err.code);
    }
  };

  const remove = async (o) => {
    if (!confirm('Bu sipariş kalıcı olarak silinsin mi?')) return;
    try {
      // Ödenmemiş Shopier siparişinin geçici ödeme ürününü de sil
      if (isShopier(o) && o.status === 'pending_payment') await adminApi('POST', '/api/shopier-cancel', { order_id: o.id });
      await loggedWrite({
        me, mode: 'delete', collectionName: 'orders', id: o.id, current: o, targetType: 'order',
        summary: `Sipariş ${orderLabel(o)} silindi`,
      });
      toast.success('Sipariş silindi');
    } catch (err) {
      toast.error('Silinemedi: ' + err.code);
    }
  };

  const chips = [
    { value: 'all', label: 'Tümü' },
    { value: 'action', label: 'İşlem bekleyen' },
    ...ORDER_STATUSES,
  ];

  return (
    <section className="adm-card">
      <header className="adm-card-head adm-card-head-wrap">
        <div className="adm-chips">
          {chips.map((c) => (
            <button key={c.value} className={`adm-chip ${filter === c.value ? 'on' : ''}`} onClick={() => setFilter(c.value)}>
              {c.label} <span>{counts[c.value] || 0}</span>
            </button>
          ))}
        </div>
        <label className="adm-search">
          <Search size={15} />
          <input placeholder="Müşteri, e-posta, ürün, sipariş no…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </header>

      {shown.length ? (
        <div className="adm-orders">
          {shown.map((o) => {
            const isOpen = open === o.id;
            return (
              <article key={o.id} className={`adm-order ${isOpen ? 'open' : ''}`}>
                <button className="adm-order-row" onClick={() => setOpen(isOpen ? null : o.id)}>
                  <div className="adm-order-main">
                    <strong>{o.customer_name || 'İsimsiz'}</strong>
                    <span className="adm-muted">{o.customer_email} · {o.customer_phone}</span>
                  </div>
                  <span className="adm-order-items">{(o.items || []).length} ürün</span>
                  <span className="adm-num">{money(o.total_amount, o.currency)}</span>
                  <OrderBadges o={o} />
                  <span className="adm-muted adm-hide-sm">{fmtDate(o.created_at)}</span>
                  <ChevronDown size={16} className="adm-chevron" />
                </button>

                {isOpen && (
                  <div className="adm-order-detail">
                    <div className="adm-order-meta">
                      <div><span className="adm-label">Sipariş no</span><code>{o.merchant_oid || o.id}</code></div>
                      <div><span className="adm-label">Ödeme</span>{o.payment_method || '—'}</div>
                      <div><span className="adm-label">Tarih</span>{fmtDate(o.created_at)}</div>
                      <div><span className="adm-label">Kullanıcı</span>{o.user_id ? <code>{o.user_id}</code> : 'Misafir'}</div>
                    </div>
                    <table className="adm-table adm-table-compact">
                      <thead>
                        <tr><th>Ürün</th><th>Plan</th><th>Adet</th><th className="adm-num">Tutar</th></tr>
                      </thead>
                      <tbody>
                        {(o.items || []).map((i, idx) => (
                          <tr key={idx}>
                            <td>{i.name}</td>
                            <td>{i.durationLabel}</td>
                            <td>{i.quantity}</td>
                            <td className="adm-num">{money(i.subtotal ?? i.price * i.quantity, o.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <DeliveryPanel key={`${o.id}-${o.delivery?.delivered_at?.seconds || 0}`} order={o} me={me} />
                    <div className="adm-order-actions">
                      <span className="adm-label">Durumu değiştir</span>
                      <div className="adm-chips">
                        {ORDER_STATUSES.filter((s) => allowedStatuses(o).includes(s.value)).map((s) => (
                          <button
                            key={s.value}
                            className={`adm-chip adm-chip-${s.tone} ${o.status === s.value ? 'on' : ''}`}
                            onClick={() => setStatus(o, s.value)}
                            disabled={o.status === s.value}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <button className="adm-link-danger" onClick={() => remove(o)}>
                        <Trash2 size={14} /> Siparişi sil
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty>Bu filtrede sipariş yok.</Empty>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Ürünler                                                             */
/* ------------------------------------------------------------------ */
const EMPTY_PRODUCT = {
  name: '',
  description: '',
  details: '',
  description_en: '',
  details_en: '',
  category_id: '',
  image_url: '',
  video_url: '',
  extra_images: [],
  is_available: true,
};

const ProductForm = ({ initial, categories, onClose, me }) => {
  const [form, setForm] = useState(() => ({
    ...EMPTY_PRODUCT,
    ...initial,
    extra_images: initial?.extra_images || [],
    plans: initial?.id ? getPlans(initial).map((x) => ({ ...x, price_usd: String(x.price_usd) })) : [],
    featured_plan_id: initial?.featured_plan_id || '',
  }));

  const setPlan = (i, key, value) =>
    setForm((f) => ({ ...f, plans: f.plans.map((pl, j) => (j === i ? { ...pl, [key]: value } : pl)) }));
  const addPlan = (label = '') =>
    setForm((f) => ({ ...f, plans: [...f.plans, { id: newPlanId(), label, price_usd: '' }] }));
  const removePlan = (i) =>
    setForm((f) => ({ ...f, plans: f.plans.filter((_, j) => j !== i) }));
  const movePlan = (i, d) =>
    setForm((f) => {
      const arr = [...f.plans];
      const j = i + d;
      if (j < 0 || j >= arr.length) return f;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...f, plans: arr };
    });
  const [saving, setSaving] = useState(false);
  const extraRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  const addExtraFiles = async (files) => {
    for (const file of Array.from(files || [])) {
      try {
        const url = await fileToCompressedDataUrl(file, 960);
        setForm((f) => ({ ...f, extra_images: [...f.extra_images, url] }));
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Ürün adı gerekli.');
    if (!form.category_id) return toast.error('Kategori seç.');
    const plans = form.plans
      .map((pl) => ({ id: pl.id, label: pl.label.trim(), price_usd: Math.round((parseFloat(pl.price_usd) || 0) * 100) / 100 }))
      .filter((pl) => pl.label || pl.price_usd);
    if (!plans.length) return toast.error('En az bir plan ekle.');
    if (plans.some((pl) => !pl.label || !(pl.price_usd > 0))) return toast.error('Her planın adı ve $ fiyatı olmalı.');
    const prices = plans.map((pl) => pl.price_usd);

    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      details: form.details,
      description_en: (form.description_en || '').trim(),
      details_en: form.details_en || '',
      category_id: form.category_id,
      plans,
      featured_plan_id: plans.some((pl) => pl.id === form.featured_plan_id) ? form.featured_plan_id : '',
      price: Math.min(...prices),
      image_url: form.image_url || '',
      video_url: form.video_url.trim(),
      extra_images: form.extra_images,
      is_available: !!form.is_available,
      updated_at: serverTimestamp(),
    };
    if (docBytes(data) > MAX_DOC_BYTES) {
      return toast.error('Görseller çok büyük (1 MB sınırı). Bazı ek görselleri kaldır ya da URL kullan.');
    }

    setSaving(true);
    try {
      const catName = (id) => categories.find((c) => c.id === id)?.name || id;
      if (initial?.id) {
        const before = { ...initial, category_id: catName(initial.category_id) };
        const after = { ...data, category_id: catName(data.category_id) };
        await loggedWrite({
          me, mode: 'update', collectionName: 'products', id: initial.id, targetType: 'product', data,
          summary: `Ürün "${data.name}" güncellendi: ${changeSummary(before, after)}`,
        });
        toast.success('Ürün güncellendi');
      } else {
        await loggedWrite({
          me, mode: 'create', collectionName: 'products', targetType: 'product',
          data: { ...data, created_at: serverTimestamp() },
          summary: `Ürün "${data.name}" eklendi (${catName(data.category_id)}, ${plans.map((pl) => `${pl.label} ${fmtUsd(pl.price_usd)}`).join(', ')})`,
        });
        toast.success('Ürün eklendi');
      }
      onClose();
    } catch (err) {
      toast.error('Kaydedilemedi: ' + (err.code || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <form className="adm-drawer" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <header className="adm-drawer-head">
          <h2>{initial?.id ? 'Ürünü düzenle' : 'Yeni ürün'}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </header>

        <div className="adm-drawer-body">
          <div className="adm-grid-2">
            <label className="adm-field">
              <span className="adm-label">Ürün adı *</span>
              <input className="adm-input" value={form.name} onChange={set('name')} required />
            </label>
            <label className="adm-field">
              <span className="adm-label">Kategori *</span>
              <select className="adm-input" value={form.category_id} onChange={set('category_id')} required>
                <option value="">Seç…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>

          <label className="adm-field">
            <span className="adm-label">Kısa açıklama</span>
            <input className="adm-input" value={form.description} onChange={set('description')} maxLength={160} />
          </label>

          <label className="adm-field">
            <span className="adm-label">Detaylar / özellikler</span>
            <textarea className="adm-input" rows={6} value={form.details} onChange={set('details')} placeholder={'- Aimbot\n- ESP\n- …'} />
          </label>

          <details className="adm-en-block" open={!!(form.description_en || form.details_en)}>
            <summary>İngilizce metin (EN) — boş bırakılırsa Türkçesi gösterilir</summary>
            <label className="adm-field">
              <span className="adm-label">Short description (EN)</span>
              <input className="adm-input" value={form.description_en || ''} onChange={set('description_en')} maxLength={160} />
            </label>
            <label className="adm-field">
              <span className="adm-label">Details / features (EN)</span>
              <textarea className="adm-input" rows={5} value={form.details_en || ''} onChange={set('details_en')} />
            </label>
          </details>

          <div className="adm-field">
            <span className="adm-label">Planlar — fiyatlar $ (USD)</span>
            <div className="adm-plans-editor">
              {form.plans.map((pl, i) => (
                <div key={pl.id} className="adm-plan-row">
                  <div className="adm-plan-move">
                    <button type="button" onClick={() => movePlan(i, -1)} disabled={i === 0} aria-label="Yukarı">▲</button>
                    <button type="button" onClick={() => movePlan(i, 1)} disabled={i === form.plans.length - 1} aria-label="Aşağı">▼</button>
                  </div>
                  <input className="adm-input" placeholder="Plan adı (ör. 1 Hafta)" value={pl.label} onChange={(e) => setPlan(i, 'label', e.target.value)} maxLength={30} />
                  <label className="adm-usd-input">
                    <span>$</span>
                    <input className="adm-input" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={pl.price_usd} onChange={(e) => setPlan(i, 'price_usd', e.target.value)} />
                  </label>
                  <button
                    type="button"
                    className={`adm-icon-btn ${form.featured_plan_id === pl.id ? 'on' : ''}`}
                    title="Popüler olarak işaretle"
                    onClick={() => setForm((f) => ({ ...f, featured_plan_id: f.featured_plan_id === pl.id ? '' : pl.id }))}
                  >
                    ★
                  </button>
                  <button type="button" className="adm-icon-btn danger" onClick={() => removePlan(i)} aria-label="Planı sil"><Trash2 size={14} /></button>
                </div>
              ))}
              <div className="adm-plan-presets">
                <span className="adm-muted">Ekle:</span>
                {['1 Gün', '3 Gün', '1 Hafta', '1 Ay', 'Sınırsız', 'Tek Seferlik'].map((l) => (
                  <button key={l} type="button" className="adm-chip" onClick={() => addPlan(l)}>+ {l}</button>
                ))}
                <button type="button" className="adm-chip" onClick={() => addPlan('')}>+ Özel</button>
              </div>
            </div>
          </div>

          <ImageField label="Kapak görseli" value={form.image_url} onChange={set('image_url')} hint="Otomatik WebP'ye küçültülür." />

          <div className="adm-field">
            <span className="adm-label">Ek görseller</span>
            <div className="adm-thumbs">
              {form.extra_images.map((src, i) => (
                <div key={i} className="adm-thumb">
                  <img src={src} alt="" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, extra_images: f.extra_images.filter((_, j) => j !== i) }))} aria-label="Kaldır">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button type="button" className="adm-thumb adm-thumb-add" onClick={() => extraRef.current?.click()}>
                <Plus size={18} />
              </button>
              <input ref={extraRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addExtraFiles(e.target.files); e.target.value = ''; }} />
            </div>
          </div>

          <label className="adm-field">
            <span className="adm-label">Video URL (YouTube / mp4)</span>
            <input className="adm-input" value={form.video_url} onChange={set('video_url')} placeholder="https://…" />
          </label>

          <label className="adm-switch">
            <input type="checkbox" checked={form.is_available} onChange={set('is_available')} />
            <span className="adm-switch-track"><span /></span>
            Satışta (sitede görünsün)
          </label>
        </div>

        <footer className="adm-drawer-foot">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>Vazgeç</button>
          <button className="adm-btn adm-btn-primary" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </footer>
      </form>
    </div>
  );
};

const Products = ({ products, categories, me }) => {
  const [editing, setEditing] = useState(null);
  const [keysFor, setKeysFor] = useState(null);
  const keyCounts = useKeyCounts();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const catName = (id) => categories.find((c) => c.id === id)?.name || '—';

  const shown = products.filter(
    (p) => (!cat || p.category_id === cat) && (!search || p.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = async (p) => {
    try {
      const next = p.is_available === false;
      await loggedWrite({
        me, mode: 'update', collectionName: 'products', id: p.id, targetType: 'product',
        data: { is_available: next },
        summary: `Ürün "${p.name}" ${next ? 'satışa açıldı' : 'gizlendi'}`,
      });
    } catch (err) {
      toast.error('Güncellenemedi: ' + err.code);
    }
  };

  const remove = async (p) => {
    if (!confirm(`"${p.name}" silinsin mi? Bu işlem geri alınamaz.`)) return;
    try {
      await loggedWrite({
        me, mode: 'delete', collectionName: 'products', id: p.id, current: p, targetType: 'product',
        summary: `Ürün "${p.name}" silindi`,
      });
      toast.success('Ürün silindi');
    } catch (err) {
      toast.error('Silinemedi: ' + err.code);
    }
  };

  return (
    <section className="adm-card">
      <header className="adm-card-head adm-card-head-wrap">
        <div className="adm-toolbar">
          <label className="adm-search">
            <Search size={15} />
            <input placeholder="Ürün ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select className="adm-input adm-input-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Tüm kategoriler</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={() => setEditing({})} disabled={!categories.length}>
          <Plus size={16} /> Yeni ürün
        </button>
      </header>
      {!categories.length && <Empty>Önce bir kategori ekle, sonra ürün ekleyebilirsin.</Empty>}

      {shown.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Kategori</th>
                <th className="adm-hide-sm">Planlar</th>
                <th className="adm-num">Başlangıç</th>
                <th className="adm-num">Key stoğu</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className={p.is_available === false ? 'adm-row-dim' : ''}>
                  <td>
                    <div className="adm-prod">
                      <img src={p.image_url || '/logo.webp'} alt="" />
                      <div>
                        <strong>{p.name}</strong>
                        <div className="adm-muted adm-ellipsis">{p.description}</div>
                      </div>
                    </div>
                  </td>
                  <td>{catName(p.category_id)}</td>
                  <td className="adm-hide-sm adm-plans">
                    {getPlans(p).map((pl) => <span key={pl.id}>{pl.label} {fmtUsd(pl.price_usd)}</span>)}
                  </td>
                  <td className="adm-num">{fmtUsd(getStartPrice(p))}</td>
                  <td className="adm-num">
                    <button className={`adm-pill adm-pill-btn adm-pill-${keyCounts[p.id]?._total ? 'ok' : 'warn'}`} onClick={() => setKeysFor(p)} title="Key stoğunu yönet">
                      <KeyRound size={12} /> {keyCounts[p.id]?._total || 0}
                    </button>
                  </td>
                  <td>
                    <button className={`adm-pill adm-pill-${p.is_available === false ? 'muted' : 'ok'} adm-pill-btn`} onClick={() => toggle(p)} title="Satış durumunu değiştir">
                      {p.is_available === false ? <><EyeOff size={12} /> Gizli</> : <><Eye size={12} /> Satışta</>}
                    </button>
                  </td>
                  <td className="adm-row-actions">
                    <button className="adm-icon-btn" onClick={() => setKeysFor(p)} aria-label="Key stoğu"><KeyRound size={15} /></button>
                    <button className="adm-icon-btn" onClick={() => setEditing(p)} aria-label="Düzenle"><Pencil size={15} /></button>
                    <button className="adm-icon-btn danger" onClick={() => remove(p)} aria-label="Sil"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        categories.length > 0 && <Empty>Ürün bulunamadı.</Empty>
      )}

      {editing && <ProductForm initial={editing} categories={categories} me={me} onClose={() => setEditing(null)} />}
      {keysFor && <KeyStockDrawer product={keysFor} me={me} onClose={() => setKeysFor(null)} />}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Kategoriler                                                         */
/* ------------------------------------------------------------------ */
const Categories = ({ categories, products, me }) => {
  const empty = { name: '', slug: '', image_url: '' };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Kategori adı gerekli.');
    const data = { name: form.name.trim(), slug: form.slug.trim() || slugify(form.name), image_url: form.image_url || '' };
    if (docBytes(data) > MAX_DOC_BYTES) return toast.error('Görsel çok büyük.');
    setSaving(true);
    try {
      if (editId) {
        const before = categories.find((c) => c.id === editId) || {};
        await loggedWrite({
          me, mode: 'update', collectionName: 'categories', id: editId, targetType: 'category',
          data: { ...data, updated_at: serverTimestamp() },
          summary: `Kategori "${data.name}" güncellendi: ${changeSummary(before, data)}`,
        });
        toast.success('Kategori güncellendi');
      } else {
        await loggedWrite({
          me, mode: 'create', collectionName: 'categories', targetType: 'category',
          data: { ...data, created_at: serverTimestamp() },
          summary: `Kategori "${data.name}" eklendi`,
        });
        toast.success('Kategori eklendi');
      }
      setForm(empty);
      setEditId(null);
    } catch (err) {
      toast.error('Kaydedilemedi: ' + (err.code || err.message));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    const count = products.filter((p) => p.category_id === c.id).length;
    if (count) return toast.error(`Bu kategoride ${count} ürün var. Önce ürünleri taşı veya sil.`);
    if (!confirm(`"${c.name}" kategorisi silinsin mi?`)) return;
    try {
      await loggedWrite({
        me, mode: 'delete', collectionName: 'categories', id: c.id, current: c, targetType: 'category',
        summary: `Kategori "${c.name}" silindi`,
      });
      toast.success('Kategori silindi');
    } catch (err) {
      toast.error('Silinemedi: ' + err.code);
    }
  };

  return (
    <div className="adm-split">
      <form className="adm-card adm-card-pad" onSubmit={save}>
        <h2 className="adm-card-title">{editId ? 'Kategoriyi düzenle' : 'Yeni kategori / oyun'}</h2>
        <label className="adm-field">
          <span className="adm-label">Ad *</span>
          <input
            className="adm-input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editId ? f.slug : slugify(e.target.value) }))}
            placeholder="Valorant"
            required
          />
        </label>
        <label className="adm-field">
          <span className="adm-label">Slug</span>
          <input className="adm-input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} placeholder="valorant" />
        </label>
        <ImageField label="Oyun görseli (kart)" value={form.image_url} onChange={(v) => setForm((f) => ({ ...f, image_url: v }))} />
        <div className="adm-form-actions">
          {editId && (
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => { setEditId(null); setForm(empty); }}>Vazgeç</button>
          )}
          <button className="adm-btn adm-btn-primary" disabled={saving}>{saving ? 'Kaydediliyor…' : editId ? 'Güncelle' : 'Ekle'}</button>
        </div>
      </form>

      <section className="adm-card">
        <header className="adm-card-head"><h2>Kategoriler ({categories.length})</h2></header>
        {categories.length ? (
          <div className="adm-cat-grid">
            {categories.map((c) => (
              <div key={c.id} className={`adm-cat ${editId === c.id ? 'on' : ''}`}>
                <div className="adm-cat-img">{c.image_url ? <img src={c.image_url} alt="" /> : <img src="/logo.webp" alt="" className="contain" />}</div>
                <div className="adm-cat-body">
                  <strong>{c.name}</strong>
                  <span className="adm-muted">{products.filter((p) => p.category_id === c.id).length} ürün · /{c.slug}</span>
                </div>
                <div className="adm-row-actions">
                  <button className="adm-icon-btn" onClick={() => { setEditId(c.id); setForm({ name: c.name, slug: c.slug || '', image_url: c.image_url || '' }); }} aria-label="Düzenle"><Pencil size={15} /></button>
                  <button className="adm-icon-btn danger" onClick={() => remove(c)} aria-label="Sil"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Henüz kategori yok.</Empty>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Yöneticiler                                                         */
/* ------------------------------------------------------------------ */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NICK_RE = /^.{2,24}$/;

const Admins = ({ me, onNickChange }) => {
  const [admins, ready] = useCollection('admins', 'created_at', 'asc');
  const [email, setEmail] = useState('');
  const [nick, setNick] = useState('');
  const [myNick, setMyNick] = useState(me.nickname);
  const [saving, setSaving] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    const nickname = nick.trim();
    if (!EMAIL_RE.test(email.trim())) return toast.error('Geçerli bir e-posta adresi yaz.');
    if (!NICK_RE.test(nickname)) return toast.error('Takma ad 2-24 karakter olmalı.');
    setSaving(true);
    try {
      const id = await adminIdForEmail(email);
      if (admins.some((a) => a.id === id)) {
        // Zaten yönetici: sadece şifre belirleme e-postasını tekrar gönder
        if (!confirm('Bu e-posta zaten yönetici. Şifre belirleme e-postası tekrar gönderilsin mi?')) return;
        await adminApi('POST', '/api/admin-invite', { email: email.trim() });
        toast.success('Şifre belirleme e-postası tekrar gönderildi');
        setEmail('');
        setNick('');
        return;
      }
      await loggedWrite({
        me, mode: 'set', collectionName: 'admins', id, targetType: 'admin',
        data: { nickname, added_by_nick: me.nickname, created_at: serverTimestamp() },
        summary: `"${nickname}" yönetici olarak eklendi`,
      });
      toast.success(`${nickname} yönetici olarak eklendi`);
      try {
        await adminApi('POST', '/api/admin-invite', { email: email.trim() });
        toast.success('Şifre belirleme e-postası gönderildi');
      } catch (err) {
        toast.error('Yönetici eklendi ama davet e-postası gönderilemedi: ' + err.message);
      }
      setEmail('');
      setNick('');
    } catch (err) {
      toast.error('Eklenemedi: ' + (err.code || err.message));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    if (!confirm(`"${a.nickname}" yöneticilikten çıkarılsın mı? Panele bir daha giremez.`)) return;
    try {
      await loggedWrite({
        me, mode: 'delete', collectionName: 'admins', id: a.id, current: a, targetType: 'admin',
        summary: `"${a.nickname}" yöneticilikten çıkarıldı`,
      });
      toast.success('Yönetici çıkarıldı');
    } catch (err) {
      toast.error('Çıkarılamadı: ' + err.code);
    }
  };

  const saveNick = async (e) => {
    e.preventDefault();
    const nickname = myNick.trim();
    if (!NICK_RE.test(nickname)) return toast.error('Takma ad 2-24 karakter olmalı.');
    if (nickname === me.nickname) return;
    try {
      await loggedWrite({
        me, mode: 'update', collectionName: 'admins', id: me.id, targetType: 'admin',
        data: { nickname },
        summary: `Takma adını "${me.nickname}" → "${nickname}" olarak değiştirdi`,
      });
      onNickChange(nickname);
      toast.success('Takma ad güncellendi');
    } catch (err) {
      toast.error('Güncellenemedi: ' + err.code);
    }
  };

  return (
    <div className="adm-split">
      <div className="adm-stack">
        <form className="adm-card adm-card-pad" onSubmit={add}>
          <h2 className="adm-card-title">Yönetici ekle</h2>
          <p className="adm-muted adm-help">
            Eklediğin e-postaya <strong>“şifreni belirle”</strong> e-postası gider. Kişi linkten şifresini belirleyip
            <strong> /admin</strong> sayfasında <strong>e-posta + şifre</strong> ile girer. Gmail ise Google ile de girebilir.
            E-posta kaydedilmez; panelde sadece takma ad görünür.
          </p>
          <label className="adm-field">
            <span className="adm-label">E-posta adresi</span>
            <input className="adm-input" type="email" autoComplete="off" placeholder="ornek@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="adm-field">
            <span className="adm-label">Takma ad</span>
            <input className="adm-input" maxLength={24} placeholder="ör. Shadow" value={nick} onChange={(e) => setNick(e.target.value)} required />
          </label>
          <div className="adm-form-actions">
            <button className="adm-btn adm-btn-primary" disabled={saving}>
              <Plus size={16} /> {saving ? 'Ekleniyor…' : 'Yönetici yap'}
            </button>
          </div>
        </form>

        <form className="adm-card adm-card-pad" onSubmit={saveNick}>
          <h2 className="adm-card-title">Takma adım</h2>
          <label className="adm-field">
            <span className="adm-label">Panelde ve kayıtlarda görünen ad</span>
            <input className="adm-input" maxLength={24} value={myNick} onChange={(e) => setMyNick(e.target.value)} />
          </label>
          <div className="adm-form-actions">
            <button className="adm-btn adm-btn-ghost" disabled={myNick.trim() === me.nickname}>Kaydet</button>
          </div>
        </form>

        <LoginSettings me={me} />
      </div>

      <section className="adm-card">
        <header className="adm-card-head"><h2>Yöneticiler ({admins.length})</h2></header>
        {!ready ? (
          <Empty>Yükleniyor…</Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Takma ad</th><th className="adm-hide-sm">Ekleyen</th><th className="adm-hide-sm">Tarih</th><th /></tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="adm-user">
                        <span className="adm-avatar">{a.nickname?.[0]?.toUpperCase()}</span>
                        <span>{a.nickname}{a.id === me.id && <em className="adm-you"> (sen)</em>}</span>
                      </div>
                    </td>
                    <td className="adm-hide-sm adm-muted">{a.added_by_nick || 'kurulum'}</td>
                    <td className="adm-hide-sm adm-muted">{fmtDate(a.created_at)}</td>
                    <td className="adm-row-actions">
                      {a.id !== me.id && (
                        <button className="adm-icon-btn danger" onClick={() => remove(a)} aria-label="Yöneticilikten çıkar">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Ödemeler (Shopier logları)                                          */
/* ------------------------------------------------------------------ */
const PAY_EVENT = {
  created: { label: 'Başlatıldı', tone: 'muted' },
  success: { label: 'Başarılı', tone: 'ok' },
  failed: { label: 'Başarısız', tone: 'bad' },
  bad_signature: { label: 'Geçersiz imza', tone: 'bad' },
  error: { label: 'Hata', tone: 'warn' },
  shopier_order: { label: 'Shopier siparişi', tone: 'info' },
  refund: { label: 'İade', tone: 'warn' },
  shopier_event: { label: 'Shopier olayı', tone: 'muted' },
};

const ShopierOrders = () => {
  const [state, setState] = useState({ loading: false, orders: null, error: null });
  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { orders } = await adminApi('GET', '/api/shopier-orders?limit=50');
      setState({ loading: false, orders, error: null });
    } catch (err) {
      setState({ loading: false, orders: null, error: err.message });
    }
  };
  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <h2>Shopier mağaza siparişleri</h2>
        <button className="adm-btn adm-btn-ghost" onClick={load} disabled={state.loading}>
          {state.loading ? 'Yükleniyor…' : state.orders ? 'Yenile' : "Shopier'den getir"}
        </button>
      </header>
      {state.error && <Empty>Alınamadı: {state.error}</Empty>}
      {!state.error && !state.orders && <Empty>Shopier mağazandaki son 50 siparişi görmek için “Shopier'den getir”e bas.</Empty>}
      {state.orders && (
        state.orders.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Tarih</th><th>Shopier no</th><th>Müşteri</th><th>Ürünler</th><th className="adm-num">Tutar</th><th>Ödeme</th><th className="adm-hide-sm">Durum</th></tr>
              </thead>
              <tbody>
                {state.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="adm-muted adm-nowrap">{fmtDate(o.date)}</td>
                    <td><code>{o.id}</code></td>
                    <td>{o.buyer || '—'}<div className="adm-muted">{o.email}</div></td>
                    <td>{o.items.map((i) => `${i.title}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ')}</td>
                    <td className="adm-num">{money(o.total, o.currency)}</td>
                    <td><span className={`adm-pill adm-pill-${o.paymentStatus === 'paid' ? 'ok' : 'warn'}`}>{o.paymentStatus === 'paid' ? 'Ödendi' : o.paymentStatus}</span></td>
                    <td className="adm-hide-sm adm-muted">{o.status === 'fulfilled' ? 'Teslim edildi' : o.status === 'unfulfilled' ? 'Bekliyor' : o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Shopier mağazasında sipariş yok.</Empty>
      )}
    </section>
  );
};

const Payments = ({ orders }) => {
  const [logs, ready] = useCollection('payment_logs', 'at', 'desc', 500);
  const [event, setEvent] = useState('');
  const [search, setSearch] = useState('');

  const paid = orders.filter((o) => o.payment_method === 'shopier' && REVENUE_STATUSES.includes(o.status));
  const today = new Date().toDateString();
  const stats = [
    { label: 'Shopier ciro', value: sumByCurrency(paid) },
    { label: 'Başarılı ödeme', value: paid.length },
    { label: 'Bugün başarısız', value: logs.filter((l) => l.event === 'failed' && toDate(l.at)?.toDateString() === today).length },
    { label: 'Geçersiz imza', value: logs.filter((l) => l.event === 'bad_signature').length },
  ];

  const shown = logs.filter(
    (l) =>
      (!event || l.event === event) &&
      (!search || `${l.order_id} ${l.payment_id} ${l.message}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <div className="adm-stats">
        {stats.map((s) => (
          <div key={s.label} className="adm-stat">
            <span className="adm-stat-label">{s.label}</span>
            <strong className="adm-stat-value">{s.value}</strong>
          </div>
        ))}
      </div>
      <section className="adm-card">
        <header className="adm-card-head adm-card-head-wrap">
          <div className="adm-toolbar">
            <label className="adm-search">
              <Search size={15} />
              <input placeholder="Sipariş no, Shopier ödeme no…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <select className="adm-input adm-input-sm" value={event} onChange={(e) => setEvent(e.target.value)}>
              <option value="">Tüm olaylar</option>
              {Object.entries(PAY_EVENT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <span className="adm-muted">Sunucu tarafından yazılır · değiştirilemez</span>
        </header>
        {!ready ? (
          <Empty>Yükleniyor…</Empty>
        ) : shown.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Zaman</th><th>Olay</th><th>Sipariş</th><th className="adm-num">Tutar</th><th className="adm-hide-sm">Shopier no</th><th>Açıklama</th></tr>
              </thead>
              <tbody>
                {shown.map((l) => {
                  const m = PAY_EVENT[l.event] || { label: l.event, tone: 'muted' };
                  return (
                    <tr key={l.id}>
                      <td className="adm-muted adm-nowrap">{fmtDate(l.at)}</td>
                      <td><span className={`adm-pill adm-pill-${m.tone}`}>{m.label}</span></td>
                      <td>{l.order_id ? <code>#{l.order_id.slice(-8)}</code> : '—'}</td>
                      <td className="adm-num">{l.amount != null ? money(l.amount, l.currency) : '—'}</td>
                      <td className="adm-hide-sm"><code>{l.payment_id || '—'}</code></td>
                      <td>{l.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Henüz ödeme kaydı yok. Shopier webhook'u kurulunca her yeni sipariş burada görünecek.</Empty>
        )}
      </section>
      <ShopierOrders />
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Shopier bağlantısı (webhook)                                        */
/* ------------------------------------------------------------------ */
const ShopierConnection = () => {
  const [st, setSt] = useState({ loading: true, data: null, error: null });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setSt((s) => ({ ...s, loading: true }));
    try {
      setSt({ loading: false, data: await adminApi('GET', '/api/shopier-setup'), error: null });
    } catch (err) {
      setSt({ loading: false, data: null, error: err.message });
    }
  };
  useEffect(() => {
    load();
  }, []);

  const act = async (method) => {
    if (method === 'DELETE' && !confirm('Shopier webhook kaldırılsın mı? Yeni siparişler artık otomatik loglanmaz.')) return;
    setBusy(true);
    try {
      const r = await adminApi(method, '/api/shopier-setup');
      toast.success(method === 'POST' ? `Webhook kuruldu${r.created?.length ? ` (${r.created.join(', ')})` : ' (zaten kuruluydu)'}` : 'Webhook kaldırıldı');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const d = st.data;
  const connected = d?.webhooks?.some((w) => w.event === 'order.created');
  return (
    <section className="adm-card adm-card-pad">
      <h2 className="adm-card-title">Shopier</h2>
      {st.loading ? (
        <p className="adm-muted">Bağlantı kontrol ediliyor…</p>
      ) : st.error ? (
        <>
          <p className="adm-muted adm-help">Shopier'e ulaşılamadı: {st.error}</p>
          <p className="adm-muted adm-help">
            Sunucu ortam değişkenlerinde (Vercel → Settings → Environment Variables) <code>SHOPIER_PAT</code> ve <code>SITE_URL</code> tanımlı olmalı.
            Yerel geliştirmede bu bölüm çalışmaz.
          </p>
          <button className="adm-btn adm-btn-ghost" onClick={load}>Tekrar dene</button>
        </>
      ) : (
        <>
          <ul className="adm-env-list">
            <li>Mağaza: <a href={d.shop?.url} target="_blank" rel="noopener noreferrer">{d.shop?.url}</a></li>
            <li>Webhook adresi: <code>{d.hookUrl}</code></li>
            <li>
              Durum:{' '}
              <span className={`adm-pill adm-pill-${connected ? 'ok' : 'warn'}`}>
                {connected ? `Bağlı (${d.webhooks.map((w) => w.event).join(', ')})` : 'Webhook kurulu değil'}
              </span>
            </li>
            {d.otherWebhooks > 0 && <li className="adm-muted">Mağazada başka adreslere giden {d.otherWebhooks} webhook var (dokunulmaz).</li>}
          </ul>
          <p className="adm-muted adm-help">
            Webhook kurulunca Shopier'deki her yeni sipariş ve iade otomatik olarak “Ödemeler” bölümüne loglanır.
          </p>
          <div className="adm-form-actions">
            {connected && <button className="adm-btn adm-btn-ghost" onClick={() => act('DELETE')} disabled={busy}>Kaldır</button>}
            <button className="adm-btn adm-btn-primary" onClick={() => act('POST')} disabled={busy}>
              {busy ? 'İşleniyor…' : connected ? 'Eksikleri kur' : "Webhook'u kur"}
            </button>
          </div>
        </>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Ayarlar (IBAN)                                                      */
/* ------------------------------------------------------------------ */
const SETTINGS_FIELDS = [
  ['iban', 'IBAN', 'TR00 0000 0000 0000 0000 0000 00'],
  ['account_holder', 'Alıcı adı soyadı', 'Ad Soyad'],
  ['bank_name', 'Banka', 'Banka adı'],
];

const SettingsView = ({ me }) => {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'payment'))
      .then((s) => {
        const d = s.exists() ? s.data() : {};
        const clean = { iban: d.iban || '', account_holder: d.account_holder || '', bank_name: d.bank_name || '', iban_note: d.iban_note || '' };
        setForm(clean);
        setSaved(clean);
      })
      .catch((err) => toast.error('Ayarlar okunamadı: ' + err.code));
  }, []);

  if (!form) return <Empty>Yükleniyor…</Empty>;

  const save = async (e) => {
    e.preventDefault();
    const data = {
      iban: form.iban.replace(/\s+/g, ' ').trim().toUpperCase(),
      account_holder: form.account_holder.trim(),
      bank_name: form.bank_name.trim(),
      iban_note: form.iban_note.trim(),
      updated_at: serverTimestamp(),
    };
    const changed = ['iban', 'account_holder', 'bank_name', 'iban_note'].filter((k) => data[k] !== saved[k]);
    if (!changed.length) return toast('Değişiklik yok');
    setSaving(true);
    try {
      await loggedWrite({
        me, mode: 'set', collectionName: 'settings', id: 'payment', targetType: 'settings', action: 'update',
        data,
        summary: `Havale/IBAN ayarları güncellendi (${changed.map((k) => ({ iban: 'IBAN', account_holder: 'alıcı', bank_name: 'banka', iban_note: 'not' })[k]).join(', ')})`,
      });
      const { updated_at: _u, ...rest } = data;
      setSaved(rest);
      setForm(rest);
      toast.success('Ayarlar kaydedildi');
    } catch (err) {
      toast.error('Kaydedilemedi: ' + (err.code || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-split">
      <form className="adm-card adm-card-pad" onSubmit={save}>
        <h2 className="adm-card-title">Havale / EFT bilgileri</h2>
        <p className="adm-muted adm-help">
          Müşteri ödeme penceresinde “Havale / EFT” seçip siparişi oluşturunca bu bilgiler gösterilir.
          IBAN boşsa havale seçeneği kapalı görünür.
        </p>
        {SETTINGS_FIELDS.map(([k, label, ph]) => (
          <label key={k} className="adm-field">
            <span className="adm-label">{label}</span>
            <input className="adm-input" value={form[k]} placeholder={ph} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
          </label>
        ))}
        <label className="adm-field">
          <span className="adm-label">Müşteriye not (opsiyonel)</span>
          <textarea className="adm-input" rows={3} value={form.iban_note} placeholder="Ödemeyi yaptıktan sonra dekontu Discord ticket ile ilet…" onChange={(e) => setForm((f) => ({ ...f, iban_note: e.target.value }))} />
        </label>
        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-primary" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </form>

      <ShopierConnection />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Kayıtlar (işlem logu)                                               */
/* ------------------------------------------------------------------ */
const ACTION_META = {
  create: { label: 'Ekleme', tone: 'ok' },
  update: { label: 'Düzenleme', tone: 'info' },
  status: { label: 'Durum', tone: 'warn' },
  delete: { label: 'Silme', tone: 'bad' },
  login: { label: 'Giriş', tone: 'muted' },
};
const TYPE_LABEL = { product: 'Ürün', category: 'Kategori', order: 'Sipariş', admin: 'Yönetici', session: 'Oturum', settings: 'Ayarlar' };

const Logs = () => {
  const [logs, ready] = useCollection('admin_logs', 'at', 'desc', 500);
  const [actor, setActor] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const actors = [...new Set(logs.map((l) => l.actor_nick))].sort();

  const shown = logs.filter(
    (l) =>
      (!actor || l.actor_nick === actor) &&
      (!type || l.target_type === type) &&
      (!search || l.summary?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <section className="adm-card">
      <header className="adm-card-head adm-card-head-wrap">
        <div className="adm-toolbar">
          <label className="adm-search">
            <Search size={15} />
            <input placeholder="Kayıtlarda ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select className="adm-input adm-input-sm" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Tüm yöneticiler</option>
            {actors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="adm-input adm-input-sm" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tüm türler</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <span className="adm-muted">Son 500 kayıt · kayıtlar silinemez</span>
      </header>
      {!ready ? (
        <Empty>Yükleniyor…</Empty>
      ) : shown.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Zaman</th><th>Yönetici</th><th>İşlem</th><th>Açıklama</th></tr>
            </thead>
            <tbody>
              {shown.map((l) => {
                const m = ACTION_META[l.action] || { label: l.action, tone: 'muted' };
                return (
                  <tr key={l.id}>
                    <td className="adm-muted adm-nowrap">{fmtDate(l.at)}</td>
                    <td><strong>{l.actor_nick}</strong></td>
                    <td className="adm-nowrap">
                      <span className={`adm-pill adm-pill-${m.tone}`}>{m.label}</span>{' '}
                      <span className="adm-muted">{TYPE_LABEL[l.target_type] || l.target_type}</span>
                    </td>
                    <td>{l.summary}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Kayıt yok.</Empty>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Kabuk                                                               */
/* ------------------------------------------------------------------ */
const NAV = [
  { id: 'overview', label: 'Genel bakış', icon: LayoutDashboard },
  { id: 'orders', label: 'Siparişler', icon: ShoppingBag },
  { id: 'products', label: 'Ürünler', icon: Package },
  { id: 'categories', label: 'Kategoriler', icon: FolderTree },
  { id: 'payments', label: 'Ödemeler', icon: CreditCard },
  { id: 'admins', label: 'Yöneticiler', icon: UserCog },
  { id: 'logs', label: 'Kayıtlar', icon: ScrollText },
  { id: 'settings', label: 'Ayarlar', icon: Settings },
];

const AdminDashboard = ({ admin }) => {
  const [me, setMe] = useState(admin);
  useEffect(() => {
    logAdminLogin(admin).catch((err) => console.error('Giriş logu yazılamadı', err));
  }, [admin]);

  const [view, setView] = useState(() => sessionStorage.getItem('adm_view') || 'overview');
  const [orderFilter, setOrderFilter] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  const [orders, ordersReady] = useCollection('orders', 'created_at', 'desc', 500);
  const [products] = useCollection('products', 'created_at', 'desc');
  const [categories] = useCollection('categories', 'name', 'asc');

  const go = (v, filter = null) => {
    setView(v);
    setOrderFilter(filter);
    setNavOpen(false);
    sessionStorage.setItem('adm_view', v);
  };

  const actionCount = orders.filter((o) => o.status === 'Waiting for Confirmation' || o.status === 'paid').length;
  const current = NAV.find((n) => n.id === view) || NAV[0];

  return (
    <div className="adm-shell">
      <aside className={`adm-side ${navOpen ? 'open' : ''}`}>
        <div className="adm-brand">
          <img src="/logo.webp" alt="" />
          <div>
            <strong>RGX</strong>
            <span>Yönetim</span>
          </div>
        </div>
        <nav className="adm-nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? 'on' : ''} onClick={() => go(id)}>
              <Icon size={17} />
              <span>{label}</span>
              {id === 'orders' && actionCount > 0 && <em>{actionCount}</em>}
            </button>
          ))}
        </nav>
        <div className="adm-side-foot">
          <Link to="/" className="adm-nav-link"><ExternalLink size={15} /> Siteyi aç</Link>
          <div className="adm-user">
            <span className="adm-avatar">{me.nickname?.[0]?.toUpperCase()}</span>
            <span className="adm-ellipsis">{me.nickname}</span>
          </div>
          <button className="adm-btn adm-btn-ghost adm-btn-block" onClick={() => signOut(auth)}>
            <LogOut size={15} /> Çıkış
          </button>
        </div>
      </aside>
      {navOpen && <div className="adm-side-backdrop" onClick={() => setNavOpen(false)} />}

      <main className="adm-main">
        <header className="adm-top">
          <button className="adm-icon-btn adm-menu-btn" onClick={() => setNavOpen(true)} aria-label="Menü"><Menu size={18} /></button>
          <h1>{current.label}</h1>
          {!ordersReady && <span className="adm-muted">Yükleniyor…</span>}
          {ordersReady && view !== 'orders' && actionCount > 0 && (
            <button className="adm-pill adm-pill-warn adm-pill-btn" onClick={() => go('orders', 'action')}>
              <CheckCircle2 size={13} /> {actionCount} sipariş işlem bekliyor
            </button>
          )}
        </header>

        <div className="adm-content">
          {view === 'overview' && <Overview orders={orders} products={products} categories={categories} go={go} />}
          {view === 'orders' && <Orders key={orderFilter || 'all'} orders={orders} initialFilter={orderFilter} me={me} />}
          {view === 'products' && <Products products={products} categories={categories} me={me} />}
          {view === 'categories' && <Categories categories={categories} products={products} me={me} />}
          {view === 'admins' && <Admins me={me} onNickChange={(nickname) => setMe((m) => ({ ...m, nickname }))} />}
          {view === 'logs' && <Logs />}
          {view === 'payments' && <Payments orders={orders} />}
          {view === 'settings' && <SettingsView me={me} />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
