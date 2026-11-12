// Vercel serverless fonksiyonları için Firebase Admin SDK.
// Vercel ortam değişkeni: FIREBASE_SERVICE_ACCOUNT = servis hesabı JSON'unun tamamı (tek satır).
import process from 'node:process';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const init = () => {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT ortam değişkeni eksik.');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
};

export const adminDb = () => getFirestore(init());
export const adminAuth = () => getAuth(init());

// Fiyat tablosu (src/lib/db.js -> PLAN_DEFS ile aynı)
export const PLAN_DEFS = [
  { duration: 1, label: '1 GÜN', field: 'price_1day' },
  { duration: 7, label: '7 GÜN', field: 'price_7day' },
  { duration: 30, label: '30 GÜN', field: 'price_30day' },
  { duration: 9999, label: 'SINIRSIZ', field: 'price_lifetime' },
];

export const planPrice = (product, duration) => {
  const plan = PLAN_DEFS.find((p) => p.duration === Number(duration));
  if (!plan) return null;
  let price = Number(product[plan.field]) || 0;
  if (!price && plan.duration === 1) price = Number(product.price) || 0;
  return price > 0 ? { price, label: plan.label } : null;
};
