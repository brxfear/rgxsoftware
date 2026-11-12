import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/** Firestore Timestamp | ISO string | Date -> Date (veya null) */
export const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const withId = (snap) => ({ id: snap.id, ...snap.data() });

export const fetchCategories = async () => {
  const snap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
  return snap.docs.map(withId);
};

export const fetchProducts = async () => {
  const snap = await getDocs(query(collection(db, 'products'), orderBy('created_at', 'desc')));
  return snap.docs.map(withId);
};

export const fetchProduct = async (id) => {
  const snap = await getDoc(doc(db, 'products', id));
  return snap.exists() ? withId(snap) : null;
};

/** Havale / kripto siparişi (admin onayı bekler). */
export const createManualOrder = (order) =>
  addDoc(collection(db, 'orders'), {
    ...order,
    status: 'Waiting for Confirmation',
    created_at: serverTimestamp(),
  });

export const isAdminUser = async (user) => {
  if (!user) return false;
  const ids = [user.uid];
  if (user.email && user.emailVerified) ids.push(user.email.toLowerCase());
  for (const id of ids) {
    try {
      if ((await getDoc(doc(db, 'admins', id))).exists()) return true;
    } catch {
      /* izin yok = admin değil */
    }
  }
  return false;
};

/** Bir ürünün başlangıç (en düşük) fiyatı. */
export const getStartPrice = (p) => {
  const lowest = Math.min(
    p.price_1day || p.price || Infinity,
    p.price_7day || Infinity,
    p.price_30day || Infinity,
    p.price_lifetime || Infinity
  );
  return lowest === Infinity ? (p.price || 0) : lowest;
};

/** Ürünün satın alınabilir planları. Sunucu tarafı (api/) aynı tabloyu kullanır. */
export const PLAN_DEFS = [
  { duration: 1, label: '1 GÜN', field: 'price_1day' },
  { duration: 7, label: '7 GÜN', field: 'price_7day' },
  { duration: 30, label: '30 GÜN', field: 'price_30day' },
  { duration: 9999, label: 'SINIRSIZ', field: 'price_lifetime' },
];
