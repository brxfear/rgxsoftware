import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getStartPrice } from '../lib/db';
import { categoryPath } from '../lib/slug';
import { useT } from '../i18n';
import Price from './Price';

/** Büyük oyun kartları (görselli): tıklanınca /products/<oyun> sayfasına gider. */
const GamesGrid = ({ categories, products }) => {
  const { t } = useT();
  return (
    <div className={`gs-grid ${categories.length === 1 ? 'gs-single' : ''}`}>
      {categories.map((cat) => {
        const list = products.filter((p) => p.category_id === cat.id);
        const minPrice = list.length ? Math.min(...list.map(getStartPrice)) : null;
        return (
          <Link key={cat.id} to={categoryPath(cat)} className="gs-card">
            {cat.image_url ? (
              <img className="gs-art" src={cat.image_url} alt="" loading="lazy" />
            ) : (
              <div className="gs-art gs-art-fallback"><img src="/logo.webp" alt="" /></div>
            )}
            <div className="gs-shade" aria-hidden="true" />
            <div className="gs-top">
              <span className="gs-chip"><span className="status-dot-green" /> {t('games.open')}</span>
              <span className="gs-chip">{t('games.count', { n: list.length })}</span>
            </div>
            <div className="gs-bottom">
              <strong className="gs-name">{cat.name}</strong>
              <span className="gs-sub">
                {minPrice !== null ? <>{t('games.from')} <Price usd={minPrice} className="gs-price" /></> : t('games.soon')}
                <ArrowRight size={16} />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default GamesGrid;
