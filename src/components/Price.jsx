import React from 'react';
import { useMoney } from '../lib/currency';

/** $ fiyatı seçili dile göre gösterir: TR → ₺ (güncel kur), EN → $. */
const Price = ({ usd, className = '' }) => {
  const { fmt } = useMoney();
  return <span className={`price-usd-only ${className}`}>{fmt(usd)}</span>;
};

export default Price;
