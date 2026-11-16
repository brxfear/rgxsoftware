import React from 'react';
import { Zap, MessageCircle, CreditCard, ShieldCheck } from 'lucide-react';
import PromoBox from '../ProductPromo/PromoBox';
import { hasPromo } from '../../lib/promo';
import { useShopStore } from '../../store/useShopStore';
import { useT } from '../../i18n';
import './hero-stage.css';

const FEATURES = {
  tr: [
    [Zap, 'Anında teslimat', 'Ödeme sonrası key e-postana gelir', 'a'],
    [MessageCircle, '7/24 Türkçe destek', 'Kurulumda Discord’dan yardım', 'b'],
    [CreditCard, 'Kart · Havale · Bakiye', 'Shopier ile güvenli ödeme', 'c'],
  ],
  en: [
    [Zap, 'Instant delivery', 'Your key arrives right after payment', 'a'],
    [MessageCircle, '24/7 support', 'Setup help on Discord', 'b'],
    [CreditCard, 'Card · Transfer · Balance', 'Secure payment via Shopier', 'c'],
  ],
};

/**
 * Ana sayfa vitrini: ürün menüsü ekran görüntüsü (yoksa tanıtım videosu) çerçevede,
 * etrafında süzülen özellik kartları ve 3D ürün kutuları.
 */
const HeroStage = () => {
  const { t, lang } = useT();
  const categories = useShopStore((s) => s.categories);
  const products = useShopStore((s) => s.products);
  const shot = products.map((p) => p.menu_image_url || p.extra_images?.[0]).find(Boolean);
  const boxes = products.filter(hasPromo).slice(0, 2);
  const feats = FEATURES[lang] || FEATURES.tr;

  return (
    <div className="hs">
      <div className="hs-glow" aria-hidden="true" />

      <div className="hero-showcase hs-frame">
        <div className="showcase-topbar">
          <span className="showcase-chip showcase-chip-live">UNDETECTED</span>
          <span className="showcase-chip">{t('hero.support')}</span>
          <span className="showcase-chip">{t('hero.games', { n: categories.length || '—' })}</span>
          <span className="showcase-rec"><span className="rec-dot" /> RGX</span>
        </div>
        {shot ? (
          <img className="showcase-video" src={shot} alt="RGX menü" />
        ) : (
          <video className="showcase-video" src="/media/hero-loop.mp4" poster="/media/hero-loop-poster.webp" autoPlay muted loop playsInline preload="metadata" />
        )}
        <div className="showcase-vignette" aria-hidden="true" />
      </div>

      {feats.map(([Icon, title, sub, k]) => (
        <div key={k} className={`hs-card hs-card-${k}`}>
          <span className="hs-card-ico"><Icon size={17} /></span>
          <div><strong>{title}</strong><small>{sub}</small></div>
        </div>
      ))}

      <div className="hs-badge"><ShieldCheck size={14} /> UNDETECTED</div>

      {boxes.map((p, i) => (
        <div key={p.id} className={`hs-box ${i ? 'is-r' : 'is-l'}`} aria-hidden="true">
          <PromoBox product={p} />
        </div>
      ))}
    </div>
  );
};

export default HeroStage;
