// /reseller — Bayi paneli: bakiye, key çıkarma, lisanslar, cüzdan (Shopier), işlemler, HWID reset, rehber.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query, where, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import {
  LayoutDashboard, Package, Plus, KeyRound, Wallet, ArrowLeftRight, BookOpen, Gavel, MessageCircle, User, Cpu, LogIn,
  Copy, Check, Search, ExternalLink, Loader2, Sparkles, CalendarClock, TrendingUp, ShieldCheck, LogOut, Download, PackageCheck,
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { toDate } from '../../lib/db';
import { fmtTry, loadUsdTry, usdToTry } from '../../lib/currency';
import { openPaymentWindow } from '../../lib/shopierWindow';
import { usePageTitle } from '../../lib/usePageTitle';
import { useShopStore, useDiscordUrl } from '../../store/useShopStore';
import StatusPill from '../../components/StatusPill';
import { useT } from '../../i18n';
import './reseller.css';

const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const L = {
  tr: {
    title: 'Bayi paneli', sell: 'Satış', money: 'Para', help: 'Yardım', account: 'Hesap',
    dashboard: 'Panel', products: 'Ürünler & fiyatlar', generate: 'Key oluştur', licenses: 'Lisanslarım', wallet: 'Cüzdan',
    transactions: 'İşlemler', hwid: 'HWID reset', guides: 'Rehber', rules: 'Bayi kuralları', discord: 'Discord', accountTab: 'Hesap',
    reseller: 'BAYİ', balance: 'Bakiye', topup: 'Bakiye yükle', genKeys: 'Key oluştur',
    morning: 'Günaydın', afternoon: 'İyi günler', evening: 'İyi akşamlar',
    soldWeek: 'Bu hafta {n} key çıkardın.', enoughFor: '{n} adet en ucuz key’e yeter', keysWeek: 'Bu hafta', today: 'Bugün', month: 'Bu ay',
    unlimited: 'sınırsız', left: 'kalan {n}', quick: 'Hızlı işlemler', recent: 'Son keyler', noKeys: 'Henüz key çıkarmadın.',
    qaGen: 'Yeni lisans çıkar', qaTop: 'Shopier ile kartla', qaFind: 'Keylerinde ara', qaHwid: 'Sıfırlama talebi aç',
    product: 'Ürün', plan: 'Plan', yourPrice: 'Senin fiyatın', retail: 'Satış fiyatı', margin: 'Kâr', stock: 'Stok', outOfStock: 'Stok yok',
    discount: 'Bayi indirimin: %{n}', qty: 'Adet', note: 'Not / müşteri (opsiyonel)', notePh: 'ör. Discord: kullanıcı#1234', total: 'Toplam',
    create: 'Oluştur', creating: 'Oluşturuluyor…', created: '{n} key oluşturuldu', copyAll: 'Hepsini kopyala', copied: 'Kopyalandı',
    limitNote: 'Günlük limit: {d} · Aylık limit: {m}', choose: 'Ürün seç', searchPh: 'Key, ürün ya da not ara…',
    date: 'Tarih', price: 'Fiyat', amount: 'Tutar', balAfter: 'Sonraki bakiye', noTx: 'Henüz işlem yok.',
    txTypes: { topup: 'Yükleme', purchase: 'Key alımı', adjust: 'Düzeltme' },
    topupTitle: 'Shopier ile bakiye yükle', topupSub: 'Kredi/banka kartıyla öde; ödeme onaylanınca bakiyene otomatik eklenir.',
    custom: 'Özel tutar', pay: 'Öde', minTop: 'En az {n}', chargedTry: 'Kartından yaklaşık {amount} çekilir (güncel kur).',
    waiting: 'Ödeme bekleniyor… Shopier penceresinde ödemeyi tamamla.', paid: 'Bakiye yüklendi!', reopen: 'Ödeme penceresini aç',
    hwidTitle: 'HWID sıfırlama talebi', hwidSub: 'Müşterin bilgisayar değiştirdiyse ya da format attıysa keyini seç, talep aç.',
    key: 'Key', reason: 'Sebep', reasonPh: 'ör. Müşteri anakart değiştirdi', send: 'Talep gönder', sent: 'Talep gönderildi',
    myRequests: 'Taleplerim', noRequests: 'Henüz talep yok.', st: { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' },
    noGuide: 'Rehber henüz eklenmedi. Sorularını Discord’dan iletebilirsin.', noRules: 'Kurallar henüz eklenmedi.',
    loginTitle: 'Bayi paneli', loginSub: 'Bayi hesabınla giriş yap.', notReseller: 'Bu hesap bir bayi hesabı değil.',
    notResellerSub: 'Bayi olmak istiyorsan Discord’dan bize yaz.', suspended: 'Bayi hesabın askıya alındı. Destekle iletişime geç.',
    logout: 'Çıkış yap', memberSince: 'Bayi: {date}', totalKeys: 'Toplam key', totalSpent: 'Toplam harcama', loader: 'Loader',
    allUp: 'Tüm ürünler aktif', someDown: '{n} üründe bakım var',
    preorder: 'Stok yok · sipariş verilebilir', backorderNote: 'Stokta {n} key var. Sipariş verirsen bakiyen şimdi düşer, ekibimiz keyleri kısa sürede teslim eder (Lisanslarım’da görünür). Teslim edilemezse tutar iade edilir.',
    orderBtn: 'Sipariş ver', ordered: 'Siparişin alındı! Keyler teslim edilince Lisanslarım’da görünecek.', orderPending: 'Teslim bekliyor', orderCanceled: 'İptal · iade edildi',
    signupTitle: 'RGX bayisi ol', signupSub: 'Bayi hesabını hemen aç: bakiye yükle, keyleri bayi fiyatıyla çıkar, kendi müşterilerine sat.',
    signupPerks: ['Satış fiyatının altında bayi fiyatları', 'Anında key çıkarma, stok ve limitler panelde', 'Shopier ile kartla bakiye yükleme', 'HWID reset ve destek tek yerden'],
    signupName: 'Bayi adın', signupNamePh: 'ör. Mağaza ya da Discord adın', signupAccept: 'Bayi kurallarını okudum ve kabul ediyorum.',
    signupBtn: 'Bayiliğimi oluştur', signupDone: 'Bayi hesabın açıldı!', signupClosed: 'Bayi başvuruları şu an kapalı. Bilgi için Discord’dan yazabilirsin.',  },
  en: {
    title: 'Reseller panel', sell: 'Sell', money: 'Money', help: 'Help', account: 'Account',
    dashboard: 'Dashboard', products: 'Products & prices', generate: 'Generate', licenses: 'Licenses', wallet: 'Wallet',
    transactions: 'Transactions', hwid: 'HWID reset', guides: 'Guides', rules: 'Reseller rules', discord: 'Discord', accountTab: 'Account',
    reseller: 'RESELLER', balance: 'Balance', topup: 'Top up', genKeys: 'Generate keys',
    morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
    soldWeek: 'You’ve generated {n} keys this week.', enoughFor: 'Enough for {n} of the cheapest key', keysWeek: 'This week', today: 'Today', month: 'This month',
    unlimited: 'unlimited', left: '{n} left', quick: 'Quick actions', recent: 'Recent keys', noKeys: 'No keys yet.',
    qaGen: 'Create new licenses', qaTop: 'Card via Shopier', qaFind: 'Search your keys', qaHwid: 'Open a reset request',
    product: 'Product', plan: 'Plan', yourPrice: 'Your price', retail: 'Retail', margin: 'Margin', stock: 'Stock', outOfStock: 'Out of stock',
    discount: 'Your reseller discount: {n}%', qty: 'Quantity', note: 'Note / customer (optional)', notePh: 'e.g. Discord: user#1234', total: 'Total',
    create: 'Generate', creating: 'Generating…', created: '{n} keys generated', copyAll: 'Copy all', copied: 'Copied',
    limitNote: 'Daily limit: {d} · Monthly limit: {m}', choose: 'Choose a product', searchPh: 'Search key, product or note…',
    date: 'Date', price: 'Price', amount: 'Amount', balAfter: 'Balance after', noTx: 'No transactions yet.',
    txTypes: { topup: 'Top up', purchase: 'Key purchase', adjust: 'Adjustment' },
    topupTitle: 'Top up with Shopier', topupSub: 'Pay by card; your balance updates automatically once the payment is confirmed.',
    custom: 'Custom amount', pay: 'Pay', minTop: 'Min {n}', chargedTry: 'About {amount} will be charged to your card (live rate).',
    waiting: 'Waiting for payment… complete it in the Shopier window.', paid: 'Balance topped up!', reopen: 'Open payment window',
    hwidTitle: 'HWID reset request', hwidSub: 'If your customer changed PC or reinstalled Windows, pick the key and open a request.',
    key: 'Key', reason: 'Reason', reasonPh: 'e.g. Customer changed motherboard', send: 'Send request', sent: 'Request sent',
    myRequests: 'My requests', noRequests: 'No requests yet.', st: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' },
    noGuide: 'No guide yet. Ask us on Discord.', noRules: 'No rules yet.',
    loginTitle: 'Reseller panel', loginSub: 'Sign in with your reseller account.', notReseller: 'This account is not a reseller.',
    notResellerSub: 'Want to become a reseller? Message us on Discord.', suspended: 'Your reseller account is suspended. Contact support.',
    logout: 'Sign out', memberSince: 'Reseller since {date}', totalKeys: 'Total keys', totalSpent: 'Total spent', loader: 'Loader',
    allUp: 'All products online', someDown: '{n} products under maintenance',
    preorder: 'Out of stock · order available', backorderNote: 'Only {n} keys in stock. If you order, your balance is charged now and our team delivers the keys shortly (shown in Licenses). If we cannot deliver, you get a refund.',
    orderBtn: 'Place order', ordered: 'Order received! Keys appear in Licenses once delivered.', orderPending: 'Awaiting delivery', orderCanceled: 'Canceled · refunded',
    signupTitle: 'Become an RGX reseller', signupSub: 'Open your reseller account now: top up, generate keys at reseller prices and sell to your own customers.',
    signupPerks: ['Reseller prices below retail', 'Instant key generation, stock and limits in your panel', 'Top up by card via Shopier', 'HWID resets and support in one place'],
    signupName: 'Reseller name', signupNamePh: 'e.g. your shop or Discord name', signupAccept: 'I have read and accept the reseller rules.',
    signupBtn: 'Create my reseller account', signupDone: 'Your reseller account is ready!', signupClosed: 'Reseller sign-ups are closed right now. Message us on Discord.',  },
};

const NAV = [
  ['sell', [['dashboard', LayoutDashboard], ['products', Package], ['generate', Plus], ['licenses', KeyRound]]],
  ['money', [['wallet', Wallet], ['transactions', ArrowLeftRight]]],
  ['help', [['hwid', Cpu], ['guides', BookOpen], ['rules', Gavel]]],
  ['account', [['account', User]]],
];

const api = async (method, action, body, params = '') => {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(`/api/reseller?action=${action}${params}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(d?.error || `Hata (${r.status})`), { status: r.status });
  return d;
};

const CopyBtn = ({ text, label }) => {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="rs-copy"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1400);
      }}
      aria-label="copy"
    >
      {ok ? <Check size={14} /> : <Copy size={14} />} {label}
    </button>
  );
};

const Meter = ({ label, used, max, s }) => {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  return (
    <div className="rs-meter">
      <div className="rs-meter-top"><span>{label}</span><strong>{used}{max > 0 ? ` / ${max}` : ''}</strong></div>
      <div className="rs-meter-bar"><i style={{ width: max > 0 ? `${pct}%` : '0%' }} className={pct >= 90 ? 'hot' : ''} /></div>
      <small>{max > 0 ? s.left.replace('{n}', Math.max(0, max - used)) : s.unlimited}</small>
    </div>
  );
};

/* ===================================================================== */
const ResellerPage = () => {
  const { lang } = useT();
  const s = L[lang] || L.tr;
  const f = (k, vars = {}) => Object.entries(vars).reduce((str, [a, b]) => str.replace(`{${a}}`, b), s[k] || k);
  const { tab = 'dashboard' } = useParams();
  const navigate = useNavigate();
  usePageTitle(s.title);
  const user = useShopStore((st) => st.user);
  const authReady = useShopStore((st) => st.authReady);
  const discordUrl = useDiscordUrl();

  const [me, setMe] = useState(null); // { reseller, catalog, info }
  const [err, setErr] = useState(null);
  const [keys, setKeys] = useState(null);
  const [txs, setTxs] = useState(null);
  const [reqs, setReqs] = useState(null);
  const [orders, setOrders] = useState(null);

  const load = useCallback(async () => {
    try {
      setMe(await api('GET', 'me'));
      setErr(null);
    } catch (e) {
      setErr(e);
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    api('GET', 'me').then((d) => { setMe(d); setErr(null); }).catch(setErr);
    const u1 = onSnapshot(query(collection(db, 'reseller_keys'), where('reseller_id', '==', user.uid), orderBy('created_at', 'desc'), limit(300)), (sn) => setKeys(sn.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setKeys([]));
    const u2 = onSnapshot(query(collection(db, 'reseller_tx'), where('reseller_id', '==', user.uid), orderBy('at', 'desc'), limit(200)), (sn) => setTxs(sn.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setTxs([]));
    const u3 = onSnapshot(query(collection(db, 'hwid_requests'), where('uid', '==', user.uid), orderBy('created_at', 'desc'), limit(100)), (sn) => setReqs(sn.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setReqs([]));
    const u4 = onSnapshot(query(collection(db, 'reseller_orders'), where('reseller_id', '==', user.uid), orderBy('created_at', 'desc'), limit(50)), (sn) => setOrders(sn.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setOrders([]));
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [user]);

  if (!authReady) return <div className="page container"><div className="empty-state">…</div></div>;
  if (!user) {
    return (
      <div className="page container">
        <div className="ap-login">
          <img src="/logo.webp" alt="" width="72" height="72" />
          <h1>{s.loginTitle}</h1>
          <p>{s.loginSub}</p>
          <button className="btn-primary" onClick={() => useShopStore.getState().openAuth()}><LogIn size={16} /> {s.loginTitle}</button>
        </div>
      </div>
    );
  }
  if (err && err.status === 403 && !/askı|suspend/i.test(err.message)) {
    return (
      <Signup
        s={s}
        discordUrl={discordUrl}
        onDone={() => api('GET', 'me').then((d) => { setMe(d); setErr(null); useShopStore.setState({ reseller: { uid: user.uid } }); }).catch(setErr)}
      />
    );
  }
  if (err) {
    return (
      <div className="page container">
        <div className="ap-login">
          <img src="/logo.webp" alt="" width="72" height="72" />
          <h1>{err.status === 403 && /askı|suspend/i.test(err.message) ? s.suspended : s.notReseller}</h1>
          <p>{s.notResellerSub}</p>
          <a className="btn-primary" href={discordUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Discord</a>
        </div>
      </div>
    );
  }
  if (!me) return <div className="page container"><div className="empty-state"><Loader2 className="spin" size={20} /></div></div>;

  const r = me.reseller;
  const current = NAV.flatMap(([, items]) => items).some(([k]) => k === tab) ? tab : 'dashboard';
  const go = (t) => navigate(t === 'dashboard' ? '/reseller' : `/reseller/${t}`);
  const ctx = { s, f, me, r, keys, txs, reqs, orders, load, go, user, discordUrl };

  return (
    <div className="page rs">
      <aside className="rs-side">
        <div className="rs-brand">
          <img src="/logo.webp" alt="" />
          <div><strong>RGX</strong><span>{s.reseller} PANEL</span></div>
        </div>
        {NAV.map(([group, items]) => (
          <div key={group} className="rs-group">
            <span className="rs-group-label">{s[group]}</span>
            {items.map(([k, Icon]) => (
              <NavLink key={k} to={k === 'dashboard' ? '/reseller' : `/reseller/${k}`} end className={() => (current === k ? 'on' : '')}>
                <span className="rs-ico"><Icon size={16} /></span> {s[k === 'account' ? 'accountTab' : k]}
              </NavLink>
            ))}
            {group === 'help' && (
              <a href={discordUrl} target="_blank" rel="noopener noreferrer"><span className="rs-ico"><MessageCircle size={16} /></span> {s.discord} <ExternalLink size={12} className="rs-ext" /></a>
            )}
          </div>
        ))}
        <div className="rs-me">
          <span className="rs-avatar">{(r.display_name || '?')[0].toUpperCase()}</span>
          <div><strong>{r.display_name}</strong><small>{usd(r.balance_usd)}</small></div>
        </div>
      </aside>

      <main className="rs-main">
        <header className="rs-top">
          <h1>{s[current === 'account' ? 'accountTab' : current]}</h1>
          <div className="rs-top-actions">
            <button className="rs-btn rs-btn-red" onClick={() => go('generate')}><Plus size={15} /> {s.create}</button>
            <button className="rs-btn rs-btn-ghost" onClick={() => go('wallet')}><Wallet size={15} /> {usd(r.balance_usd)}</button>
          </div>
        </header>

        {current === 'dashboard' && <Dashboard {...ctx} />}
        {current === 'products' && <Products {...ctx} />}
        {current === 'generate' && <Generate {...ctx} />}
        {current === 'licenses' && <Licenses {...ctx} />}
        {current === 'wallet' && <WalletTab {...ctx} />}
        {current === 'transactions' && <Transactions {...ctx} />}
        {current === 'hwid' && <Hwid {...ctx} />}
        {current === 'guides' && <TextPage text={me.info.guide} empty={s.noGuide} />}
        {current === 'rules' && <TextPage text={me.info.rules} empty={s.noRules} />}
        {current === 'account' && <AccountTab {...ctx} />}
      </main>
    </div>
  );
};

/* ---------------- Bayi ol ---------------- */
const Signup = ({ s, discordUrl, onDone }) => {
  const user = useShopStore((st) => st.user);
  const [info, setInfo] = useState(null);
  const [name, setName] = useState(user?.displayName || '');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('GET', 'signup').then(setInfo).catch(() => setInfo({ open: false }));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('POST', 'signup', { display_name: name, accept_rules: accept });
      toast.success(s.signupDone);
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page container">
      <div className="rs-signup">
        <div className="rs-signup-intro">
          <span className="rs-eyebrow">{s.reseller}</span>
          <h1>{s.signupTitle}</h1>
          <p>{s.signupSub}</p>
          <ul>
            {s.signupPerks.map((x) => <li key={x}><ShieldCheck size={15} /> {x}</li>)}
          </ul>
        </div>
        {info === null ? (
          <div className="rs-card"><Loader2 className="spin" size={18} /></div>
        ) : !info.open ? (
          <div className="rs-card">
            <p>{s.signupClosed}</p>
            <a className="rs-btn rs-btn-red" href={discordUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Discord</a>
          </div>
        ) : (
          <form className="rs-card rs-gen" onSubmit={submit}>
            <label className="rs-field">
              <span>{s.signupName}</span>
              <input value={name} maxLength={40} minLength={2} required onChange={(e) => setName(e.target.value)} placeholder={s.signupNamePh} />
            </label>
            {info.rules && <div className="rs-signup-rules">{info.rules}</div>}
            <label className="rs-check">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>{s.signupAccept}</span>
            </label>
            <button className="rs-btn rs-btn-red rs-btn-lg" disabled={busy || !accept || name.trim().length < 2}>
              {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} {s.signupBtn}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

/* ---------------- Panel ---------------- */const Dashboard = ({ s, f, me, r, keys, go }) => {
  const { lang } = useT();
  const [now] = useState(() => Date.now());
  const hour = new Date(now).getHours();
  const greet = hour < 12 ? s.morning : hour < 18 ? s.afternoon : s.evening;
  const weekAgo = now - 7 * 864e5;
  const week = (keys || []).filter((k) => (toDate(k.created_at)?.getTime() || now) > weekAgo).length;
  const cheapest = Math.min(...me.catalog.flatMap((p) => p.plans.filter((pl) => pl.stock > 0).map((pl) => pl.price_usd)), Infinity);
  const down = me.catalog.filter((p) => !['undetected', 'testing'].includes(p.status)).length;

  return (
    <div className="rs-stack">
      <div className={`rs-strip ${down ? 'warn' : ''}`}>
        <span className="st-pill st-ok st-pill-sm" style={down ? { color: '#fbbf24' } : undefined}><span className="st-dot" /> {down ? 'MAINTENANCE' : 'UNDETECTED'}</span>
        <span>{down ? f('someDown', { n: down }) : s.allUp}</span>
        <Link to="/status">{lang === 'tr' ? 'Durum sayfası' : 'Status page'} <ExternalLink size={12} /></Link>
      </div>

      <section className="rs-hero">
        <div className="rs-hero-art"><Sparkles size={34} /></div>
        <div className="rs-hero-text">
          <span className="rs-eyebrow">{s.reseller}</span>
          <h2>{greet}, {r.display_name}.</h2>
          <p>{f('soldWeek', { n: week })}</p>
        </div>
        <div className="rs-hero-bal">
          <span className="rs-eyebrow">{s.balance}</span>
          <strong>{usd(r.balance_usd)}</strong>
          <div>
            <button className="rs-btn rs-btn-red" onClick={() => go('generate')}>{s.genKeys}</button>
            <button className="rs-btn rs-btn-ghost" onClick={() => go('wallet')}>{s.topup}</button>
          </div>
        </div>
      </section>

      <div className="rs-stats">
        <div className="rs-stat">
          <span className="rs-eyebrow">{s.balance}</span>
          <strong>{usd(r.balance_usd)}</strong>
          <small>{Number.isFinite(cheapest) ? f('enoughFor', { n: Math.floor(r.balance_usd / cheapest) }) : '—'}</small>
        </div>
        <div className="rs-stat">
          <span className="rs-eyebrow">{s.keysWeek}</span>
          <strong>{week}</strong>
          <small>{s.totalKeys}: {r.total_keys}</small>
        </div>
        <div className="rs-stat rs-stat-meters">
          <Meter label={s.today} used={r.usage.day_count} max={r.daily_limit} s={s} />
          <Meter label={s.month} used={r.usage.month_count} max={r.monthly_limit} s={s} />
        </div>
      </div>

      <h3 className="rs-h3">{s.quick}</h3>
      <div className="rs-quick">
        {[
          ['generate', Plus, s.genKeys, s.qaGen],
          ['wallet', Wallet, s.topup, s.qaTop],
          ['licenses', Search, s.licenses, s.qaFind],
          ['hwid', Cpu, s.hwid, s.qaHwid],
        ].map(([k, Icon, title, sub]) => (
          <button key={k} className="rs-qa" onClick={() => go(k)}>
            <span className="rs-qa-ico"><Icon size={17} /></span>
            <span><strong>{title}</strong><small>{sub}</small></span>
          </button>
        ))}
      </div>

      <h3 className="rs-h3">{s.recent}</h3>
      <KeyTable keys={(keys || []).slice(0, 6)} s={s} loading={keys === null} />
    </div>
  );
};

const KeyTable = ({ keys, s, loading }) => {
  const { lang } = useT();
  if (loading) return <div className="rs-empty"><Loader2 className="spin" size={18} /></div>;
  if (!keys.length) return <div className="rs-empty"><KeyRound size={22} /><p>{s.noKeys}</p></div>;
  return (
    <div className="rs-table">
      {keys.map((k) => (
        <div key={k.id} className="rs-row">
          <div className="rs-row-main">
            <code>{k.key}</code>
            <span>{k.product_name} · {k.plan_label}{k.note ? ` · ${k.note}` : ''}</span>
          </div>
          <span className="rs-row-meta">{usd(k.price_usd)}<small>{toDate(k.created_at)?.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) || '—'}</small></span>
          <CopyBtn text={k.key} />
        </div>
      ))}
    </div>
  );
};

/* ---------------- Ürünler & fiyatlar ---------------- */
const Products = ({ s, f, me, r, go }) => (
  <div className="rs-stack">
    {r.discount_pct > 0 && <div className="rs-note"><TrendingUp size={15} /> {f('discount', { n: r.discount_pct })}</div>}
    {me.catalog.map((p) => (
      <section key={p.id} className="rs-card">
        <div className="rs-prod-head">
          <img src={p.image_url || '/logo.webp'} alt="" />
          <div><span className="rs-eyebrow">{p.category}</span><strong>{p.name}</strong></div>
          <StatusPill status={['undetected', 'testing', 'updating', 'detected'].includes(p.status) ? p.status : 'undetected'} />
          {p.loader_url && <a className="rs-btn rs-btn-ghost" href={p.loader_url} target="_blank" rel="noopener noreferrer"><Download size={14} /> {s.loader}</a>}
        </div>
        <div className="rs-plan-table">
          <div className="rs-plan-row rs-plan-headrow"><span>{s.plan}</span><span>{s.yourPrice}</span><span>{s.retail}</span><span>{s.margin}</span><span>{s.stock}</span><span /></div>
          {p.plans.map((pl) => (
            <div key={pl.id} className="rs-plan-row">
              <span>{pl.label}</span>
              <strong>{usd(pl.price_usd)}</strong>
              <span className="muted">{usd(pl.retail_usd)}</span>
              <span className="ok">{usd(pl.retail_usd - pl.price_usd)}</span>
              <span className={pl.stock ? '' : 'bad'}>{pl.stock || s.outOfStock}</span>
              <button className="rs-btn rs-btn-red rs-btn-sm" onClick={() => go(`generate?p=${p.id}&pl=${pl.id}`)}>{s.create}</button>
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);

/* ---------------- Key oluştur ---------------- */
const Generate = ({ s, f, me, r, load }) => {
  const params = new URLSearchParams(window.location.search);
  const [pid, setPid] = useState(params.get('p') || me.catalog[0]?.id || '');
  const product = me.catalog.find((p) => p.id === pid);
  const [plid, setPlid] = useState(params.get('pl') || product?.plans.find((x) => x.stock)?.id || product?.plans[0]?.id || '');
  const plan = product?.plans.find((x) => x.id === plid);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const dayLeft = r.daily_limit > 0 ? r.daily_limit - r.usage.day_count : Infinity;
  const monthLeft = r.monthly_limit > 0 ? r.monthly_limit - r.usage.month_count : Infinity;
  // Stok yetmezse sipariş verilebilir (ekip keyleri sonradan teslim eder); limit ve bakiye yine geçerli
  const maxQty = Math.max(0, Math.min(50, dayLeft, monthLeft, plan ? Math.floor((r.balance_usd + 1e-9) / plan.price_usd) : 0));
  const backorder = !!plan && qty > (plan.stock || 0);
  const total = plan ? plan.price_usd * qty : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!plan) return;
    setBusy(true);
    try {
      const out = await api('POST', 'generate', { product_id: pid, plan_id: plid, quantity: qty, note, backorder });
      if (out.pending) {
        setResult(null);
        toast.success(s.ordered, { duration: 6000 });
      } else {
        setResult(out.keys);
        toast.success(f('created', { n: out.keys.length }));
      }
      setNote('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-stack">
      <form className="rs-card rs-gen" onSubmit={submit}>
        <label className="rs-field">
          <span>{s.product}</span>
          <select value={pid} onChange={(e) => { setPid(e.target.value); const p = me.catalog.find((x) => x.id === e.target.value); setPlid(p?.plans.find((x) => x.stock)?.id || p?.plans[0]?.id || ''); setQty(1); }}>
            {me.catalog.map((p) => <option key={p.id} value={p.id}>{p.category ? `${p.category} · ` : ''}{p.name}</option>)}
          </select>
        </label>
        {product && (
          <div className="rs-field">
            <span>{s.plan}</span>
            <div className="rs-plan-pick">
              {product.plans.map((pl) => (
                <button type="button" key={pl.id} className={`${pl.id === plid ? 'on' : ''} ${pl.stock ? '' : 'nostock'}`} onClick={() => { setPlid(pl.id); setQty(1); }}>
                  <strong>{pl.label}</strong>
                  <span>{usd(pl.price_usd)}</span>
                  <small>{pl.stock ? `${s.stock}: ${pl.stock}` : s.preorder}</small>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="rs-grid-2">
          <label className="rs-field">
            <span>{s.qty}</span>
            <input type="number" min={1} max={Math.max(1, maxQty)} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(Math.max(1, maxQty), parseInt(e.target.value, 10) || 1)))} />
          </label>
          <label className="rs-field">
            <span>{s.note}</span>
            <input value={note} maxLength={120} placeholder={s.notePh} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        {backorder && <div className="rs-note rs-note-warn"><PackageCheck size={15} /> {f('backorderNote', { n: plan.stock || 0 })}</div>}
        <p className="rs-muted">{f('limitNote', { d: r.daily_limit ? `${r.usage.day_count}/${r.daily_limit}` : s.unlimited, m: r.monthly_limit ? `${r.usage.month_count}/${r.monthly_limit}` : s.unlimited })}</p>
        <div className="rs-gen-foot">
          <div><span className="rs-muted">{s.total}</span><strong>{usd(total)}</strong><small className="rs-muted">{s.balance}: {usd(r.balance_usd)}</small></div>
          <button className="rs-btn rs-btn-red rs-btn-lg" disabled={busy || !plan || !maxQty || qty > maxQty}>
            {busy ? <><Loader2 size={16} className="spin" /> {s.creating}</> : backorder ? <><PackageCheck size={16} /> {s.orderBtn}</> : <><KeyRound size={16} /> {s.create}</>}
          </button>
        </div>
      </form>

      {result && (
        <section className="rs-card rs-result">
          <div className="rs-result-head">
            <strong><ShieldCheck size={16} /> {f('created', { n: result.length })}</strong>
            <CopyBtn text={result.map((k) => k.key).join('\n')} label={s.copyAll} />
          </div>
          {result.map((k) => (
            <div key={k.id} className="rs-result-key"><code>{k.key}</code><CopyBtn text={k.key} /></div>
          ))}
        </section>
      )}
    </div>
  );
};

/* ---------------- Lisanslar ---------------- */
const Licenses = ({ s, keys, orders }) => {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (keys || []).filter((k) => !t || [k.key, k.product_name, k.plan_label, k.note].some((x) => String(x || '').toLowerCase().includes(t)));
  }, [keys, q]);
  return (
    <div className="rs-stack">
      <label className="rs-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.searchPh} /></label>
      {orders?.filter((o) => o.status !== 'fulfilled').length > 0 && (
        <div className="rs-table">
          {orders.filter((o) => o.status !== 'fulfilled').map((o) => (
            <div key={o.id} className="rs-row">
              <span className={`rs-req-st st-${o.status === 'pending' ? 'pending' : 'rejected'}`}>{o.status === 'pending' ? s.orderPending : s.orderCanceled}</span>
              <div className="rs-row-main"><span className="rs-tx-note">{o.quantity} × {o.product_name} ({o.plan_label})</span><small>{o.note}{o.cancel_reason ? ` · ${o.cancel_reason}` : ''}</small></div>
              <span className="rs-row-meta">{usd(o.cost_usd)}</span>
            </div>
          ))}
        </div>
      )}
      <KeyTable keys={list} s={s} loading={keys === null} />
    </div>
  );
};

/* ---------------- Cüzdan ---------------- */
const WalletTab = ({ s, f, me, r, load }) => {
  const [amount, setAmount] = useState(25);
  const [rate, setRate] = useState(null);
  const [pending, setPending] = useState(null); // { id, url }
  const [busy, setBusy] = useState(false);
  const popup = useRef(null);
  const min = me.info.min_topup_usd || 5;

  useEffect(() => {
    loadUsdTry().then(setRate);
  }, []);

  useEffect(() => {
    if (!pending) return undefined;
    let alive = true;
    let timer;
    const tick = async () => {
      try {
        const st = await api('GET', 'topup-status', null, `&id=${pending.id}`);
        if (!alive) return;
        if (st.status === 'paid') {
          toast.success(s.paid);
          try {
            popup.current?.close();
          } catch {
            /* yoksay */
          }
          setPending(null);
          load();
          return;
        }
        if (st.status === 'failed') {
          setPending(null);
          return;
        }
      } catch {
        /* tekrar dene */
      }
      if (alive) timer = setTimeout(tick, 4000);
    };
    timer = setTimeout(tick, 4000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pending, load, s.paid]);

  const pay = async () => {
    if (!(amount >= min)) return toast.error(f('minTop', { n: usd(min) }));
    setBusy(true);
    const win = openPaymentWindow('…');
    try {
      const out = await api('POST', 'topup', { amount_usd: amount });
      if (win && !win.closed) win.location.href = out.url;
      else window.open(out.url, '_blank', 'noopener');
      popup.current = win;
      setPending({ id: out.order_id, url: out.url });
    } catch (err) {
      try {
        win?.close();
      } catch {
        /* yoksay */
      }
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-stack">
      <section className="rs-hero rs-hero-sm">
        <div className="rs-hero-text">
          <span className="rs-eyebrow">{s.balance}</span>
          <h2>{usd(r.balance_usd)}</h2>
          <p>{s.totalSpent}: {usd(r.total_spent_usd)} · {s.totalKeys}: {r.total_keys}</p>
        </div>
      </section>
      <section className="rs-card">
        <h3 className="rs-h3" style={{ marginTop: 0 }}>{s.topupTitle}</h3>
        <p className="rs-muted">{s.topupSub}</p>
        <div className="rs-amounts">
          {[10, 25, 50, 100, 250].filter((a) => a >= min).map((a) => (
            <button key={a} className={amount === a ? 'on' : ''} onClick={() => setAmount(a)}>{usd(a)}</button>
          ))}
          <label className="rs-amount-custom">
            <span>$</span>
            <input type="number" min={min} step="1" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} aria-label={s.custom} />
          </label>
        </div>
        {rate && <p className="rs-muted">{f('chargedTry', { amount: fmtTry(usdToTry(amount, rate)) })}</p>}
        {pending ? (
          <div className="rs-waiting">
            <Loader2 size={18} className="spin" /> {s.waiting}
            <button className="rs-btn rs-btn-ghost rs-btn-sm" onClick={() => { popup.current = openPaymentWindow(null, pending.url) || popup.current; }}>{s.reopen}</button>
          </div>
        ) : (
          <button className="rs-btn rs-btn-red rs-btn-lg" onClick={pay} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Wallet size={16} />} {s.pay} {usd(amount)}</button>
        )}
      </section>
    </div>
  );
};

/* ---------------- İşlemler ---------------- */
const Transactions = ({ s, txs }) => {
  const { lang } = useT();
  if (txs === null) return <div className="rs-empty"><Loader2 className="spin" size={18} /></div>;
  if (!txs.length) return <div className="rs-empty"><ArrowLeftRight size={22} /><p>{s.noTx}</p></div>;
  return (
    <div className="rs-table">
      {txs.map((t) => (
        <div key={t.id} className="rs-row">
          <span className={`rs-tx-type t-${t.type}`}>{s.txTypes[t.type] || t.type}</span>
          <div className="rs-row-main"><span className="rs-tx-note">{t.note}</span><small>{toDate(t.at)?.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB') || '—'}</small></div>
          <span className={`rs-amt ${t.amount_usd >= 0 ? 'pos' : 'neg'}`}>{t.amount_usd >= 0 ? '+' : '−'}{usd(Math.abs(t.amount_usd))}<small>{s.balAfter}: {usd(t.balance_after)}</small></span>
        </div>
      ))}
    </div>
  );
};

/* ---------------- HWID ---------------- */
const Hwid = ({ s, keys, reqs, user }) => {
  const { lang } = useT();
  const [key, setKey] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    const k = (keys || []).find((x) => x.key === key);
    if (!k) return toast.error(s.key);
    setBusy(true);
    try {
      await addDoc(collection(db, 'hwid_requests'), {
        uid: user.uid,
        source: 'reseller',
        key: k.key,
        product_id: k.product_id,
        product_name: k.product_name,
        reason: reason.trim().slice(0, 500),
        status: 'pending',
        created_at: serverTimestamp(),
      });
      toast.success(s.sent);
      setKey('');
      setReason('');
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rs-stack">
      <form className="rs-card" onSubmit={send}>
        <h3 className="rs-h3" style={{ marginTop: 0 }}>{s.hwidTitle}</h3>
        <p className="rs-muted">{s.hwidSub}</p>
        <label className="rs-field">
          <span>{s.key}</span>
          <select value={key} onChange={(e) => setKey(e.target.value)} required>
            <option value="">—</option>
            {(keys || []).map((k) => <option key={k.id} value={k.key}>{k.key} · {k.product_name}{k.note ? ` · ${k.note}` : ''}</option>)}
          </select>
        </label>
        <label className="rs-field">
          <span>{s.reason}</span>
          <input value={reason} maxLength={500} placeholder={s.reasonPh} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button className="rs-btn rs-btn-red" disabled={busy || !key}>{busy ? <Loader2 size={15} className="spin" /> : <Cpu size={15} />} {s.send}</button>
      </form>
      <h3 className="rs-h3">{s.myRequests}</h3>
      <HwidList reqs={reqs} s={s} lang={lang} />
    </div>
  );
};

const HwidList = ({ reqs, s, lang }) => {
  if (reqs === null) return <div className="rs-empty"><Loader2 className="spin" size={18} /></div>;
  if (!reqs.length) return <div className="rs-empty"><Cpu size={22} /><p>{s.noRequests}</p></div>;
  return (
    <div className="rs-table">
      {reqs.map((q) => (
        <div key={q.id} className="rs-row">
          <span className={`rs-req-st st-${q.status}`}>{s.st[q.status] || q.status}</span>
          <div className="rs-row-main">
            <code>{q.key}</code>
            <span>{q.product_name}{q.reason ? ` · ${q.reason}` : ''}</span>
            {q.admin_note && <span className="rs-admin-note">↳ {q.admin_note}</span>}
          </div>
          <small className="rs-muted"><CalendarClock size={12} /> {toDate(q.created_at)?.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB') || '—'}</small>
        </div>
      ))}
    </div>
  );
};

const TextPage = ({ text, empty }) => <section className="rs-card rs-text">{text ? text : <p className="rs-muted">{empty}</p>}</section>;

const AccountTab = ({ s, f, r }) => {
  const { lang } = useT();
  const navigate = useNavigate();
  const since = r.created_at ? new Date(r.created_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB') : '—';
  return (
    <div className="rs-stack">
      <section className="rs-card rs-account">
        <span className="rs-avatar rs-avatar-lg">{(r.display_name || '?')[0].toUpperCase()}</span>
        <div>
          <strong>{r.display_name}</strong>
          <span>{r.email}</span>
          <small>{f('memberSince', { date: since })}</small>
        </div>
      </section>
      <div className="rs-stats">
        <div className="rs-stat"><span className="rs-eyebrow">{s.totalKeys}</span><strong>{r.total_keys}</strong></div>
        <div className="rs-stat"><span className="rs-eyebrow">{s.totalSpent}</span><strong>{usd(r.total_spent_usd)}</strong></div>
        <div className="rs-stat"><span className="rs-eyebrow">{s.discount.split(':')[0]}</span><strong>%{r.discount_pct}</strong></div>
      </div>
      <button
        className="rs-btn rs-btn-ghost"
        style={{ alignSelf: 'flex-start' }}
        onClick={async () => {
          await signOut(auth);
          navigate('/');
        }}
      >
        <LogOut size={15} /> {s.logout}
      </button>
    </div>
  );
};

export default ResellerPage;
