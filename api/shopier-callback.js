// POST /api/shopier-callback  — Shopier panelinde "Geri dönüş URL'si" olarak bunu tanımla:
//   https://ALANADIN/api/shopier-callback
// Shopier ödeme sonrası müşterinin tarayıcısını bu adrese POST eder
// (platform_order_id, status, installment, payment_id, random_nr, signature).
// İmza doğrulanır, sipariş güncellenir, log yazılır, müşteri siteye yönlendirilir.
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, paymentLog } from './_lib/firebaseAdmin.js';
import { shopierConfig, verifyShopierCallback } from './_lib/shopier.js';

const readForm = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
};

const siteUrl = (req) => (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');

export default async function handler(req, res) {
  const redirect = (ok, orderId) => {
    const q = new URLSearchParams({ odeme: ok ? 'basarili' : 'basarisiz', ...(orderId ? { siparis: orderId } : {}) });
    res.statusCode = 303;
    res.setHeader('Location', `${siteUrl(req)}/?${q}`);
    res.end();
  };

  if (req.method !== 'POST') return redirect(false);

  const db = adminDb();
  let body = {};
  try {
    const cfg = shopierConfig();
    body = await readForm(req);
    const orderId = String(body.platform_order_id || '');

    if (!verifyShopierCallback(body, cfg.secret)) {
      await paymentLog(db, {
        order_id: orderId || null,
        event: 'bad_signature',
        message: 'İmza doğrulanamadı — istek reddedildi',
        payment_id: body.payment_id ? String(body.payment_id) : null,
      });
      return redirect(false, orderId);
    }

    const success = String(body.status || '').toLowerCase() === 'success';
    const ref = db.collection('orders').doc(orderId);
    const snap = await ref.get();

    if (!snap.exists) {
      await paymentLog(db, { order_id: orderId, event: 'error', message: 'Sipariş bulunamadı', payment_id: body.payment_id ? String(body.payment_id) : null });
      return redirect(false, orderId);
    }

    // Aynı dönüş birden fazla gelebilir: sadece bekleyen siparişi güncelle
    if (snap.get('status') === 'pending_payment') {
      await ref.update(
        success
          ? {
              status: 'paid',
              paid_at: FieldValue.serverTimestamp(),
              shopier_payment_id: String(body.payment_id || ''),
              installment: String(body.installment || '0'),
            }
          : { status: 'failed - Shopier', failed_at: FieldValue.serverTimestamp() }
      );
    }

    await paymentLog(db, {
      order_id: orderId,
      event: success ? 'success' : 'failed',
      amount: snap.get('total_amount') ?? null,
      currency: snap.get('currency') || cfg.currency,
      payment_id: body.payment_id ? String(body.payment_id) : null,
      message: success
        ? `Ödeme onaylandı (${snap.get('customer_name') || ''})`
        : `Ödeme başarısız${body.error_message ? ': ' + String(body.error_message).slice(0, 200) : ''}`,
    });

    return redirect(success, orderId);
  } catch (err) {
    console.error('shopier-callback error', err);
    await paymentLog(db, { order_id: body?.platform_order_id ? String(body.platform_order_id) : null, event: 'error', message: `Geri dönüş hatası: ${err.message}`.slice(0, 500) });
    return redirect(false);
  }
}
