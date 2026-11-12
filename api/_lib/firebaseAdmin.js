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

// Planlar (src/lib/db.js -> getPlans ile aynı mantık). Fiyatlar $.
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

export const findPlan = (product, planId) => getPlans(product).find((x) => String(x.id) === String(planId)) || null;

// USD/TRY kuru (istemci ile aynı kaynak). 30 dk bellekte tutulur.
let fxCache = null;
export const getUsdTry = async () => {
  if (fxCache && Date.now() - fxCache.at < 30 * 60 * 1000) return fxCache.rate;
  const r = await fetch('https://open.er-api.com/v6/latest/USD');
  const d = await r.json();
  const rate = Number(d?.rates?.TRY);
  if (!(rate > 0)) throw new Error('Döviz kuru alınamadı');
  fxCache = { rate, at: Date.now() };
  return rate;
};

// $ → ₺, tam liraya yuvarlı (istemcideki usdToTry ile aynı)
export const usdToTry = (usd, rate) => Math.round((Number(usd) || 0) * rate);
