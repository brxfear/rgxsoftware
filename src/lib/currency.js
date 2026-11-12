// Fiyatlar $ (USD) olarak saklanır.
// TR dilinde güncel kurla ₺ (tam liraya yuvarlı), EN dilinde $ gösterilir ve o para biriminden tahsil edilir.
// Sunucu (api/_lib/firebaseAdmin.js) aynı kaynaktan kuru çekip aynı yuvarlamayı uygular.
import { useEffect, useState } from 'react';
import { useLangStore } from '../i18n';

const RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_KEY = 'rgx_usd_try';
const CACHE_MS = 30 * 60 * 1000;

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
        if (!(rate > 0)) throw new Error('rate');
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

export const roundUsd = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const usdToTry = (usd, rate) => Math.round((Number(usd) || 0) * rate);

export const fmtUsd = (n) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const fmtTry = (n) => '₺' + Math.round(Number(n) || 0).toLocaleString('tr-TR');

/** Para birimine göre biçimler (sipariş kayıtları için). */
export const fmtMoney = (amount, currency = 'USD') => (currency === 'TRY' ? fmtTry(amount) : fmtUsd(amount));

/** Dile göre para birimi: TR → TRY, EN → USD. */
export const currencyForLang = (lang) => (lang === 'tr' ? 'TRY' : 'USD');

/**
 * const { currency, fmt, convert, ready } = useMoney();
 *  fmt(usd)     → "₺1.508" (TR) veya "$30" (EN)
 *  convert(usd) → seçili para biriminde sayı (TR'de tam lira)
 * Kur henüz yoksa TR'de de geçici olarak $ gösterir.
 */
export const useMoney = () => {
  const lang = useLangStore((s) => s.lang);
  const [rate, setRate] = useState(currentRate);
  useEffect(() => {
    if (lang !== 'tr' || rate) return;
    let alive = true;
    loadUsdTry().then((r) => alive && r && setRate(r));
    return () => {
      alive = false;
    };
  }, [lang, rate]);

  const tryMode = lang === 'tr' && rate > 0;
  return {
    currency: tryMode ? 'TRY' : 'USD',
    ready: lang !== 'tr' || rate > 0,
    rate,
    convert: (usd) => (tryMode ? usdToTry(usd, rate) : roundUsd(usd)),
    fmt: (usd) => (tryMode ? fmtTry(usdToTry(usd, rate)) : fmtUsd(usd)),
  };
};
