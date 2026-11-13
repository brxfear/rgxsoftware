// POST /api/admin-login  { login: "kullaniciadi" | "e-posta", password }
// Şifreyi Firebase Auth ile doğrular; hesap yönetici listesindeyse rgx_admin_id talepli bir
// özel oturum anahtarı (custom token) döner. İstemci signInWithCustomToken ile giriş yapar.
// Kullanıcı adı → e-posta eşlemesi sunucuda (admin_usernames, istemciye kapalı) tutulur.
import process from 'node:process';
import crypto from 'node:crypto';
import { adminDb, adminAuth } from './_lib/firebaseAdmin.js';

const attempts = new Map(); // ip -> { n, at }
const LIMIT = 8;
const WINDOW_MS = 10 * 60 * 1000;
const FAIL = { error: 'Kullanıcı adı / e-posta veya şifre hatalı.' };

const tooMany = (ip) => {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.at > WINDOW_MS) return false;
  return a.n >= LIMIT;
};
const countFail = (ip) => {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.at > WINDOW_MS) attempts.set(ip, { n: 1, at: Date.now() });
  else a.n++;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';
  if (tooMany(ip)) return res.status(429).json({ error: 'Çok fazla deneme. 10 dakika sonra tekrar dene.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const login = String(body.login || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!login || !password || password.length > 200) {
      countFail(ip);
      return res.status(401).json(FAIL);
    }

    const db = adminDb();
    let email = login;
    if (!login.includes('@')) {
      const u = await db.collection('admin_usernames').doc(login).get();
      if (!u.exists) {
        countFail(ip);
        return res.status(401).json(FAIL);
      }
      email = u.get('email');
    }

    // Şifre doğrulaması (Firebase Auth REST)
    const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    });
    const auth = await r.json();
    if (!r.ok || !auth.localId) {
      countFail(ip);
      return res.status(401).json(FAIL);
    }

    const user = await adminAuth().getUser(auth.localId);
    const adminId = crypto.createHash('sha256').update(String(user.email).toLowerCase()).digest('hex');
    const admin = await db.collection('admins').doc(adminId).get();
    if (!admin.exists || !user.emailVerified) {
      countFail(ip);
      return res.status(403).json({ error: 'Bu hesap yönetici değil.' });
    }

    attempts.delete(ip);
    const token = await adminAuth().createCustomToken(user.uid, { rgx_admin_id: adminId });
    return res.status(200).json({ token });
  } catch (err) {
    console.error('admin-login error', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
}
