// POST /api/shopier-cancel { order_id }  — (sadece yönetici)
// Ödenmemiş bir Shopier siparişini iptal eder: geçici Shopier ürününü siler, siparişi "Canceled" yapar.
// Ödenmiş siparişe dokunmaz (ödeme Shopier'den iade edilmelidir).
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, paymentLog } from './_lib/firebaseAdmin.js';
import { requireAdmin, sendError, HttpError } from './_lib/adminAuth.js';
import { deleteShopierProduct, checkPendingOrder } from './_lib/shopierPay.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const admin = await requireAdmin(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const id = String(body.order_id || '');
    const db = adminDb();
    const ref = db.collection('orders').doc(id);
    let snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Sipariş bulunamadı.');
    if (snap.get('payment_method') !== 'shopier') return res.status(200).json({ ok: true, skipped: true });

    if (snap.get('status') === 'pending_payment') {
      // İptalden hemen önce son bir kez ödeme gelmiş mi bak
      try {
        if (await checkPendingOrder(db, snap)) snap = await ref.get();
      } catch {
        /* yoksay */
      }
    }
    if (['paid', 'Completed'].includes(snap.get('status'))) {
      throw new HttpError(409, 'Bu siparişin ödemesi alınmış; iptal için Shopier panelinden iade yapılmalı.');
    }

    await deleteShopierProduct(snap.get('shopier_product_id'));
    await ref.update({ status: 'Canceled', canceled_at: FieldValue.serverTimestamp(), canceled_by: admin.nickname || '?' });
    await paymentLog(db, { order_id: id, event: 'failed', message: `Ödenmemiş sipariş yönetici tarafından iptal edildi (${admin.nickname || '?'}) — geçici Shopier ürünü silindi` });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendError(res, err);
  }
}
