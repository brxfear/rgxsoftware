// Yöneticinin her yazma işlemi bu yardımcılarla yapılır: hedef değişiklik ve admin_logs kaydı
// aynı batch'te yazılır. Firestore kuralları log'suz yazmayı reddeder (bkz. firestore.rules).
import { collection, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

/** Küçük harfli e-postanın SHA-256 özeti (admins belge kimliği). E-posta hiçbir yerde saklanmaz. */
export const adminIdForEmail = async (email) => {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

/** Giriş yapmış yöneticinin admins kaydı ({ id, nickname, ... }) ya da null. */
export const getMyAdminRecord = async (user) => {
  if (!user) return null;
  try {
    // Kullanıcı adı/şifre ile girişte sunucu oturuma rgx_admin_id ekler
    const { claims, signInProvider } = await user.getIdTokenResult();
    let id = claims.rgx_admin_id || null;
    if (!id && signInProvider === 'google.com' && user.email && user.emailVerified) id = await adminIdForEmail(user.email);
    if (!id) return null;
    const snap = await getDoc(doc(db, 'admins', id));
    return snap.exists() ? { id, ...snap.data() } : null;
  } catch {
    return null;
  }
};

const logEntry = (nick, action, targetType, targetId, summary) => ({
  actor_uid: auth.currentUser.uid,
  actor_nick: nick,
  action,
  target_type: targetType,
  target_id: targetId,
  summary: String(summary || '').slice(0, 500),
  at: serverTimestamp(),
});

/**
 * Loglu yazma.
 *  mode 'create': collectionName + data (id verilmezse otomatik) → yeni belge id'sini döner
 *  mode 'set'   : collectionName + id + data (belirli id ile oluşturma)
 *  mode 'update': collectionName + id + data
 *  mode 'delete': collectionName + id + current (silinen belgenin mevcut verisi)
 */
export const loggedWrite = async ({ me, mode, collectionName, id, data, current, action, targetType, summary }) => {
  const batch = writeBatch(db);

  if (mode === 'delete') {
    const logId = 'del_' + (current?.last_log_id || id);
    batch.set(doc(db, 'admin_logs', logId), logEntry(me.nickname, 'delete', targetType, id, summary));
    batch.delete(doc(db, collectionName, id));
    await batch.commit();
    return id;
  }

  const logRef = doc(collection(db, 'admin_logs'));
  const targetRef = mode === 'create' && !id ? doc(collection(db, collectionName)) : doc(db, collectionName, id);
  batch.set(logRef, logEntry(me.nickname, action || (mode === 'update' ? 'update' : 'create'), targetType, targetRef.id, summary));
  const payload = { ...data, last_log_id: logRef.id };
  if (mode === 'update') batch.update(targetRef, payload);
  else batch.set(targetRef, payload);
  await batch.commit();
  return targetRef.id;
};

/** Panel girişini loglar (oturum başına bir kez). */
export const logAdminLogin = async (me) => {
  const key = `adm_login_logged_${auth.currentUser?.uid}`;
  try {
    if (sessionStorage.getItem(key)) return;
  } catch {
    /* sessionStorage yoksa yine logla */
  }
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'admin_logs')), logEntry(me.nickname, 'login', 'session', auth.currentUser.uid, 'Panele giriş yaptı'));
  await batch.commit();
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* yoksay */
  }
};

/**
 * Tek log + birden fazla belge yazımı (ör. toplu key ekleme, teslimat).
 * ops(batch, logId) içinde yazılan her belgeye last_log_id: logId eklenmelidir.
 */
export const loggedBatch = async ({ me, action, targetType, targetId, summary, ops }) => {
  const batch = writeBatch(db);
  const logRef = doc(collection(db, 'admin_logs'));
  batch.set(logRef, logEntry(me.nickname, action, targetType, targetId, summary));
  await ops(batch, logRef.id);
  await batch.commit();
  return logRef.id;
};
