// /api/admin-username — (sadece yönetici) kendi giriş kullanıcı adını yönetir.
//   GET  → { username }       POST { username } → belirler / değiştirir      DELETE → kaldırır
// Eşleme admin_usernames/{kullaniciadi} = { email, admin_id } — istemciye tamamen kapalı.
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from './_lib/firebaseAdmin.js';
import { requireAdmin, sendError, HttpError } from './_lib/adminAuth.js';

const RE = /^[a-z0-9_.]{3,24}$/;

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req);
    const db = adminDb();
    const mine = await db.collection('admin_usernames').where('admin_id', '==', admin.adminId).get();
    const current = mine.docs[0]?.id || null;

    if (req.method === 'GET') return res.status(200).json({ username: current });

    const log = (summary) =>
      db.collection('admin_logs').add({
        actor_uid: admin.uid,
        actor_nick: admin.nickname || '?',
        action: 'update',
        target_type: 'admin',
        target_id: admin.adminId,
        summary,
        at: FieldValue.serverTimestamp(),
      });

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const username = String(body.username || '').trim().toLowerCase();
      if (!RE.test(username)) throw new HttpError(400, 'Kullanıcı adı 3-24 karakter olmalı; sadece harf, rakam, nokta ve alt çizgi.');
      if (username === current) return res.status(200).json({ username });
      const user = await adminAuth().getUser(admin.uid);
      await db.runTransaction(async (tx) => {
        const ref = db.collection('admin_usernames').doc(username);
        if ((await tx.get(ref)).exists) throw new HttpError(409, 'Bu kullanıcı adı alınmış.');
        tx.set(ref, { email: String(user.email).toLowerCase(), admin_id: admin.adminId, created_at: FieldValue.serverTimestamp() });
        mine.docs.forEach((d) => tx.delete(d.ref));
      });
      await log(current ? `Giriş kullanıcı adını değiştirdi (${current} → ${username})` : `Giriş kullanıcı adı belirledi (${username})`);
      return res.status(200).json({ username });
    }

    if (req.method === 'DELETE') {
      await Promise.all(mine.docs.map((d) => d.ref.delete()));
      if (current) await log(`Giriş kullanıcı adını kaldırdı (${current})`);
      return res.status(200).json({ username: null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
