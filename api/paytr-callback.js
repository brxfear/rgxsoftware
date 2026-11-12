// POST /api/paytr-callback  — PayTR "Bildirim URL" olarak bunu tanımla.
// PayTR x-www-form-urlencoded gönderir; hash doğrulanır, sipariş durumu güncellenir, "OK" döner.
import process from 'node:process';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_lib/firebaseAdmin.js';

const readForm = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { PAYTR_MERCHANT_KEY: merchant_key, PAYTR_MERCHANT_SALT: merchant_salt } = process.env;
  if (!merchant_key || !merchant_salt) return res.status(500).send('Credentials missing');

  const f = await readForm(req);
  const { merchant_oid, status, total_amount, hash } = f;
  if (!merchant_oid || !status || !hash) return res.status(400).send('Bad request');

  const expected = crypto
    .createHmac('sha256', merchant_key)
    .update(merchant_oid + merchant_salt + status + total_amount)
    .digest('base64');
  if (expected !== hash) return res.status(400).send('PAYTR notification failed: bad hash');

  const ref = adminDb().collection('orders').doc(merchant_oid);
  const snap = await ref.get();
  if (snap.exists) {
    const current = snap.get('status');
    // PayTR aynı bildirimi birden fazla gönderebilir; sonuçlanmış siparişi tekrar değiştirme.
    if (current === 'pending_payment') {
      await ref.update(
        status === 'success'
          ? { status: 'paid', paid_amount: Number(total_amount) / 100, paid_at: FieldValue.serverTimestamp() }
          : { status: `failed - ${f.failed_reason_msg || f.failed_reason_code || 'ödeme başarısız'}` }
      );
    }
  }

  res.setHeader('Content-Type', 'text/plain');
  return res.status(200).send('OK');
}
