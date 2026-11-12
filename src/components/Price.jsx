import React from 'react';
import { fmtUsd } from '../lib/currency';

/** $ fiyat. */
const Price = ({ usd, className = '' }) => <span className={`price-usd-only ${className}`}>{fmtUsd(usd)}</span>;

export default Price;
