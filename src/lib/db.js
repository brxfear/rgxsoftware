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

/** Google ile girmiş ve e-postası admins listesinde olan kullanıcı mı? */
export const isGoogleUser = (user) => !!user?.providerData?.some((p) => p.providerId === 'google.com');

/**
 * Ürünün satın alınabilir planları: [{ id, label, price_usd }].
 * Yeni model: product.plans. Eski 4 sabit alan (price_1day …) varsa onlardan üretilir.
 * Sunucu (api/_lib/firebaseAdmin.js) aynı mantığı kullanır.
 */
export const getPlans = (p) => {
  if (Array.isArray(p?.plans) && p.plans.length) {
    return p.plans.filter((x) => x && x.id && x.label && Number(x.price_usd) > 0);
  }
  return [
    { id: '1d', label: '1 Gün', price_usd: p?.price_1day || p?.price },
    { id: '7d', label: '7 Gün', price_usd: p?.price_7day },
    { id: '30d', label: '30 Gün', price_usd: p?.price_30day },
    { id: 'life', label: 'Sınırsız', price_usd: p?.price_lifetime },
  ].filter((x) => Number(x.price_usd) > 0);
};

/** Başlangıç (en düşük) fiyat, $. */
export const getStartPrice = (p) => {
  const prices = getPlans(p).map((x) => Number(x.price_usd));
  return prices.length ? Math.min(...prices) : 0;
};
