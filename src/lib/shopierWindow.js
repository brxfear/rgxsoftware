// Shopier ödeme sayfası iframe'e izin vermediği için ekranın ortasında küçük bir ödeme penceresi açılır.
// Pencere engellenirse aynı sekmede Shopier'e gidilir; siteye dönünce bekleyen ödeme otomatik kontrol edilir.
const PENDING_KEY = 'rgx_pending_payment';

const features = () => {
  const w = Math.min(520, window.screen.availWidth - 40);
  const h = Math.min(820, window.screen.availHeight - 60);
  const left = Math.max(0, (window.screenX ?? window.screenLeft ?? 0) + (window.outerWidth - w) / 2);
  const top = Math.max(0, (window.screenY ?? window.screenTop ?? 0) + (window.outerHeight - h) / 2);
  return `popup=yes,width=${Math.round(w)},height=${Math.round(h)},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`;
};

const loadingHtml = (text) => `<!doctype html><html><head><meta charset="utf-8"><title>Shopier</title>
<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0708;color:#f5f5f6;font-family:system-ui,sans-serif}
.s{width:34px;height:34px;border:3px solid rgba(255,255,255,.15);border-top-color:#e0262f;border-radius:50%;animation:r .8s linear infinite;margin:0 auto 14px}
@keyframes r{to{transform:rotate(360deg)}}</style></head><body><div style="text-align:center"><div class="s"></div>${text}</div></body></html>`;

/**
 * Tıklama anında çağrılmalı (açılır pencere engelleyicisine takılmamak için).
 * url verilmezse önce yükleniyor ekranı gösterir; sonra setUrl(url) ile Shopier'e geçilir.
 */
export const openPaymentWindow = (loadingText = '…', url = null) => {
  let win = null;
  try {
    win = window.open(url || '', 'rgx_shopier_payment', features());
  } catch {
    win = null;
  }
  if (win && !url) {
    try {
      win.document.open();
      win.document.write(loadingHtml(loadingText));
      win.document.close();
    } catch {
      /* yoksay */
    }
  }
  if (win) win.focus?.();
  return win;
};

/** Aynı sekmede Shopier'e git; dönüşte kontrol edilmek üzere bekleyen ödemeyi hatırla. */
export const redirectSameTab = (url, orderId, key) => {
  savePendingPayment(orderId, key);
  window.location.href = url;
};

export const savePendingPayment = (orderId, key) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ orderId, key, at: Date.now() }));
  } catch {
    /* yoksay */
  }
};

export const readPendingPayment = () => {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    if (p && Date.now() - p.at < 2 * 60 * 60 * 1000) return p;
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* yoksay */
  }
  return null;
};

export const clearPendingPayment = () => {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* yoksay */
  }
};
