// POST /api/shopier-session
// Sepeti Firestore fiyatlarıyla ($) sunucuda hesaplar, siparişi "pending_payment" açar,
// Shopier'e gönderilecek imzalı form alanlarını döner. Tarayıcı bu formu Shopier'e POST eder.
import { Buffer } from 'node:buffer';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth, findPlan, roundUsd, paymentLog } from './_lib/firebaseAdmin.js';
import { shopierConfig, buildShopierFields, SHOPIER_PAY_URL } from './_lib/shopier.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const newOrderId = () => 'RGX' + Date.now().toString(36).toUpperCase() + Buffer.from(String(Math.random())).toString('hex').slice(-4).toUpperCase();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let cfg;
  try {
    cfg = shopierConfig();
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: 'Kartla ödeme şu an aktif değil.' });
  }

  const db = adminDb();
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { items, buyer = {} } = body;
    const name = String(buyer.name || '').trim();
    const email = String(buyer.email || '').trim().toLowerCase();
    const phone = String(buyer.phone || '').replace(/[^\d+]/g, '');

    if (!Array.isArray(items) || !items.length || items.length > 30) return res.status(400).json({ error: 'Sepet boş veya geçersiz.' });
    if (name.split(/\s+/).length < 2) return res.status(400).json({ error: 'Ad ve soyad gerekli.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Geçerli bir e-posta gerekli.' });
    if (phone.length < 10) return res.status(400).json({ error: 'Geçerli bir telefon numarası gerekli.' });

    // Giriş yapmış kullanıcı (opsiyonel)
    let uid = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      try {
        uid = (await adminAuth().verifyIdToken(auth.slice(7))).uid;
      } catch {
        /* misafir */
      }
    }

    // Fiyatları sunucuda hesapla
    const detailed = [];
    for (const it of items) {
      const qty = Math.max(1, Math.min(10, parseInt(it.quantity, 10) || 1));
      const snap = await db.collection('products').doc(String(it.product_id)).get();
      if (!snap.exists || snap.get('is_available') === false) {
        return res.status(400).json({ error: 'Sepetteki bir ürün artık satışta değil.' });
      }
      const product = snap.data();
      const plan = findPlan(product, it.plan_id);
      if (!plan) return res.status(400).json({ error: `${product.name} için seçilen plan bulunamadı.` });
      const price = roundUsd(plan.price_usd);
      detailed.push({
        product_id: snap.id,
        name: product.name,
        plan_id: String(plan.id),
        durationLabel: plan.label,
        quantity: qty,
        price,
        subtotal: roundUsd(price * qty),
      });
    }
    const total = roundUsd(detailed.reduce((s, i) => s + i.subtotal, 0));
    if (!(total > 0)) return res.status(400).json({ error: 'Geçersiz tutar.' });

    const orderId = newOrderId();
    await db.collection('orders').doc(orderId).set({
      merchant_oid: orderId,
      user_id: uid,
      total_amount: total,
      currency: cfg.currency,
      items: detailed,
      payment_method: 'shopier',
      status: 'pending_payment',
      customer_name: name.slice(0, 120),
      customer_email: email,
      customer_phone: phone.slice(0, 20),
      created_at: FieldValue.serverTimestamp(),
    });

    const productName = detailed.map((i) => `${i.name} (${i.durationLabel})${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ');
    const fields = buildShopierFields({ cfg, orderId, total, productName, buyer: { name, email, phone }, userId: uid });

    await paymentLog(db, {
      order_id: orderId,
      event: 'created',
      amount: total,
      currency: cfg.currency,
      message: `Ödeme başlatıldı: ${productName}`,
    });

    return res.status(200).json({ action: SHOPIER_PAY_URL, fields, order_id: orderId });
  } catch (err) {
    console.error('shopier-session error', err);
    await paymentLog(db, { event: 'error', message: `Oturum hatası: ${err.message}`.slice(0, 500) });
    return res.status(500).json({ error: 'Ödeme başlatılamadı.' });
  }
}
