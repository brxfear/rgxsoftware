import React from 'react';
import { Link } from 'react-router-dom';
import { useT, localized } from '../../i18n';
import { ArrowRight, Star } from 'lucide-react';
import { getPlans, getStartPrice } from '../../lib/db';
import Price from '../Price';
import './ProductCard.css';

/** Ürün kartı: tıklanınca ürün sayfasına (/products/oyun/urun) gider. */
const ProductCard = ({ product, to, categoryName, highlight = false }) => {
  const { t, lang } = useT();
  const planCount = getPlans(product).length;
  const startPrice = getStartPrice(product);
  const image = product.image_url || product.image;

  return (
    <Link to={to} className={`product-card glass-card ${highlight ? 'is-highlight' : ''}`}>
      <div className="product-card-top">
        <div className="product-image-wrap">
          <img
            src={image || '/logo.webp'}
            alt={product.name}
            loading="lazy"
            className={`product-img ${image ? '' : 'product-img-fallback'}`}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/logo.webp';
              e.currentTarget.classList.add('product-img-fallback');
            }}
          />
          <div className="product-floating-badges">
            {highlight && <span className="badge-recommended"><Star size={11} fill="currentColor" /> {t('card.recommended')}</span>}
            <span className="status-badge-undetected">
              <span className="status-dot-green"></span>
              UNDETECTED
            </span>
          </div>
        </div>
      </div>

      <div className="product-card-body">
        <div className="product-meta">
          <span className="product-category-tag">{categoryName || t('card.fallbackCat')}</span>
          <span className="product-features-count">{t('card.plans', { n: planCount })}</span>
        </div>

        <h3 className="product-title">{product.name}</h3>
        <p className="product-description">{localized(product, 'description', lang)}</p>

        <div className="product-card-footer">
          <div className="price-block">
            <span className="price-label">{t('card.from')}</span>
            <Price usd={startPrice} className="price-value" />
          </div>
          <span className="select-btn">
            <span>{t('card.view')}</span>
            <ArrowRight size={15} />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
