// Destek talepleri (müşteri): talep aç, yazış, kapat. Yönetici panelden yanıtlar.
import React, { useEffect, useRef, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Loader2, MessageSquarePlus, Send, LifeBuoy, CheckCircle2, Wrench, CreditCard, Cpu, Briefcase, CircleHelp, Clock, ChevronRight } from 'lucide-react';
import { db } from '../../lib/firebase';
import { toDate } from '../../lib/db';
import { useT } from '../../i18n';
import { useDiscordUrl } from '../../store/useShopStore';
import './tickets.css';

const CATS = ['product', 'payment', 'hwid', 'reseller', 'other'];
const CAT_ICON = { product: Wrench, payment: CreditCard, hwid: Cpu, reseller: Briefcase, other: CircleHelp };

export const Thread = ({ ticketId, viewer, onSend }) => {
  const { t, lang } = useT();
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'tickets', ticketId, 'messages'), orderBy('at', 'asc'), limit(300)),
        (s) => setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setMsgs([]),
      ),
    [ticketId],
  );
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [msgs]);

  const send = async (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setBusy(true);
    try {
      await onSend(v);
      setText('');
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tk-thread">
      <div className="tk-msgs">
        {msgs === null ? (
          <Loader2 className="spin" size={18} />
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={`tk-row ${m.from === viewer ? 'mine' : ''}`}>
              {m.from === 'admin' && <img src="/logo.webp" alt="" className="tk-avatar" />}
              <div className={`tk-msg ${m.from === viewer ? 'mine' : ''} from-${m.from}`}>
                <span className="tk-msg-who">{m.from === 'admin' ? `RGX · ${m.nick || t('support.team')}` : t('support.you')}</span>
                <p>{m.text}</p>
                <time>{toDate(m.at)?.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) || '…'}</time>
              </div>
            </div>
          ))
        )}
        <div ref={end} />
      </div>
      <form className="tk-reply" onSubmit={send}>
        <textarea rows={2} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('support.replyPh')} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e); }} />
        <button className="tk-send" disabled={busy || !text.trim()} aria-label={t('support.send')}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />}</button>
      </form>
    </div>
  );
};

const NewTicket = ({ user, products, initialCat, onCreated, onCancel }) => {
  const { t } = useT();
  const [f, setF] = useState({ subject: '', category: initialCat || 'product', product_name: '', order_ref: '', text: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ref = doc(collection(db, 'tickets'));
      const batch = writeBatch(db);
      batch.set(ref, {
        uid: user.uid,
        name: (user.displayName || user.email?.split('@')[0] || '').slice(0, 60),
        email: user.email || '',
        subject: f.subject.trim().slice(0, 120),
        category: f.category,
        product_name: f.product_name.slice(0, 80),
        order_ref: f.order_ref.trim().slice(0, 40),
        status: 'open',
        last_from: 'user',
        unread_admin: true,
        unread_user: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      batch.set(doc(collection(db, 'tickets', ref.id, 'messages')), { from: 'user', text: f.text.trim().slice(0, 3000), at: serverTimestamp() });
      await batch.commit();
      toast.success(t('support.created'));
      onCreated(ref.id);
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="ap-panel tk-new" onSubmit={submit}>
      <div className="tk-cats tk-cats-sm" role="radiogroup" aria-label={t('support.category')}>
        {CATS.map((c) => {
          const Icon = CAT_ICON[c];
          return (
            <button type="button" key={c} role="radio" aria-checked={f.category === c} className={`tk-cat ${f.category === c ? 'on' : ''}`} onClick={() => setF((x) => ({ ...x, category: c }))}>
              <Icon size={16} /> <span>{t(`support.cats.${c}`)}</span>
            </button>
          );
        })}
      </div>
      <div className="tk-new-grid">
        <label className="acc-label">{t('support.product')}
          <select className="acc-input" value={f.product_name} onChange={set('product_name')}>
            <option value="">—</option>
            {products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </label>
        <label className="acc-label">{t('support.orderRef')}
          <input className="acc-input" value={f.order_ref} maxLength={40} onChange={set('order_ref')} placeholder="#A1B2C3D4" />
        </label>
      </div>
      <label className="acc-label">{t('support.subject')}
        <input className="acc-input" value={f.subject} maxLength={120} required onChange={set('subject')} placeholder={t('support.subjectPh')} />
      </label>
      <label className="acc-label">{t('support.message')}
        <textarea className="acc-input tk-textarea" rows={5} maxLength={3000} required value={f.text} onChange={set('text')} placeholder={t('support.messagePh')} />
      </label>
      <div className="acc-row">
        <button type="button" className="acc-btn acc-btn-ghost" onClick={onCancel}>{t('account.cancel')}</button>
        <button className="acc-btn acc-btn-primary" disabled={busy || !f.subject.trim() || !f.text.trim()}>{busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />} {t('support.send')}</button>
      </div>
    </form>
  );
};

/** Müşteri paneli → Destek sekmesi */
const Tickets = ({ user, products }) => {
  const { t, lang } = useT();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(null);
  const discordUrl = useDiscordUrl();

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'tickets'), where('uid', '==', user.uid), orderBy('updated_at', 'desc'), limit(50)),
        (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setList([]),
      ),
    [user.uid],
  );

  const current = list?.find((x) => x.id === open);

  // Açılan talebin "okunmadı" işaretini kaldır
  useEffect(() => {
    if (current?.unread_user) {
      writeBatch(db).update(doc(db, 'tickets', current.id), { unread_user: false, last_from: 'user', updated_at: current.updated_at || serverTimestamp() }).commit().catch(() => {});
    }
  }, [current]);

  const sendUser = async (text) => {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'tickets', current.id, 'messages')), { from: 'user', text: text.slice(0, 3000), at: serverTimestamp() });
    batch.update(doc(db, 'tickets', current.id), { status: 'open', last_from: 'user', unread_admin: true, unread_user: false, updated_at: serverTimestamp() });
    await batch.commit();
  };
  const close = async () => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'tickets', current.id), { status: 'closed', last_from: 'user', updated_at: serverTimestamp() });
    await batch.commit();
    toast.success(t('support.closed'));
  };

  const ST = { open: ['warn', t('support.st.open')], answered: ['ok', t('support.st.answered')], closed: ['muted', t('support.st.closed')] };

  if (creating) return <NewTicket user={user} products={products} initialCat={creating === true ? null : creating} onCancel={() => setCreating(null)} onCreated={(id) => { setCreating(null); setOpen(id); }} />;

  if (current) {
    return (
      <div className="tk-wrap">
        <button className="tk-back" onClick={() => setOpen(null)}><ArrowLeft size={15} /> {t('support.back')}</button>
        <div className="tk-head">
          <div className="tk-head-main">
            <strong>{current.subject}</strong>
            <small>
              {t(`support.cats.${current.category}`)}{current.product_name ? ` · ${current.product_name}` : ''}{current.order_ref ? ` · ${t('support.orderShort')} ${current.order_ref}` : ''}
            </small>
          </div>
          <span className={`acc-pill acc-pill-${ST[current.status]?.[0]}`}>{ST[current.status]?.[1]}</span>
          {current.status !== 'closed' && <button className="ap-btn-ghost" onClick={close}><CheckCircle2 size={15} /> {t('support.close')}</button>}
        </div>
        <Thread ticketId={current.id} viewer="user" onSend={sendUser} />
      </div>
    );
  }

  return (
    <div className="tk-wrap">
      <section className="tk-hero">
        <div>
          <h2>{t('support.helpTitle')}</h2>
          <p>{t('support.helpSub')}</p>
          <div className="tk-hero-actions">
            <button className="ap-btn-primary" onClick={() => setCreating(true)}><MessageSquarePlus size={16} /> {t('support.new')}</button>
            <a className="ap-btn-ghost" href={discordUrl} target="_blank" rel="noopener noreferrer">{t('support.discord')}</a>
          </div>
        </div>
        <div className="tk-hero-meta"><Clock size={16} /><span>{t('support.reply')}</span><strong>{t('support.replyTime')}</strong></div>
      </section>

      <h3 className="tk-h3">{t('support.pick')}</h3>
      <div className="tk-cats">
        {CATS.map((c) => {
          const Icon = CAT_ICON[c];
          return (
            <button key={c} className="tk-cat" onClick={() => setCreating(c)}>
              <span className="tk-cat-ico"><Icon size={18} /></span>
              <strong>{t(`support.cats.${c}`)}</strong>
              <small>{t(`support.catSub.${c}`)}</small>
            </button>
          );
        })}
      </div>

      <h3 className="tk-h3">{t('support.mine')}</h3>
      {list === null ? (
        <p className="acc-muted">{t('account.loading')}</p>
      ) : !list.length ? (
        <div className="ap-empty"><LifeBuoy size={22} /><p>{t('support.none')}</p></div>
      ) : (
        <div className="tk-list">
          {list.map((x) => {
            const Icon = CAT_ICON[x.category] || CircleHelp;
            return (
              <button key={x.id} className={`tk-item st-${x.status} ${x.unread_user ? 'unread' : ''}`} onClick={() => setOpen(x.id)}>
                <span className="tk-item-ico"><Icon size={17} /></span>
                <span className="tk-item-main">
                  <strong>{x.subject}</strong>
                  <small>{t(`support.cats.${x.category}`)}{x.product_name ? ` · ${x.product_name}` : ''} · {toDate(x.updated_at)?.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB') || '…'}</small>
                </span>
                <span className={`acc-pill acc-pill-${ST[x.status]?.[0]}`}>{ST[x.status]?.[1]}</span>
                <ChevronRight size={16} className="tk-chev" />
                {x.unread_user && <i className="tk-dot" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Tickets;

