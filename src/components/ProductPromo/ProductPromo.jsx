import React, { useEffect, useRef, useState } from 'react';
import { featureBullets } from '../../lib/status';
import { useT, localized } from '../../i18n';
import { promoColor } from '../../lib/promo';
import './promo.css';

const promoLines = (product, lang) => {
  const bullets = featureBullets(localized(product, 'details', lang), 4);
  if (bullets.length) return bullets;
  const desc = localized(product, 'description', lang);
  return desc ? [desc] : [];
};

/**
 * Nova tarzı hareketli ürün tanıtımı: ok desenli arka plan, ürün renginde ışıma,
 * dönen 3D yazılım kutusu ve sırayla beliren özellik satırları. Tamamen CSS; ekrandan
 * çıkınca durur, "hareketi azalt" açık olan kullanıcılarda sabit görünür.
 */
const ProductPromo = ({ product, compact = false }) => {
  const { lang } = useT();
  const ref = useRef(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const lines = promoLines(product, lang);
  const name = (product.promo_title || product.name || '').trim();
  const tagline = (product.promo_tagline || product.badge || 'UNDETECTED · RGX SOFTWARE').trim();

  return (
    <div
      ref={ref}
      className={`promo ${compact ? 'promo-compact' : ''} ${visible ? '' : 'is-paused'}`}
      style={{ '--pc': promoColor(product) }}
      aria-label={name}
      role="img"
    >
      <div className="promo-bg" />
      <div className="promo-glow" />

      <div className="promo-stage">
        <div className="promo-enter">
          <div className="promo-box">
            <div className="pb-face pb-front">
              <span className="pb-bar" />
              <div className="pb-front-mid">
                <img src="/logo.webp" alt="" className="pb-logo" />
                <strong className="pb-name">{name}</strong>
                <small className="pb-brand">RGX SOFTWARE</small>
              </div>
              <span className="pb-bar pb-bar-b" />
              <span className="pb-gloss" />
            </div>
            <div className="pb-face pb-side"><span>{tagline}</span></div>
            <div className="pb-face pb-top" />
            <div className="pb-face pb-back" />
            <div className="pb-face pb-right" />
            <div className="pb-face pb-bottom" />
          </div>
          <div className="promo-shadow" />
        </div>
      </div>

      <div className="promo-copy">
        <strong className="promo-title">
          RGX <i aria-hidden="true">✦</i> {name.replace(/^rgx\s+/i, '')}
        </strong>
        {lines.map((l, i) => (
          <span key={l} className="promo-line" style={{ '--i': i + 1 }}>{l}</span>
        ))}
      </div>
    </div>
  );
};

export default ProductPromo;
