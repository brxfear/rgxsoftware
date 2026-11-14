// /api/discord — Discord vouch botu
//   GET  ?action=sync          → yeni vouch'ları çeker (herkes tetikleyebilir; 10 dakikada en fazla bir kez çalışır)
//   POST ?action=sync          → (yönetici) hemen eşitle; body { full: true } ile kanalı baştan tara
//   GET  ?action=image&id&i    → vouch görseli (Discord bağlantıları süreli; taze bağlantıya yönlendirir)
//   GET  ?action=status        → (yönetici) bot bilgisi, sunucular ve kanallar
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_lib/firebaseAdmin.js';
import { requireAdmin, sendError, HttpError } from './_lib/adminAuth.js';
import { discord, botToken, syncVouches, imageAttachments } from './_lib/discord.js';

const AUTO_EVERY_MS = 10 * 60 * 1000;

const fail = (res, err) => {
  if (err instanceof HttpError) return sendError(res, err);
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error('discord', err);
  return res.status(status === 401 || status === 403 ? 502 : status).json({ error: err.message || 'Sunucu hatası.' });
};

const readBody = (req) => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {});

export default async function handler(req, res) {
  const action = String(req.query?.action || new URL(req.url, 'http://x').searchParams.get('action') || '');
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const db = adminDb();

  try {
    /* ---------- Görsel ---------- */
    if (action === 'image' && req.method === 'GET') {
      const id = String(q.id || '');
      const i = Math.max(0, Math.min(3, parseInt(q.i, 10) || 0));
      if (!/^\d{5,25}$/.test(id)) return res.status(400).end();
      const v = await db.collection('vouches').doc(id).get();
      if (!v.exists) return res.status(404).end();
      const msg = await discord(`/channels/${v.get('channel_id')}/messages/${id}`);
      const att = imageAttachments(msg)[i];
      if (!att) return res.status(404).end();
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=43200');
      res.setHeader('Location', att.proxy_url || att.url);
      return res.status(302).end();
    }

    /* ---------- Eşitleme ---------- */
    if (action === 'sync' && req.method === 'GET') {
      if (!botToken()) return res.status(200).json({ skipped: 'no-token', added: 0 });
      const cfg = (await db.collection('settings').doc('discord').get()).data() || {};
      if (!cfg.vouch_channel_id) return res.status(200).json({ skipped: 'no-channel', added: 0 });
      const stateRef = db.collection('private').doc('discord_sync');
      // Aynı anda gelen istekler tek eşitleme yapsın diye kilit: transaction ile "son çalışma" zamanı
      const go = await db.runTransaction(async (tx) => {
        const s = (await tx.get(stateRef)).data() || {};
        const last = s.last_attempt?.toMillis?.() || 0;
        if (Date.now() - last < AUTO_EVERY_MS) return false;
        tx.set(stateRef, { last_attempt: FieldValue.serverTimestamp() }, { merge: true });
        return true;
      });
      if (!go) return res.status(200).json({ skipped: 'throttled', added: 0 });
      const r = await syncVouches(db);
      return res.status(200).json(r);
    }

    if (action === 'sync' && req.method === 'POST') {
      const admin = await requireAdmin(req);
      const { full = false } = readBody(req);
      const r = await syncVouches(db, { full: !!full });
      await db.collection('private').doc('discord_sync').set({ last_attempt: FieldValue.serverTimestamp() }, { merge: true });
      await db.collection('admin_logs').add({
        actor_uid: admin.uid,
        actor_nick: admin.nickname || '?',
        action: 'update',
        target_type: 'settings',
        target_id: 'discord',
        summary: `Discord vouch eşitlendi${full ? ' (tam tarama)' : ''}: ${r.added} yorum işlendi${r.removed ? `, ${r.removed} silinen kaldırıldı` : ''}`,
        at: FieldValue.serverTimestamp(),
      });
      return res.status(200).json(r);
    }

    /* ---------- Durum (yönetici) ---------- */
    if (action === 'status' && req.method === 'GET') {
      await requireAdmin(req);
      if (!botToken()) return res.status(200).json({ configured: false });
      const me = await discord('/users/@me');
      const app = await discord('/applications/@me').catch(() => null);
      const guilds = await discord('/users/@me/guilds');
      const out = [];
      for (const g of guilds.slice(0, 10)) {
        const channels = await discord(`/guilds/${g.id}/channels`).catch(() => []);
        out.push({
          id: g.id,
          name: g.name,
          channels: channels
            .filter((c) => c.type === 0 || c.type === 5)
            .sort((a, b) => a.position - b.position)
            .map((c) => ({ id: c.id, name: c.name })),
        });
      }
      const state = (await db.collection('private').doc('discord_sync').get()).data() || {};
      const count = (await db.collection('vouches').count().get()).data().count;
      // flags: 1<<18 GATEWAY_MESSAGE_CONTENT, 1<<19 ..._LIMITED
      const contentIntent = app ? Boolean(app.flags & ((1 << 18) | (1 << 19))) : null;
      return res.status(200).json({
        configured: true,
        bot: { id: me.id, username: me.username },
        application_id: app?.id || me.id,
        content_intent: contentIntent,
        guilds: out,
        vouch_count: count,
        last_run: state.last_run?.toDate?.()?.toISOString() || null,
      });
    }

    return res.status(404).json({ error: 'Bilinmeyen işlem.' });
  } catch (err) {
    return fail(res, err);
  }
}
