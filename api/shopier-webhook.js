// POST /api/shopier-webhook — Shopier olay bildirimi (order.created, refund.requested …).
// Shopier-Signature başlığı, private/shopier belgesindeki webhook token ile doğrulanır.
// Her olay payment_logs'a yazılır; 5 sn içinde 200 dönülmezse Shopier tekrar dener.
import { Buffer } from 'node:buffer';
import { adminDb, paymentLog } from './_lib/firebaseAdmin.js';
import { verifyWebhookSignature, simplifyOrder } from './_lib/shopierRest.js';
import { settleShopierOrder } from './_lib/shopierPay.js';

export const config = { api: { bodyParser: false } };

const readRaw = async (req) => {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
};

const EVENT_LOG = {
  'order.created': 'shopier_order',
  'refund.requested': 'refund',
  'refund.updated': 'refund',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const db = adminDb();
  let raw = '';
  try {
    raw = await readRaw(req);
    const priv = (await db.collection('private').doc('shopier').get()).data() || {};
    const secrets = [...new Set([priv.webhook_token, ...Object.values(priv.webhook_tokens || {})].filter(Boolean))];
    const signature = req.headers['shopier-signature'];
    if (!secrets.some((secret) => verifyWebhookSignature(raw, signature, secret))) {
      await paymentLog(db, { event: 'bad_signature', message: 'Webhook imzası doğrulanamadı — yok sayıldı' });
      return res.status(401).send('invalid signature');
    }

    const payload = JSON.parse(raw || '{}');
    const event = String(req.headers['shopier-event'] || payload.event || payload.type || 'order.created');
    const data = payload.data || payload.order || payload;

    if (event === 'order.created') {
      // Sitedeki bir siparişe aitse ödendi yap (log settleShopierOrder içinde yazılır)
      const matched = await settleShopierOrder(db, data, 'webhook');
      if (matched) return res.status(200).send('OK');
    }

    if (event.startsWith('order')) {
      const o = simplifyOrder(data);
      await paymentLog(db, {
        event: EVENT_LOG[event] || 'shopier_order',
        shopier_order_id: o.id,
        amount: o.total,
        currency: o.currency,
        payment_id: o.id,
        message: `Shopier siparişi: ${o.items.map((i) => `${i.title}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ')}${o.buyer ? ` — ${o.buyer}` : ''} (${o.paymentStatus || 'durum yok'})`.slice(0, 500),
      });
    } else {
      await paymentLog(db, {
        event: EVENT_LOG[event] || 'shopier_event',
        message: `Shopier olayı: ${event}`.slice(0, 500),
        payment_id: data?.id ? String(data.id) : null,
      });
    }
    return res.status(200).send('OK');
  } catch (err) {
    console.error('shopier-webhook error', err);
    await paymentLog(db, { event: 'error', message: `Webhook hatası: ${err.message}`.slice(0, 500) });
    return res.status(200).send('OK'); // tekrar denemelerle aynı hatayı çoğaltma
  }
}
