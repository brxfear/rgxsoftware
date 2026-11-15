// Teslim edilmiş siparişe yıldızlı yorum (doğrulanmış alıcı). Sipariş başına bir yorum.
import React, { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Star, Loader2 } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { useT } from '../../i18n';

export const Stars = ({ value, size = 14, onChange }) => (
  <span className={`rv-stars ${onChange ? 'pick' : ''}`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} fill={n <= value ? 'currentColor' : 'none'} className={n <= value ? 'on' : ''} onClick={onChange ? () => onChange(n) : undefined} />
    ))}
  </span>
);

const ReviewForm = ({ order }) => {
  const { t } = useT();
  const [existing, setExisting] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'reviews', order.id)).then((s) => setExisting(s.exists() ? s.data() : null)).catch(() => setExisting(null));
  }, [order.id]);

  if (existing === undefined) return null;
  if (existing) {
    return (
      <div className="rv-mine">
        <Stars value={existing.rating} /> <span>{t('rv.thanks')}</span>
      </div>
    );
  }
  if (!open) return <button className="acc-link rv-open" onClick={() => setOpen(true)}><Star size={13} /> {t('rv.leave')}</button>;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = auth.currentUser;
      const data = {
        uid: u.uid,
        order_id: order.id,
        name: (u.displayName || u.email?.split('@')[0] || '').split(' ')[0].slice(0, 30),
        product_name: (order.items || []).map((i) => `${i.name}${i.durationLabel ? ` (${i.durationLabel})` : ''}`).join(', ').slice(0, 120),
        rating,
        text: text.trim().slice(0, 500),
        created_at: serverTimestamp(),
      };
      await setDoc(doc(db, 'reviews', order.id), data);
      setExisting(data);
      toast.success(t('rv.saved'));
    } catch (err) {
      toast.error(err.code || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="rv-form" onSubmit={submit}>
      <Stars value={rating} size={20} onChange={setRating} />
      <textarea className="acc-input" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('rv.ph')} />
      <div className="acc-row">
        <button type="button" className="acc-btn acc-btn-ghost" onClick={() => setOpen(false)}>{t('account.cancel')}</button>
        <button className="acc-btn acc-btn-primary" disabled={busy}>{busy ? <Loader2 size={14} className="spin" /> : <Star size={14} />} {t('rv.send')}</button>
      </div>
    </form>
  );
};

export default ReviewForm;
