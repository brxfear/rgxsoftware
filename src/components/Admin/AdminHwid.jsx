// Admin → HWID istekleri: müşteri ve bayilerin açtığı HWID sıfırlama talepleri.
// Sıfırlamayı key sisteminde yapıp burada "Onayla" ile kapatırsın; not müşteriye/bayiye görünür.
import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Check, X, Copy } from 'lucide-react';
import { db } from '../../lib/firebase';
import { toDate } from '../../lib/db';
import { loggedWrite } from '../../lib/adminLog';

const ST = { pending: ['Bekliyor', 'warn'], approved: ['Onaylandı', 'ok'], rejected: ['Reddedildi', 'bad'] };

const AdminHwid = ({ me }) => {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'hwid_requests'), orderBy('created_at', 'desc'), limit(300)),
        (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => toast.error('Talepler okunamadı: ' + err.code),
      ),
    [],
  );

  const act = async (r, status) => {
    setBusy(r.id);
    try {
      const note = (notes[r.id] || '').trim().slice(0, 300);
      await loggedWrite({
        me, mode: 'update', collectionName: 'hwid_requests', id: r.id, targetType: 'hwid', action: 'status',
        data: { status, admin_note: note || (status === 'approved' ? 'HWID sıfırlandı.' : 'Talep reddedildi.'), handled_by: me.nickname, handled_at: serverTimestamp() },
        summary: `HWID talebi ${status === 'approved' ? 'onaylandı' : 'reddedildi'}: ${r.product_name || ''} ${r.key.slice(0, 6)}…`,
      });
      toast.success(status === 'approved' ? 'Onaylandı' : 'Reddedildi');
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setBusy(null);
    }
  };

  const shown = (list || []).filter((r) => filter === 'all' || r.status === filter);
  const pending = (list || []).filter((r) => r.status === 'pending').length;

  return (
    <section className="adm-card">
      <div className="adm-card-head adm-card-pad">
        <div>
          <h2 className="adm-card-title">HWID sıfırlama talepleri</h2>
          <p className="adm-muted">{pending} bekleyen talep. Sıfırlamayı key/loader sisteminde yaptıktan sonra burada onayla.</p>
        </div>
        <div className="adm-seg">
          {[['pending', 'Bekleyen'], ['approved', 'Onaylanan'], ['rejected', 'Reddedilen'], ['all', 'Tümü']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {list === null ? (
        <p className="adm-muted adm-card-pad">Yükleniyor…</p>
      ) : !shown.length ? (
        <p className="adm-muted adm-card-pad">Talep yok.</p>
      ) : (
        <ul className="adm-ann-list adm-hwid-list">
          {shown.map((r) => (
            <li key={r.id}>
              <div className="adm-hwid-main">
                <div className="adm-hwid-top">
                  <span className={`adm-pill adm-pill-${ST[r.status]?.[1] || 'muted'}`}>{ST[r.status]?.[0] || r.status}</span>
                  <span className="adm-pill adm-pill-muted">{r.source === 'reseller' ? 'Bayi' : 'Müşteri'}</span>
                  <strong>{r.product_name || '—'}</strong>
                  <small className="adm-muted">{toDate(r.created_at)?.toLocaleString('tr-TR') || '—'}</small>
                </div>
                <div className="adm-hwid-key">
                  <code>{r.key}</code>
                  <button className="adm-icon-btn" onClick={() => { navigator.clipboard?.writeText(r.key); toast.success('Kopyalandı'); }} aria-label="Kopyala"><Copy size={13} /></button>
                </div>
                {r.reason && <p className="adm-muted">Sebep: {r.reason}</p>}
                {r.status !== 'pending' && r.admin_note && <p className="adm-muted">Yanıt ({r.handled_by}): {r.admin_note}</p>}
                {r.status === 'pending' && (
                  <input className="adm-input" placeholder="Not (müşteri görür, opsiyonel)" value={notes[r.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                )}
              </div>
              {r.status === 'pending' && (
                <div className="adm-ann-actions">
                  <button className="adm-btn adm-btn-primary" disabled={busy === r.id} onClick={() => act(r, 'approved')}><Check size={14} /> Onayla</button>
                  <button className="adm-btn adm-btn-ghost" disabled={busy === r.id} onClick={() => act(r, 'rejected')}><X size={14} /> Reddet</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default AdminHwid;
