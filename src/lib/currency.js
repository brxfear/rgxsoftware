// Fiyatlar $ (USD) olarak saklanır; sitede güncel kurla ₺ karşılığı gösterilir.
// Kur: open.er-api.com (ücretsiz, anahtarsız). Sunucu (api/) ödeme anında kuru kendisi tekrar çeker.
import { useEffect, useState } from 'react';

const RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_KEY = 'rgx_usd_try';
const CACHE_MS = 60 * 60 * 1000; // 1 saat

let ratePromise = null;
let currentRate = null;

const readCache = () => {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && Date.now() - c.at < CACHE_MS && c.rate > 0) return c.rate;
  } catch {
    /* yoksay */
  }
  return null;
};

export const loadUsdTry = () => {
  if (currentRate) return Promise.resolve(currentRate);
  const cached = readCache();
  if (cached) {
    currentRate = cached;
    return Promise.resolve(cached);
  }
  if (!ratePromise) {
    ratePromise = fetch(RATE_URL)
      .then((r) => r.json())
      .then((d) => {
        const rate = Number(d?.rates?.TRY);
        if (!(rate > 0)) throw new Error('Kur alınamadı');
        currentRate = rate;
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, at: Date.now() }));
        } catch {
          /* yoksay */
        }
        return rate;
      })
      .catch((err) => {
        console.warn('USD/TRY kuru alınamadı:', err);
        ratePromise = null;
        return null;
      });
  }
  return ratePromise;
};

/** Güncel USD/TRY kuru (yüklenene kadar null). */
export const useUsdTry = () => {
  const [rate, setRate] = useState(currentRate);
  useEffect(() => {
    let alive = true;
    loadUsdTry().then((r) => alive && r && setRate(r));
    return () => {
      alive = false;
    };
  }, []);
  return rate;
};

/** $ → ₺ (tam liraya yuvarlanır; sunucu da aynı yuvarlamayı kullanır). */
export const usdToTry = (usd, rate) => (rate ? Math.round((Number(usd) || 0) * rate) : null);

export const fmtTry = (n) => '₺' + Math.round(Number(n) || 0).toLocaleString('tr-TR');
export const fmtUsd = (n) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
