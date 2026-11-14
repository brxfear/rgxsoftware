import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  signOut,
  updateProfile,
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import {
  LayoutDashboard, Package, KeyRound, MessageCircle, LifeBuoy, Shield, Settings, LogOut, Trash2, Eye, EyeOff,
  BadgeCheck, Store, RefreshCw, ShoppingBag, Wallet, CalendarCheck, Copy, Check, ExternalLink, LogIn, ArrowRight,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth, db } from '../lib/firebase';
import { toDate } from '../lib/db';
import { authErrorMessage } from '../lib/authErrors';
import { useMoney, fmtMoney } from '../lib/currency';
import { usePageTitle } from '../lib/usePageTitle';
import { useCartStore } from '../store/useCartStore';
import { useShopStore, useDiscordUrl } from '../store/useShopStore';
import OrderDelivery from '../components/Account/OrderDelivery';
import GoogleIcon from '../components/GoogleIcon';
import { useT, planLabel } from '../i18n';
import '../components/Account/AccountModal.css';

const STATUS_KEY = {
  'Waiting for Confirmation': ['waiting', 'warn'],
  pending_payment: ['pending', 'muted'],
  paid: ['paid', 'info'],
  Completed: ['done', 'ok'],
  Canceled: ['canceled', 'bad'],
  payment_review: ['review', 'warn'],
};
const statusOf = (s = '', t) => {
  const k = STATUS_KEY[s] || (s.startsWith('failed') ? ['failed', 'bad'] : null);
  return k ? { label: t(`account.status.${k[0]}`), tone: k[1] } : { label: s || '—', tone: 'muted' };
};
const PAID = ['paid', 'Completed'];

const maskEmail = (e = '') => {
  const [u, d = ''] = e.split('@');
  const [host, ...tld] = d.split('.');
  return `${u.slice(0, 2)}•••••@${host.slice(0, 1)}••••.${tld.join('.') || ''}`;
};

const TABS = [
  ['overview', LayoutDashboard],
  ['orders', Package],
  ['keys', KeyRound],
  ['discord', MessageCircle],
  ['support', LifeBuoy],
  ['security', Shield],
  ['settings', Settings],
];

/* ---------------- Sipariş kartı ---------------- */
const OrderCard = ({ o }) => {
  const { t, lang } = useT();
  const st = statusOf(o.status, t);
  const date = toDate(o.created_at)?.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—';
  return (
    <article className="acc-order">
      <div className="acc-order-top">
        <code>#{(o.merchant_oid || o.id).slice(-8)}</code>
        <span className={`acc-pill acc-pill-${st.tone}`}>{st.label}</span>
      </div>
      <ul>
        {(o.items || []).map((i, idx) => (
          <li key={idx}>
            <span>{i.name} <em>· {planLabel(i.durationLabel, lang)}{i.quantity > 1 ? ` × ${i.quantity}` : ''}</em></span>
          </li>
        ))}
      </ul>
      <OrderDelivery delivery={o.delivery} />
      <div className="acc-order-foot">
        <span>{date}</span>
        <strong>{fmtMoney(o.total_amount, o.currency || 'USD')}</strong>
      </div>
    </article>
  );
};

const CopyKey = ({ value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ap-key"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <code>{value}</code>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

/* ---------------- Sekmeler ---------------- */
const Overview = ({ user, orders, onRefresh, refreshing }) => {
  const { t, lang } = useT();
  const { fmt } = useMoney();
  const paid = (orders || []).filter((o) => PAID.includes(o.status));
  const spent = paid.reduce((s, o) => s + (Number(o.total_usd) || 0), 0);
  const keys = paid.reduce((n, o) => n + (o.delivery?.items || []).reduce((m, i) => m + (i.keys?.length || 0), 0), 0);
  const last = toDate((orders || [])[0]?.created_at);
  const first = (user.displayName || user.email || '').split(/[\s@]/)[0];

  const stats = [
    { label: t('acc.statOrders'), value: paid.length, sub: t('acc.statOrdersSub'), icon: ShoppingBag },
    { label: t('acc.statSpent'), value: fmt(spent), icon: Wallet },
    { label: t('acc.statKeys'), value: keys, icon: KeyRound },
    { label: t('acc.statLast'), value: last ? last.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' }) : '—', icon: CalendarCheck },
  ];

  return (
    <>
      <div className="ap-section-head">
        <div>
          <h2>{t('acc.hi', { name: first })}</h2>
          <p>{t('acc.hiSub')}</p>
        </div>
        <button className="ap-btn-ghost" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> {t('acc.refresh')}
        </button>
      </div>

      <div className="ap-hero-card">
        <div className="ap-hero-icon"><Store size={22} /></div>
        <div>
          <span>{t('acc.shopTitle')}</span>
          <strong>{t('acc.shopSub')}</strong>
        </div>
        <Link to="/products" className="ap-btn-light">{t('acc.browse')} <ArrowRight size={16} /></Link>
      </div>

      <div className="ap-stats">
        {stats.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="ap-stat">
            <div className="ap-stat-top"><span>{label}</span><Icon size={16} /></div>
            <strong>{value}</strong>
            {sub && <small>{sub}</small>}
          </div>
        ))}
      </div>

      <h3 className="ap-sub-title">{t('acc.recent')}</h3>
      {orders === null ? (
        <p className="acc-muted">{t('account.loading')}</p>
      ) : orders.length ? (
        <div className="acc-orders">{orders.slice(0, 3).map((o) => <OrderCard key={o.id} o={o} />)}</div>
      ) : (
        <div className="ap-empty">
          <Package size={22} />
          <p>{t('account.noOrders')}</p>
          <Link to="/products" className="ap-btn-ghost">{t('acc.browse')}</Link>
        </div>
      )}
    </>
  );
};

const Orders = ({ orders }) => {
  const { t } = useT();
  return (
    <>
      <div className="ap-section-head"><div><h2>{t('acc.tabs.orders')}</h2><p>{t('acc.ordersSub')}</p></div></div>
      {orders === null ? (
        <p className="acc-muted">{t('account.loading')}</p>
      ) : orders.length ? (
        <div className="acc-orders">{orders.map((o) => <OrderCard key={o.id} o={o} />)}</div>
      ) : (
        <div className="ap-empty"><Package size={22} /><p>{t('account.noOrders')}</p></div>
      )}
    </>
  );
};

const Keys = ({ orders }) => {
  const { t, lang } = useT();
  const rows = (orders || []).flatMap((o) =>
    (o.delivery?.items || []).filter((i) => i.keys?.length || i.link || i.note).map((i) => ({ ...i, order: o })),
  );
  return (
    <>
      <div className="ap-section-head"><div><h2>{t('acc.tabs.keys')}</h2><p>{t('acc.keysSub')}</p></div></div>
      {orders === null ? (
        <p className="acc-muted">{t('account.loading')}</p>
      ) : rows.length ? (
        <div className="ap-keys">
          {rows.map((r, idx) => (
            <div key={idx} className="ap-key-card">
              <div className="ap-key-head">
                <strong>{r.name}</strong>
                <span>{planLabel(r.durationLabel, lang)} · #{(r.order.merchant_oid || r.order.id).slice(-8)}</span>
              </div>
              {(r.keys || []).map((k, j) => <CopyKey key={j} value={k} />)}
              <OrderDelivery delivery={{ items: [{ ...r, keys: [] }] }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="ap-empty"><KeyRound size={22} /><p>{t('acc.noKeys')}</p></div>
      )}
    </>
  );
};

const DiscordTab = () => {
  const { t } = useT();
  const url = useDiscordUrl();
  return (
    <>
      <div className="ap-section-head"><div><h2>Discord</h2><p>{t('acc.discordSub')}</p></div></div>
      <div className="ap-panel ap-discord">
        <MessageCircle size={28} />
        <div>
          <strong>RGX Software</strong>
          <p>{t('acc.discordText')}</p>
        </div>
        <a className="ap-btn-primary" href={url} target="_blank" rel="noopener noreferrer">{t('discord.join')} <ExternalLink size={15} /></a>
      </div>
    </>
  );
};

const Support = () => {
  const { t } = useT();
  const url = useDiscordUrl();
  return (
    <>
      <div className="ap-section-head"><div><h2>{t('acc.tabs.support')}</h2><p>{t('acc.supportSub')}</p></div></div>
      <div className="ap-cards-2">
        <a className="ap-panel ap-link-card" href={url} target="_blank" rel="noopener noreferrer">
          <LifeBuoy size={22} />
          <strong>{t('acc.ticket')}</strong>
          <p>{t('acc.ticketText')}</p>
        </a>
        <Link className="ap-panel ap-link-card" to="/#faq">
          <MessageCircle size={22} />
          <strong>{t('faq.title')}</strong>
          <p>{t('acc.faqText')}</p>
        </Link>
      </div>
    </>
  );
};

const Security = ({ user }) => {
  const { t } = useT();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const isGoogle = !!user.providerData?.some((p) => p.providerId === 'google.com');
  const hasPassword = !!user.providerData?.some((p) => p.providerId === 'password');

  const resetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success(t('auth.resetSent'));
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  };

  const removeAccount = async () => {
    setBusy(true);
    try {
      if (isGoogle) await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
      else if (hasPassword) {
        if (!password) {
          toast.error(t('account.needPassword'));
          return;
        }
        await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(user.email, password));
      }
      await useCartStore.getState().clearCart();
      await deleteUser(auth.currentUser);
      toast.success(t('account.deleted'));
      navigate('/');
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="ap-section-head"><div><h2>{t('acc.tabs.security')}</h2><p>{t('acc.securitySub')}</p></div></div>
      <div className="ap-panel">
        <span className="acc-label">{t('account.method')}</span>
        <div className="acc-providers">
          {isGoogle && <span className="acc-chip"><GoogleIcon /> Google</span>}
          {hasPassword && <span className="acc-chip"><KeyRound size={13} /> {t('account.passwordMethod')}</span>}
        </div>
        {hasPassword && <button type="button" className="acc-link" onClick={resetPassword}>{t('account.sendReset')}</button>}
        {!user.emailVerified && hasPassword && <p className="ap-warn">{t('acc.unverified')}</p>}
      </div>

      <div className="ap-panel">
        <button
          className="acc-btn acc-btn-ghost"
          onClick={async () => {
            await signOut(auth);
            toast.success(t('nav.loggedOut'));
            navigate('/');
          }}
        >
          <LogOut size={15} /> {t('account.logout')}
        </button>
      </div>

      <div className="ap-panel ap-danger">
        {!confirmDelete ? (
          <button className="acc-link acc-link-danger" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> {t('account.delete')}</button>
        ) : (
          <div className="acc-danger-box">
            <p>{t('account.deleteWarn')}</p>
            {!isGoogle && hasPassword && (
              <input className="acc-input" type="password" autoComplete="current-password" placeholder={t('account.passwordConfirm')} value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
            <div className="acc-row">
              <button className="acc-btn acc-btn-ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>{t('account.cancel')}</button>
              <button className="acc-btn acc-btn-danger" onClick={removeAccount} disabled={busy}>
                {busy ? t('account.deleting') : isGoogle ? t('account.deleteGoogle') : t('account.deleteForever')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const SettingsTab = ({ user, onSaved }) => {
  const { t, lang, setLang } = useT();
  const [name, setName] = useState(user.displayName || '');
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim().slice(0, 40) || null });
      onSaved();
      toast.success(t('account.saved'));
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="ap-section-head"><div><h2>{t('acc.tabs.settings')}</h2><p>{t('acc.settingsSub')}</p></div></div>
      <form className="ap-panel" onSubmit={save}>
        <label className="acc-label" htmlFor="ap-name">{t('account.displayName')}</label>
        <div className="acc-row">
          <input id="ap-name" className="acc-input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('account.namePh')} />
          <button className="acc-btn acc-btn-primary" disabled={saving || name.trim() === (user.displayName || '')}>{saving ? t('account.saving') : t('account.save')}</button>
        </div>
      </form>
      <div className="ap-panel">
        <span className="acc-label">{t('account.email')}</span>
        <div className="acc-static">{user.email}</div>
      </div>
      <div className="ap-panel">
        <span className="acc-label">{t('nav.langLabel')}</span>
        <div className="acc-providers">
          {['tr', 'en'].map((l) => (
            <button key={l} className={`acc-chip ap-lang ${lang === l ? 'on' : ''}`} onClick={() => setLang(l)}>{l === 'tr' ? 'Türkçe · ₺' : 'English · $'}</button>
          ))}
        </div>
      </div>
    </>
  );
};

/* ---------------- Sayfa ---------------- */
const AccountPage = () => {
  const { t, lang } = useT();
  const { tab = 'overview' } = useParams();
  usePageTitle(t('account.title'));
  const user = useShopStore((s) => s.user);
  const authReady = useShopStore((s) => s.authReady);
  const [orders, setOrders] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [, setVersion] = useState(0);

  const loadOrders = useCallback(async (uid) => {
    setRefreshing(true);
    try {
      const snap = await getDocs(query(collection(db, 'orders'), where('user_id', '==', uid), orderBy('created_at', 'desc'), limit(100)));
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      setOrders((o) => o || []);
      toast.error(t('account.ordersFailed'));
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) loadOrders(user.uid);
  }, [user, loadOrders]);

  const since = useMemo(() => {
    const d = user?.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;
    return d?.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [user, lang]);

  if (!authReady) return <div className="page container"><div className="empty-state">{t('account.loading')}</div></div>;

  if (!user) {
    return (
      <div className="page container">
        <div className="ap-login">
          <img src="/logo.webp" alt="" width="72" height="72" />
          <h1>{t('acc.loginTitle')}</h1>
          <p>{t('acc.loginSub')}</p>
          <button className="btn-primary" onClick={() => useShopStore.getState().openAuth()}><LogIn size={16} /> {t('nav.login')}</button>
        </div>
      </div>
    );
  }

  const name = user.displayName || user.email?.split('@')[0] || t('account.title');
  const current = TABS.some(([k]) => k === tab) ? tab : 'overview';

  return (
    <div className="page container ap">
      <header className="ap-top">
        <div className="ap-id">
          {user.photoURL ? (
            <img className="ap-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="ap-avatar ap-avatar-letter">{name[0].toUpperCase()}</span>
          )}
          <div>
            <span className="ap-welcome">{t('acc.welcome')}</span>
            <h1>{name}</h1>
            <div className="ap-id-meta">
              <span>{showEmail ? user.email : maskEmail(user.email)}</span>
              <button onClick={() => setShowEmail((s) => !s)} aria-label={t('acc.toggleEmail')}>{showEmail ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              {user.emailVerified && <span className="ap-verified"><BadgeCheck size={14} /> {t('acc.verified')}</span>}
              {since && <span className="ap-since">{t('acc.since', { date: since })}</span>}
            </div>
          </div>
        </div>
        <div className="ap-top-actions">
          <Link to="/products" className="ap-btn-light"><Store size={16} /> {t('acc.browse')}</Link>
        </div>
      </header>

      <div className="ap-body">
        <nav className="ap-side" aria-label={t('account.title')}>
          {TABS.map(([k, Icon]) => (
            <NavLink key={k} to={k === 'overview' ? '/account' : `/account/${k}`} end className={() => (current === k ? 'on' : '')}>
              <Icon size={17} /> <span>{t(`acc.tabs.${k}`)}</span>
              {k === 'security' && !user.emailVerified && user.providerData?.some((p) => p.providerId === 'password') && <i className="ap-dot" />}
            </NavLink>
          ))}
        </nav>

        <section className="ap-main">
          {current === 'overview' && <Overview user={user} orders={orders} refreshing={refreshing} onRefresh={() => loadOrders(user.uid)} />}
          {current === 'orders' && <Orders orders={orders} />}
          {current === 'keys' && <Keys orders={orders} />}
          {current === 'discord' && <DiscordTab />}
          {current === 'support' && <Support />}
          {current === 'security' && <Security user={user} />}
          {current === 'settings' && <SettingsTab user={user} onSaved={() => setVersion((v) => v + 1)} />}
        </section>
      </div>
    </div>
  );
};

export default AccountPage;
