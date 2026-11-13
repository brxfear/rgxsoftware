// POST /api/admin-invite { email }  — (sadece yönetici)
// Yönetici listesindeki bir e-postaya "şifre belirle" e-postası gönderir. Kişi linkten şifresini
// belirleyip /admin'de e-posta (veya kullanıcı adı) + şifre ile girer. Google hesabı gerekmez.
// Güvenlik: e-postayı doğrulanmamış eski bir hesap varsa şifresi sıfırlanır; böylece hesabı sadece
// o e-posta kutusunun sahibi ele geçirebilir.
import process from 'node:process';
import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from './_lib/firebaseAdmin.js';
import { requireAdmin, sendError, HttpError } from './_lib/adminAuth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const admin = await requireAdmin(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Geçerli bir e-posta gerekli.');

    const db = adminDb();
    const adminId = crypto.createHash('sha256').update(email).digest('hex');
    const target = await db.collection('admins').doc(adminId).get();
    if (!target.exists) throw new HttpError(404, 'Bu e-posta yönetici listesinde değil.');

    const auth = adminAuth();
    const randomPw = crypto.randomBytes(24).toString('base64url');
    let user;
    try {
      user = await auth.getUserByEmail(email);
      if (!user.emailVerified) {
        // Doğrulanmamış hesap: bilinen şifreyi geçersiz kıl, oturumları kapat
        await auth.updateUser(user.uid, { password: randomPw, emailVerified: true });
        await auth.revokeRefreshTokens(user.uid);
      }
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      user = await auth.createUser({ email, emailVerified: true, password: randomPw });
    }

    // Firebase şifre belirleme e-postasını gönderir
    const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Firebase-Locale': 'tr' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(`E-posta gönderilemedi: ${e?.error?.message || r.status}`);
    }

    await db.collection('admin_logs').add({
      actor_uid: admin.uid,
      actor_nick: admin.nickname || '?',
      action: 'update',
      target_type: 'admin',
      target_id: adminId,
      summary: `"${target.get('nickname')}" için şifre belirleme e-postası gönderildi`,
      at: FieldValue.serverTimestamp(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendError(res, err);
  }
}
