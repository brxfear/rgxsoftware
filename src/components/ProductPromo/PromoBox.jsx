import React from 'react';
import { promoColor } from '../../lib/promo';
import './promo.css';

/** Tek başına 3D yazılım kutusu (tanıtım animasyonunda ve kampanya alanında kullanılır). */
const PromoBox = ({ product, className = '', style }) => {
  const name = (product?.promo_title || product?.name || 'RGX').trim();
  const tagline = (product?.promo_tagline || product?.badge || 'UNDETECTED · RGX SOFTWARE').trim();
  return (
    <div className={`promo-box ${className}`} style={{ '--pc': promoColor(product), ...style }}>
      <div className="pb-face pb-front">
        <span className="pb-bar" />
        <div className="pb-front-mid">
          <img src="/logo.webp" alt="" className="pb-logo" />
          <strong className="pb-name" lang="en">{name}</strong>
          <small className="pb-brand">RGX SOFTWARE</small>
        </div>
        <span className="pb-bar pb-bar-b" />
        <span className="pb-gloss" />
      </div>
      <div className="pb-face pb-side"><span lang="en">{tagline}</span></div>
      <div className="pb-face pb-top" />
      <div className="pb-face pb-back" />
      <div className="pb-face pb-right" />
      <div className="pb-face pb-bottom" />
    </div>
  );
};

export default PromoBox;
