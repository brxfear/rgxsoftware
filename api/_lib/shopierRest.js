// Shopier REST API (https://api.shopier.com/v1) — Personal Access Token ile.
// Env: SHOPIER_PAT. Webhook imza anahtarı Firestore private/shopier belgesinde tutulur (istemciye kapalı).
import process from 'node:process';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

const BASE = 'https://api.shopier.com/v1';

export const shopierRest = async (method, path, body) => {
  const token = process.env.SHOPIER_PAT;
  if (!token) throw new Error('SHOPIER_PAT tanımlı değil.');
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const err = new Error(`Shopier ${method} ${path}: ${r.status} ${data?.message || data?.error || ''}`.trim());
    err.status = r.status;
    throw err;
  }
  return data;
};

/** Shopier siparişini panelde gösterilecek sade biçime çevirir. */
export const simplifyOrder = (o) => ({
  id: String(o.id),
  date: o.dateCreated,
  status: o.status,
  paymentStatus: o.paymentStatus,
  paymentMethod: o.paymentMethod,
  currency: o.currency,
  total: Number(o.totals?.total) || 0,
  buyer: [o.shippingInfo?.firstName, o.shippingInfo?.lastName].filter(Boolean).join(' '),
  email: o.shippingInfo?.email || '',
  items: (o.lineItems || []).map((l) => ({ productId: String(l.productId), title: l.title, quantity: l.quantity, total: Number(l.total) || 0 })),
});

/** Shopier-Signature doğrulaması: HMAC-SHA256(ham gövde, webhook token). Hex ve base64 kabul edilir. */
export const verifyWebhookSignature = (rawBody, signature, token) => {
  if (!signature || !token) return false;
  const mac = crypto.createHmac('sha256', token).update(rawBody);
  const digest = mac.digest();
  const candidates = [digest.toString('hex'), digest.toString('base64'), digest.toString('base64url')];
  const got = String(signature).trim();
  return candidates.some((c) => c.length === got.length && crypto.timingSafeEqual(Buffer.from(c), Buffer.from(got)));
};
