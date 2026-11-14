import React from 'react';
import { STATUS_TONE, statusOf } from '../lib/status';
import { useT } from '../i18n';

/** "Undetected · Online" gibi ürün durum rozeti */
const StatusPill = ({ product, status, className = '' }) => {
  const { t } = useT();
  const s = status || statusOf(product);
  return (
    <span className={`st-pill st-${STATUS_TONE[s]} ${className}`}>
      <span className="st-dot" />
      {t(`status.s.${s}`)}
    </span>
  );
};

export default StatusPill;
