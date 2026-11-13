// POST /api/shopier-session
// Sepeti Firestore fiyatlarıyla sunucuda hesaplar (TR → ₺ güncel kurla, EN → $), siparişi
// "pending_payment" açar, o tutarda geçici bir Shopier ürünü oluşturur ve ödeme linkini döner.
import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth, findPlan, roundUsd, paymentLog, getUsdTry, usdToTry } from './_lib/firebaseAdmin.js';
import { createShopierProduct, cleanupExpired } from './_lib/shopierPay.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const newOrderId = () => 'RGX' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = adminDb();
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { items, buyer = {} } = body;
    const currency = body.currency === 'TRY' ? 'TRY' : 'USD';
    const lang = body.lang === 'en' ? 'en' : 'tr';
    const name = String(buyer.name || '').trim();
    const email = String(buyer.email || '').trim().toLowerCase();
    const phone = String(buyer.phone || '').replace(/[^\d+]/g, '');

    if (!Array.isArray(items) || !items.length || items.length > 30) return res.status(400).json({ error: 'Sepet boş veya geçersiz.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Geçerli bir e-posta gerekli.' });

    let uid = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      try {
        uid = (await adminAuth().verifyIdToken(auth.slice(7))).uid;
      } catch {
        /* misafir */
      }
    }

    const rate = currency === 'TRY' ? await getUsdTry() : null;
    const toCur = (usd) => (rate ? usdToTry(usd, rate) : roundUsd(usd));

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
      const price = toCur(plan.price_usd);
      detailed.push({
        product_id: snap.id,
        name: product.name,
        plan_id: String(plan.id),
        durationLabel: plan.label,
        quantity: qty,
        price_usd: roundUsd(plan.price_usd),
        price,
        subtotal: roundUsd(price * qty),
      });
    }
    const total = roundUsd(detailed.reduce((s, i) => s + i.subtotal, 0));
    if (!(total > 0)) return res.status(400).json({ error: 'Geçersiz tutar.' });

    const orderId = newOrderId();
    const viewKey = crypto.randomBytes(16).toString('hex');
    const summary = detailed.map((i) => `${i.name} (${i.durationLabel})${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ');

    const shopierProduct = await createShopierProduct({
      orderId,
      title: `RGX Software — ${summary}`,
      description: `RGX Software dijital lisans. ${summary}. Lisans anahtarı ${email} adresine iletilir.`,
      total,
      currency,
    });

    await db.collection('orders').doc(orderId).set({
      merchant_oid: orderId,
      user_id: uid,
      total_amount: total,
      total_usd: roundUsd(detailed.reduce((s, i) => s + i.price_usd * i.quantity, 0)),
      currency,
      ...(rate ? { fx_rate: rate } : {}),
      lang,
      items: detailed,
      payment_method: 'shopier',
      status: 'pending_payment',
      shopier_product_id: shopierProduct.id,
      shopier_url: shopierProduct.url,
      view_key_hash: crypto.createHash('sha256').update(viewKey).digest('hex'),
      customer_name: name.slice(0, 120),
      customer_email: email,
      customer_phone: phone.slice(0, 20),
      created_at: FieldValue.serverTimestamp(),
    });

    await paymentLog(db, {
      order_id: orderId,
      event: 'created',
      amount: total,
      currency,
      payment_id: shopierProduct.id,
      message: `Ödeme başlatıldı: ${summary} (${email})`.slice(0, 500),
    });

    // Eski, ödenmemiş geçici ürünleri arka planda temizle (yanıtı bekletmeden)
    cleanupExpired(db).catch((err) => console.warn('cleanup', err.message));

    return res.status(200).json({ order_id: orderId, key: viewKey, url: shopierProduct.url, total, currency });
  } catch (err) {
    console.error('shopier-session error', err);
    await paymentLog(db, { event: 'error', message: `Ödeme başlatılamadı: ${err.message}`.slice(0, 500) });
    return res.status(500).json({ error: 'Ödeme başlatılamadı.' });
  }
}
