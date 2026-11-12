import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection,
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
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth, db } from '../../lib/firebase';
import { toDate, getStartPrice } from '../../lib/db';
import { fileToCompressedDataUrl } from './imageUtils';
import { loggedWrite, adminIdForEmail, logAdminLogin } from '../../lib/adminLog';
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
];

const statusMeta = (value = '') => {
  const found = ORDER_STATUSES.find((s) => s.value === value);
  if (found) return found;
  if (value.startsWith('failed')) return { value, label: 'Ödeme başarısız', tone: 'bad' };
  return { value, label: value || '—', tone: 'muted' };
};

const REVENUE_STATUSES = ['paid', 'Completed'];

const tl = (n) =>
  '₺' + (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

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

const docBytes = (obj) => new Blob([JSON.stringify(obj)]).size;
const MAX_DOC_BYTES = 950 * 1024;

const FIELD_LABELS = {
  name: 'ad', description: 'açıklama', details: 'detaylar', category_id: 'kategori',
  price_1day: '1 gün fiyatı', price_7day: '7 gün fiyatı', price_30day: '30 gün fiyatı', price_lifetime: 'sınırsız fiyatı',
  image_url: 'kapak görseli', video_url: 'video', extra_images: 'ek görseller', is_available: 'satış durumu', slug: 'slug',
};

/** Değişen alanları okunur bir özete çevirir (görseller için sadece "değişti"). */
const changeSummary = (before = {}, after = {}) => {
  const parts = [];
  Object.keys(FIELD_LABELS).forEach((k) => {
    if (!(k in after)) return;
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a ?? '') === JSON.stringify(b ?? '')) return;
    if (['image_url', 'extra_images', 'details', 'description'].includes(k)) parts.push(`${FIELD_LABELS[k]} değişti`);
    else if (k === 'is_available') parts.push(b ? 'satışa açıldı' : 'gizlendi');
    else parts.push(`${FIELD_LABELS[k]}: ${a ?? '—'} → ${b ?? '—'}`);
  });
  return parts.join(', ') || 'değişiklik yok';
};

const orderLabel = (o) => `#${(o.merchant_oid || o.id).slice(-6)} (${o.customer_name || 'isimsiz'}, ${tl(o.total_amount)})`;

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
  const revenue = orders.filter((o) => REVENUE_STATUSES.includes(o.status)).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const waiting = orders.filter((o) => o.status === 'Waiting for Confirmation' || o.status === 'paid');
  const today = new Date().toDateString();
  const todayCount = orders.filter((o) => toDate(o.created_at)?.toDateString() === today).length;

  const cards = [
    { icon: Wallet, label: 'Toplam ciro', value: tl(revenue), sub: 'Ödenen + teslim edilen' },
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
                    <td className="adm-num">{tl(o.total_amount)}</td>
                    <td><StatusPill status={o.status} /></td>
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
                  <span className="adm-num">{tl(o.total_amount)}</span>
                  <StatusPill status={o.status} />
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
                            <td className="adm-num">{tl(i.subtotal ?? i.price * i.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="adm-order-actions">
                      <span className="adm-label">Durumu değiştir</span>
                      <div className="adm-chips">
                        {ORDER_STATUSES.map((s) => (
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
  category_id: '',
  price_1day: '',
  price_7day: '',
  price_30day: '',
  price_lifetime: '',
  image_url: '',
  video_url: '',
  extra_images: [],
  is_available: true,
};

const ProductForm = ({ initial, categories, onClose, me }) => {
  const [form, setForm] = useState(() => ({
    ...EMPTY_PRODUCT,
    ...initial,
    price_1day: String(initial?.price_1day || initial?.price || ''),
    price_7day: String(initial?.price_7day || ''),
    price_30day: String(initial?.price_30day || ''),
    price_lifetime: String(initial?.price_lifetime || ''),
    extra_images: initial?.extra_images || [],
  }));
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
    const prices = ['price_1day', 'price_7day', 'price_30day', 'price_lifetime'].map((k) => parseFloat(form[k]) || 0);
    if (!prices.some((p) => p > 0)) return toast.error('En az bir plan fiyatı gir.');

    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      details: form.details,
      category_id: form.category_id,
      price_1day: prices[0],
      price_7day: prices[1],
      price_30day: prices[2],
      price_lifetime: prices[3],
      price: prices.find((p) => p > 0),
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
          summary: `Ürün "${data.name}" eklendi (${catName(data.category_id)}, başlangıç ${tl(Math.min(...prices.filter((p) => p > 0)))})`,
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

          <div className="adm-field">
            <span className="adm-label">Plan fiyatları (₺) — boş bırakılan plan satılmaz</span>
            <div className="adm-grid-4">
              {[
                ['price_1day', '1 Gün'],
                ['price_7day', '7 Gün'],
                ['price_30day', '30 Gün'],
                ['price_lifetime', 'Sınırsız'],
              ].map(([k, l]) => (
                <label key={k} className="adm-price-input">
                  <small>{l}</small>
                  <input className="adm-input" type="number" min="0" step="0.01" inputMode="decimal" value={form[k]} onChange={set(k)} />
                </label>
              ))}
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
                    {[['1G', p.price_1day || p.price], ['7G', p.price_7day], ['30G', p.price_30day], ['∞', p.price_lifetime]]
                      .filter(([, v]) => v > 0)
                      .map(([k, v]) => <span key={k}>{k} {tl(v)}</span>)}
                  </td>
                  <td className="adm-num">{tl(getStartPrice(p))}</td>
                  <td>
                    <button className={`adm-pill adm-pill-${p.is_available === false ? 'muted' : 'ok'} adm-pill-btn`} onClick={() => toggle(p)} title="Satış durumunu değiştir">
                      {p.is_available === false ? <><EyeOff size={12} /> Gizli</> : <><Eye size={12} /> Satışta</>}
                    </button>
                  </td>
                  <td className="adm-row-actions">
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
    if (!EMAIL_RE.test(email.trim())) return toast.error('Geçerli bir Google e-posta adresi yaz.');
    if (!NICK_RE.test(nickname)) return toast.error('Takma ad 2-24 karakter olmalı.');
    setSaving(true);
    try {
      const id = await adminIdForEmail(email);
      if (admins.some((a) => a.id === id)) {
        toast.error('Bu hesap zaten yönetici.');
        return;
      }
      await loggedWrite({
        me, mode: 'set', collectionName: 'admins', id, targetType: 'admin',
        data: { nickname, added_by_nick: me.nickname, created_at: serverTimestamp() },
        summary: `"${nickname}" yönetici olarak eklendi`,
      });
      toast.success(`${nickname} yönetici olarak eklendi`);
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
            Eklediğin Google hesabı <strong>/admin</strong> sayfasında “Google ile giriş yap” dediğinde panele girer.
            E-posta kaydedilmez; sadece şifrelenmiş özeti tutulur ve panelde takma ad görünür.
          </p>
          <label className="adm-field">
            <span className="adm-label">Google e-posta adresi</span>
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
/* Kayıtlar (işlem logu)                                               */
/* ------------------------------------------------------------------ */
const ACTION_META = {
  create: { label: 'Ekleme', tone: 'ok' },
  update: { label: 'Düzenleme', tone: 'info' },
  status: { label: 'Durum', tone: 'warn' },
  delete: { label: 'Silme', tone: 'bad' },
  login: { label: 'Giriş', tone: 'muted' },
};
const TYPE_LABEL = { product: 'Ürün', category: 'Kategori', order: 'Sipariş', admin: 'Yönetici', session: 'Oturum' };

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
  { id: 'admins', label: 'Yöneticiler', icon: UserCog },
  { id: 'logs', label: 'Kayıtlar', icon: ScrollText },
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
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
