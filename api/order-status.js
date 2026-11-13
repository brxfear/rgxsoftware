// GET /api/order-status?id=RGX…&key=…  — ödeme penceresi bunu birkaç saniyede bir sorar.
// key, sipariş oluşturulurken sadece o müşteriye verilen gizli anahtardır.
// Sipariş hâlâ bekliyorsa Shopier siparişlerinde ödeme aranır (webhook gecikirse yedek).
import crypto from 'node:crypto';
import { adminDb } from './_lib/firebaseAdmin.js';
import { checkPendingOrder } from './_lib/shopierPay.js';

const lastCheck = new Map(); // sipariş başına Shopier'e en fazla 8 sn'de bir sor

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const id = String(req.query?.id || '');
  const key = String(req.query?.key || '');
  if (!/^RGX[A-Z0-9]{6,20}$/.test(id) || !/^[a-f0-9]{32}$/.test(key)) return res.status(400).json({ error: 'Geçersiz istek.' });

  try {
    const db = adminDb();
    const ref = db.collection('orders').doc(id);
    let snap = await ref.get();
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    if (!snap.exists || snap.get('view_key_hash') !== hash) return res.status(404).json({ error: 'Sipariş bulunamadı.' });

    if (snap.get('status') === 'pending_payment') {
      const prev = lastCheck.get(id) || 0;
      if (Date.now() - prev > 8000) {
        lastCheck.set(id, Date.now());
        try {
          if (await checkPendingOrder(db, snap)) snap = await ref.get();
        } catch (err) {
          console.warn('order-status check', err.message);
        }
      }
    }

    const status = snap.get('status');
    const out = {
      status:
        status === 'Completed' ? 'delivered'
        : status === 'paid' ? 'paid'
        : status === 'pending_payment' || status === 'Waiting for Confirmation' || status === 'payment_review' ? 'pending'
        : 'failed',
    };
    if (req.query?.detail) {
      out.total = snap.get('total_amount');
      out.currency = snap.get('currency') || 'USD';
      const delivery = snap.get('delivery');
      if (status === 'Completed' && delivery?.items) {
        out.delivery = {
          items: delivery.items.map((i) => ({ name: i.name, durationLabel: i.durationLabel, keys: i.keys || [], link: i.link || '', note: i.note || '' })),
        };
      }
    }
    return res.status(200).json(out);
  } catch (err) {
    console.error('order-status error', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
}
