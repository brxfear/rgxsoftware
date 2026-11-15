import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Maximize2, Star } from 'lucide-react';
import StatusPill from '../StatusPill';
import Lightbox from '../Lightbox';
import ProductPromo from '../ProductPromo/ProductPromo';
import { hasPromo } from '../../lib/promo';
import { getPlans } from '../../lib/db';
import { featureBullets, statusOf, STATUS_TONE } from '../../lib/status';
import { useMoney } from '../../lib/currency';
import { useT, localized, planLabel } from '../../i18n';

/**
 * Oyun sayfasındaki büyük ürün kartı: Ürün PP / Menü SS geçişi, tam ekran menü görseli,
 * özellik maddeleri ve tüm plan fiyatları.
 */
const RichProductCard = ({ product, to, categoryName, highlight = false }) => {
  const { t, lang } = useT();
  const { fmt } = useMoney();
  const promo = hasPromo(product);
  const [tab, setTab] = useState(promo ? 'promo' : 'pp');
  const [zoom, setZoom] = useState(null);
  const plans = getPlans(product);
  const bullets = featureBullets(localized(product, 'details', lang));
  const menu = product.menu_image_url || product.extra_images?.[0] || '';
  const cover = product.image_url || '';
  const shown = tab === 'menu' && menu ? menu : cover;
  const tabs = [promo && ['promo', t('rich.promo')], (cover || !promo) && ['pp', t('rich.pp')], menu && ['menu', t('rich.menu')]].filter(Boolean);
  const tone = STATUS_TONE[statusOf(product)];

  return (
    <article className={`rpc ${highlight ? 'is-highlight' : ''} rpc-${tone}`}>
      <div className="rpc-media">
        {tab === 'promo' ? (
          <ProductPromo product={product} compact />
        ) : shown ? (
          <img src={shown} alt={product.name} loading="lazy" className={tab === 'menu' ? 'is-menu' : ''} />
        ) : (
          <div className="rpc-fallback"><img src="/logo.webp" alt="" /><strong>{product.name}</strong></div>
        )}
        <div className="rpc-media-top">
          <StatusPill product={product} />
          {tabs.length > 1 && (
            <div className="rpc-tabs" role="tablist">
              {tabs.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>
          )}
        </div>
        {highlight && <span className="rpc-reco"><Star size={11} fill="currentColor" /> {t('card.recommended')}</span>}
      </div>

      {menu && (
        <button className="rpc-ss" onClick={() => setZoom(menu)}>
          <img src={menu} alt="" loading="lazy" />
          <span>
            <strong>{product.name} — {t('rich.menuTitle')}</strong>
            <small>{t('rich.menuHint')}</small>
          </span>
          <Maximize2 size={15} />
        </button>
      )}

      <div className="rpc-body">
        <div className="rpc-meta">
          <span>{categoryName} · {t('card.plans', { n: plans.length })}</span>
          {product.badge && <span className="rpc-badge">{product.badge}</span>}
        </div>
        <h3 className="rpc-title">{product.name}</h3>
        {localized(product, 'description', lang) && <p className="rpc-desc">{localized(product, 'description', lang)}</p>}

        {bullets.length > 0 && (
          <ul className="rpc-bullets">
            {bullets.map((b) => (
              <li key={b}><Check size={14} strokeWidth={3} /> {b}</li>
            ))}
          </ul>
        )}

        <div className="rpc-plans">
          {plans.map((p) => (
            <Link key={p.id} to={to} className="rpc-plan">
              <span>
                {planLabel(p.label, lang)}
                {p.id === product.featured_plan_id && <em>{t('modal.popular')}</em>}
              </span>
              <strong>{fmt(p.price_usd)}</strong>
            </Link>
          ))}
        </div>

        <Link to={to} className="rpc-cta">
          {t('rich.cta')} <ArrowRight size={16} />
        </Link>
      </div>

      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </article>
  );
};

export default RichProductCard;
