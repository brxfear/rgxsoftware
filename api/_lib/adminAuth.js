// Sunucu tarafı yönetici doğrulaması: Firebase ID token + Google girişi + admins/{sha256(e-posta)} kaydı.
// Firestore kurallarındaki isAdmin() ile aynı mantık.
import crypto from 'node:crypto';
import { adminAuth, adminDb } from './firebaseAdmin.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const requireAdmin = async (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Giriş gerekli.');
  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(header.slice(7));
  } catch {
    throw new HttpError(401, 'Oturum geçersiz.');
  }
  // Yönetici kimliği: şifreli girişte sunucunun verdiği rgx_admin_id talebi, Google girişinde e-posta özeti
  let id = null;
  if (decoded.rgx_admin_id) id = decoded.rgx_admin_id;
  else if (decoded.firebase?.sign_in_provider === 'google.com' && decoded.email && decoded.email_verified) {
    id = crypto.createHash('sha256').update(decoded.email.toLowerCase()).digest('hex');
  }
  if (!id) throw new HttpError(403, 'Yönetici değil.');
  const snap = await adminDb().collection('admins').doc(id).get();
  if (!snap.exists) throw new HttpError(403, 'Yönetici değil.');
  return { uid: decoded.uid, adminId: id, nickname: snap.get('nickname') };
};

export const sendError = (res, err) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) console.error(err);
  return res.status(status).json({ error: status === 500 ? 'Sunucu hatası.' : err.message });
};
