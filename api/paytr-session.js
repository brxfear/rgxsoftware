// POST /api/paytr-session
// Sepetteki ürünlerin fiyatını Firestore'dan hesaplar, siparişi "pending_payment" olarak açar
// ve PayTR iframe token'ı döner.
// Gerekli env: FIREBASE_SERVICE_ACCOUNT, PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT,
//              SITE_URL (örn. https://rgxsoftware.com), PAYTR_TEST_MODE ("1" test, "0" canlı)
import process from 'node:process';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth, planPrice } from './_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { PAYTR_MERCHANT_ID: merchant_id, PAYTR_MERCHANT_KEY: merchant_key, PAYTR_MERCHANT_SALT: merchant_salt } = process.env;
    if (!merchant_id || !merchant_key || !merchant_salt) {
      return res.status(500).json({ error: 'PayTR bilgileri sunucuda tanımlı değil.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { items, customer_name, customer_phone } = body;
    if (!Array.isArray(items) || !items.length || items.length > 50) {
      return res.status(400).json({ error: 'Sepet boş veya geçersiz.' });
    }
    if (!customer_name || !customer_phone) {
      return res.status(400).json({ error: 'İsim ve iletişim bilgisi gerekli.' });
    }

    // Giriş yapmış kullanıcı (opsiyonel)
    let uid = null;
    let email = body.customer_email || '';
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const decoded = await adminAuth().verifyIdToken(authHeader.slice(7));
        uid = decoded.uid;
        email = decoded.email || email;
      } catch {
        /* geçersiz token: misafir olarak devam */
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = 'misafir@rgxsoftware.com';

    // Fiyatları sunucuda hesapla
    const db = adminDb();
    const detailed = [];
    for (const it of items) {
      const qty = Math.max(1, Math.min(10, parseInt(it.quantity, 10) || 1));
      const snap = await db.collection('products').doc(String(it.product_id)).get();
      if (!snap.exists || snap.get('is_available') === false) {
        return res.status(400).json({ error: 'Sepetteki bir ürün artık satışta değil.' });
      }
      const product = snap.data();
      const plan = planPrice(product, it.duration);
      if (!plan) return res.status(400).json({ error: `${product.name} için seçilen plan bulunamadı.` });
      detailed.push({
        product_id: snap.id,
        name: product.name,
        price: plan.price,
        duration: Number(it.duration),
        durationLabel: plan.label,
        quantity: qty,
        subtotal: Math.round(plan.price * qty * 100) / 100,
      });
    }
    const total_amount = Math.round(detailed.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;

    const merchant_oid = 'RGX' + Date.now() + crypto.randomInt(1000, 9999);
    await db.collection('orders').doc(merchant_oid).set({
      merchant_oid,
      user_id: uid,
      total_amount,
      items: detailed,
      subscription_duration: detailed[0].duration,
      payment_method: 'paytr',
      status: 'pending_payment',
      customer_name: String(customer_name).slice(0, 120),
      customer_email: email,
      customer_phone: String(customer_phone).slice(0, 60),
      created_at: FieldValue.serverTimestamp(),
    });

    const user_ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
    const payment_amount = Math.round(total_amount * 100);
    const user_basket = Buffer.from(
      JSON.stringify(detailed.map((i) => [`${i.name} (${i.durationLabel})`, i.price.toFixed(2), i.quantity]))
    ).toString('base64');
    const no_installment = '1';
    const max_installment = '0';
    const currency = 'TL';
    const test_mode = process.env.PAYTR_TEST_MODE ?? '1';
    const site = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');

    const hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode;
    const paytr_token = crypto.createHmac('sha256', merchant_key).update(hash_str + merchant_salt).digest('base64');

    const form = new URLSearchParams({
      merchant_id,
      user_ip,
      merchant_oid,
      email,
      payment_amount: String(payment_amount),
      paytr_token,
      user_basket,
      debug_on: test_mode === '1' ? '1' : '0',
      no_installment,
      max_installment,
      user_name: String(customer_name).slice(0, 60),
      user_address: 'Dijital Teslimat',
      user_phone: String(customer_phone).slice(0, 20),
      merchant_ok_url: `${site}/?odeme=basarili`,
      merchant_fail_url: `${site}/?odeme=basarisiz`,
      timeout_limit: '30',
      currency,
      test_mode,
      lang: 'tr',
    });

    const r = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const result = await r.json();

    if (result.status !== 'success') {
      await db.collection('orders').doc(merchant_oid).update({ status: `failed - ${result.reason || 'token'}` });
      return res.status(400).json({ error: result.reason || 'PayTR token alınamadı.' });
    }
    return res.status(200).json({ token: result.token, merchant_oid });
  } catch (err) {
    console.error('paytr-session error', err);
    return res.status(500).json({ error: 'Ödeme başlatılamadı.' });
  }
}
