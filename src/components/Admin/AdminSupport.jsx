// Admin → Destek: müşterilerin açtığı talepler; yanıtla, kapat.
import React, { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, RotateCcw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { toDate } from '../../lib/db';
import { Thread } from '../Support/Tickets';
import '../Support/tickets.css';

const ST = { open: ['Yanıt bekliyor', 'warn'], answered: ['Yanıtlandı', 'ok'], closed: ['Kapalı', 'muted'] };
const CAT = { product: 'Ürün / kurulum', payment: 'Ödeme', hwid: 'HWID / lisans', reseller: 'Bayilik / medya', other: 'Diğer' };

const AdminSupport = ({ me }) => {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState('open');
  const [openId, setOpenId] = useState(null);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'tickets'), orderBy('updated_at', 'desc'), limit(300)),
        (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => toast.error('Talepler okunamadı: ' + err.code),
      ),
    [],
  );

  const current = list?.find((x) => x.id === openId);

  useEffect(() => {
    if (current?.unread_admin) {
      const b = writeBatch(db);
      b.update(doc(db, 'tickets', current.id), { unread_admin: false });
      b.commit().catch(() => {});
    }
  }, [current]);

  const reply = async (text) => {
    const b = writeBatch(db);
    b.set(doc(collection(db, 'tickets', current.id, 'messages')), { from: 'admin', nick: me.nickname, text: text.slice(0, 3000), at: serverTimestamp() });
    b.update(doc(db, 'tickets', current.id), { status: 'answered', last_from: 'admin', unread_user: true, unread_admin: false, updated_at: serverTimestamp() });
    await b.commit();
  };
  const setStatus = async (status) => {
    const b = writeBatch(db);
    b.update(doc(db, 'tickets', current.id), { status, updated_at: serverTimestamp() });
    await b.commit();
    toast.success(status === 'closed' ? 'Talep kapatıldı' : 'Talep yeniden açıldı');
  };

  if (current) {
    return (
      <section className="adm-card adm-card-pad">
        <div className="tk-head">
          <button className="adm-btn adm-btn-ghost" onClick={() => setOpenId(null)}><ArrowLeft size={15} /> Talepler</button>
          <div>
            <strong>{current.subject}</strong>
            <span className={`adm-pill adm-pill-${ST[current.status]?.[1]}`}>{ST[current.status]?.[0]}</span>
          </div>
          {current.status !== 'closed' ? (
            <button className="adm-btn adm-btn-ghost" onClick={() => setStatus('closed')}><CheckCircle2 size={15} /> Kapat</button>
          ) : (
            <button className="adm-btn adm-btn-ghost" onClick={() => setStatus('open')}><RotateCcw size={15} /> Yeniden aç</button>
          )}
        </div>
        <p className="adm-muted adm-help">
          {current.name || '—'} · {current.email} · {CAT[current.category] || current.category}
          {current.product_name ? ` · ${current.product_name}` : ''}
          {current.order_ref ? ` · sipariş ${current.order_ref}` : ''}
        </p>
        <Thread ticketId={current.id} viewer="admin" onSend={reply} />
      </section>
    );
  }

  const shown = (list || []).filter((x) => filter === 'all' || x.status === filter);
  const waiting = (list || []).filter((x) => x.status === 'open').length;

  return (
    <section className="adm-card">
      <div className="adm-card-head adm-card-pad">
        <div>
          <h2 className="adm-card-title">Destek talepleri</h2>
          <p className="adm-muted">{waiting} talep yanıt bekliyor. Yanıtların müşterinin panelinde (Hesabım → Destek) görünür.</p>
        </div>
        <div className="adm-seg">
          {[['open', 'Bekleyen'], ['answered', 'Yanıtlanan'], ['closed', 'Kapalı'], ['all', 'Tümü']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {list === null ? (
        <p className="adm-muted adm-card-pad">Yükleniyor…</p>
      ) : !shown.length ? (
        <p className="adm-muted adm-card-pad">Talep yok.</p>
      ) : (
        <div className="tk-list adm-card-pad" style={{ paddingTop: 0 }}>
          {shown.map((x) => (
            <button key={x.id} className={`tk-item ${x.unread_admin ? 'unread' : ''}`} onClick={() => setOpenId(x.id)}>
              <span className={`adm-pill adm-pill-${ST[x.status]?.[1]}`}>{ST[x.status]?.[0]}</span>
              <span className="tk-item-main">
                <strong>{x.subject}</strong>
                <small>{x.name || x.email} · {CAT[x.category] || x.category}{x.product_name ? ` · ${x.product_name}` : ''}</small>
              </span>
              <time>{toDate(x.updated_at)?.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) || '…'}</time>
              {x.unread_admin && <i className="tk-dot" />}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default AdminSupport;
