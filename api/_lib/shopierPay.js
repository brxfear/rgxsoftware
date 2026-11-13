// Shopier ile kartla ödeme (Mitamers tarzı):
//  1) Sipariş başına, sipariş tutarında tek kullanımlık gizli bir Shopier ürünü oluşturulur.
//  2) Müşteri bu ürünün Shopier sayfasında öder (sitede iframe içinde açılır).
//  3) Shopier siparişi gelince (webhook ya da sipariş kontrolü) ürün kimliğiyle eşleştirilir,
//     sipariş "paid" yapılır, loglanır ve geçici Shopier ürünü silinir.
import process from 'node:process';
import { FieldValue } from 'firebase-admin/firestore';
import { shopierRest, simplifyOrder } from './shopierRest.js';
import { paymentLog } from './firebaseAdmin.js';

const COVER_FALLBACK = 'https://raw.githubusercontent.com/brxfear/rgxsoftware/main/public/media/shopier-cover.jpg';
export const PENDING_TTL_MS = 2 * 60 * 60 * 1000; // ödenmemiş geçici ürünler 2 saat sonra temizlenir

const coverUrl = () => {
  if (process.env.SHOPIER_PRODUCT_IMAGE) return process.env.SHOPIER_PRODUCT_IMAGE;
  const site = process.env.SITE_URL?.replace(/\/$/, '');
  return site?.startsWith('https://') ? `${site}/media/shopier-cover.jpg` : COVER_FALLBACK;
};

/** Sipariş için Shopier ürünü oluşturur, { id, url } döner. */
export const createShopierProduct = async ({ orderId, title, description, total, currency }) => {
  const p = await shopierRest('POST', '/products', {
    title: `${title}`.slice(0, 120),
    description: `${description}\n\nSipariş: ${orderId}`.slice(0, 1000),
    type: 'digital',
    media: [{ type: 'image', url: coverUrl(), placement: 1 }],
    priceData: { currency, price: Number(total).toFixed(2) },
    stockQuantity: 1,
    shippingPayer: 'sellerPays',
    customListing: true,
  });
  return { id: String(p.id), url: p.url };
};

export const deleteShopierProduct = async (productId) => {
  if (!productId) return;
  try {
    await shopierRest('DELETE', `/products/${productId}`);
  } catch (err) {
    console.warn('Shopier ürünü silinemedi', productId, err.message);
  }
};

/**
 * Shopier siparişini bizim siparişimizle eşleştirip ödendi yapar (idempotent).
 * Dönen değer: eşleşen bizim sipariş id'si ya da null.
 */
export const settleShopierOrder = async (db, rawOrder, source) => {
  const o = simplifyOrder(rawOrder);
  // Sadece kesin ödenmiş Shopier siparişleri (ödeme durumu bilinmiyorsa onaylama)
  if (o.paymentStatus !== 'paid') return null;

  for (const item of o.items) {
    const q = await db.collection('orders').where('shopier_product_id', '==', item.productId).limit(1).get();
    if (q.empty) continue;
    const ref = q.docs[0].ref;

    const settled = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.get('status') !== 'pending_payment') return false;
      // Tutar ve para birimi tutmuyorsa ödendi yapma, incelemeye bırak
      const expected = Number(snap.get('total_amount'));
      if (Math.abs(expected - o.total) > 0.01 || (snap.get('currency') && o.currency && snap.get('currency') !== o.currency)) {
        tx.update(ref, { status: 'payment_review', review_reason: `Shopier ${o.total} ${o.currency}, beklenen ${expected} ${snap.get('currency')}`, shopier_order_id: o.id });
        return 'review';
      }
      tx.update(ref, {
        status: 'paid',
        paid_at: FieldValue.serverTimestamp(),
        shopier_order_id: o.id,
        paid_amount: o.total,
        paid_currency: o.currency,
        shopier_buyer: o.buyer || null,
      });
      return true;
    });

    if (settled === 'review') {
      await paymentLog(db, { order_id: ref.id, event: 'error', amount: o.total, currency: o.currency, payment_id: o.id, message: `Tutar uyuşmuyor — sipariş incelemeye alındı (Shopier ${o.id})` });
      return ref.id;
    }
    if (settled) {
      await paymentLog(db, {
        order_id: ref.id,
        event: 'success',
        amount: o.total,
        currency: o.currency,
        payment_id: o.id,
        message: `Ödeme alındı (${source}) — Shopier sipariş ${o.id}${o.buyer ? `, ${o.buyer}` : ''}`,
      });
      await deleteShopierProduct(item.productId);
    }
    return ref.id;
  }
  return null;
};

/** Bekleyen bir siparişin ödemesini Shopier siparişlerinde arar (webhook yoksa / gecikirse yedek). */
export const checkPendingOrder = async (db, orderSnap) => {
  const productId = orderSnap.get('shopier_product_id');
  if (!productId) return false;
  const recent = (await shopierRest('GET', '/orders?limit=25')) || [];
  const match = recent.find((o) => (o.lineItems || []).some((l) => String(l.productId) === productId));
  if (!match) return false;
  await settleShopierOrder(db, match, 'kontrol');
  return true;
};

/** Süresi dolmuş ödenmemiş siparişlerin geçici Shopier ürünlerini temizler (en fazla 5). */
export const cleanupExpired = async (db) => {
  const cutoff = new Date(Date.now() - PENDING_TTL_MS);
  const q = await db
    .collection('orders')
    .where('status', '==', 'pending_payment')
    .where('created_at', '<', cutoff)
    .limit(5)
    .get();
  for (const d of q.docs) {
    if (d.get('payment_method') !== 'shopier') continue;
    // Silmeden önce son bir kez ödeme gelmiş mi bak
    try {
      if (await checkPendingOrder(db, d)) continue;
    } catch {
      /* yoksay */
    }
    await deleteShopierProduct(d.get('shopier_product_id'));
    await d.ref.update({ status: 'failed - süre doldu', expired_at: FieldValue.serverTimestamp() });
    await paymentLog(db, { order_id: d.id, event: 'failed', message: 'Ödeme 2 saat içinde yapılmadı — geçici Shopier ürünü silindi' });
  }
};
