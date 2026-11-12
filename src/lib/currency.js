// Tüm fiyatlar ve ödemeler $ (USD).
export const fmtUsd = (n) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Kuruş hatalarını önlemek için 2 basamağa yuvarlar. */
export const roundUsd = (n) => Math.round((Number(n) || 0) * 100) / 100;
