// /api/shopier-setup — (sadece yönetici)
//   GET    → Shopier bağlantı durumu: mağaza, bu siteye ait webhook'lar
//   POST   → order.created (+ refund.*) webhook'larını SITE_URL/api/shopier-webhook adresine kurar,
//            imza token'larını private/shopier belgesine yazar (istemci okuyamaz)
//   DELETE → bu siteye ait webhook'ları siler
import process from 'node:process';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_lib/firebaseAdmin.js';
import { requireAdmin, sendError, HttpError } from './_lib/adminAuth.js';
import { shopierRest } from './_lib/shopierRest.js';

const EVENTS = ['order.created', 'refund.requested', 'refund.updated'];

const siteUrl = (req) => (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');

const logAdmin = (db, admin, summary) =>
  db.collection('admin_logs').add({
    actor_uid: admin.uid,
    actor_nick: admin.nickname || '?',
    action: 'update',
    target_type: 'settings',
    target_id: 'shopier',
    summary,
    at: FieldValue.serverTimestamp(),
  });

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req);
    const db = adminDb();
    const hookUrl = `${siteUrl(req)}/api/shopier-webhook`;
    if (!hookUrl.startsWith('https://')) throw new HttpError(400, 'Webhook için HTTPS alan adı gerekli (SITE_URL).');

    const all = (await shopierRest('GET', '/webhooks')) || [];
    const ours = all.filter((w) => w.url === hookUrl);

    if (req.method === 'GET') {
      const shop = await shopierRest('GET', '/shop/settings');
      return res.status(200).json({
        shop: { url: shop?.url, currencyHint: null, language: shop?.language },
        hookUrl,
        webhooks: ours.map((w) => ({ id: w.id, event: w.event })),
        otherWebhooks: all.length - ours.length,
      });
    }

    if (req.method === 'POST') {
      const tokens = {};
      for (const event of EVENTS) {
        if (ours.some((w) => w.event === event)) continue;
        const created = await shopierRest('POST', '/webhooks', { event, url: hookUrl });
        if (created?.token) tokens[event] = created.token;
      }
      // Shopier her abonelik için ayrı token döner; imzalar order.created token'ı ile doğrulanır,
      // diğerleri yedek olarak saklanır.
      if (Object.keys(tokens).length) {
        await db.collection('private').doc('shopier').set(
          {
            ...(tokens['order.created'] ? { webhook_token: tokens['order.created'] } : {}),
            webhook_tokens: tokens,
            webhook_url: hookUrl,
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      await logAdmin(db, admin, `Shopier webhook kuruldu (${Object.keys(tokens).join(', ') || 'zaten kurulu'})`);
      return res.status(200).json({ created: Object.keys(tokens) });
    }

    if (req.method === 'DELETE') {
      for (const w of ours) await shopierRest('DELETE', `/webhooks/${w.id}`);
      await db.collection('private').doc('shopier').set({ webhook_token: FieldValue.delete(), webhook_tokens: FieldValue.delete() }, { merge: true });
      await logAdmin(db, admin, `Shopier webhook kaldırıldı (${ours.length})`);
      return res.status(200).json({ deleted: ours.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof HttpError) return sendError(res, err);
    console.error(err);
    return res.status(502).json({ error: err.message || 'Shopier isteği başarısız.' });
  }
}
