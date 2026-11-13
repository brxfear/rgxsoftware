import React, { useState } from 'react';
import { Copy, Check, Download, KeyRound, StickyNote } from 'lucide-react';
import { useT, planLabel } from '../../i18n';

const CopyKey = ({ value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="od-key">
      <code>{value}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Kopyala"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
};

const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

/** Teslim edilen key / link / not listesi (müşteri görünümü). */
const OrderDelivery = ({ delivery }) => {
  const { t, lang } = useT();
  const items = delivery?.items || [];
  if (!items.some((i) => i.keys?.length || i.link || i.note)) return null;
  return (
    <div className="od">
      <span className="od-title"><KeyRound size={13} /> {t('delivery.title')}</span>
      {items.map((it, idx) => (
        <div key={idx} className="od-item">
          <strong>{it.name} <em>· {planLabel(it.durationLabel, lang)}</em></strong>
          {(it.keys || []).map((k, j) => <CopyKey key={j} value={k} />)}
          {safeUrl(it.link) && (
            <a className="od-link" href={safeUrl(it.link)} target="_blank" rel="noopener noreferrer">
              <Download size={14} /> {t('delivery.download')}
            </a>
          )}
          {it.note && <p className="od-note"><StickyNote size={13} /> {it.note}</p>}
        </div>
      ))}
    </div>
  );
};

export default OrderDelivery;
