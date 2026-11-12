import React from 'react';
import { useUsdTry, usdToTry, fmtTry, fmtUsd } from '../lib/currency';

/**
 * $ fiyatı güncel kurla ₺ olarak gösterir, yanında küçük $ karşılığı.
 * Kur alınamazsa sadece $ gösterilir.
 */
const Price = ({ usd, className = '', inline = false }) => {
  const rate = useUsdTry();
  const tryValue = usdToTry(usd, rate);
  if (tryValue === null) {
    return <span className={`price-dual ${className}`}><span className="price-try">{fmtUsd(usd)}</span></span>;
  }
  return (
    <span className={`price-dual ${inline ? 'price-inline' : ''} ${className}`}>
      <span className="price-try">{fmtTry(tryValue)}</span>
      <span className="price-usd">{fmtUsd(usd)}</span>
    </span>
  );
};

export default Price;
