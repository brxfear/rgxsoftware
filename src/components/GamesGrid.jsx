import React from 'react';
import { Link } from 'react-router-dom';
import { getStartPrice } from '../lib/db';
import { categoryPath } from '../lib/slug';
import { useT } from '../i18n';
import Price from './Price';

/** Oyun kartları: tıklanınca /products/<oyun> sayfasına gider. */
const GamesGrid = ({ categories, products }) => {
  const { t } = useT();
  return (
    <div className="games-grid">
      {categories.map((cat) => {
        const list = products.filter((p) => p.category_id === cat.id);
        const minPrice = list.length ? Math.min(...list.map(getStartPrice)) : null;
        return (
          <Link key={cat.id} to={categoryPath(cat)} className="game-card">
            <div className="game-card-media">
              {cat.image_url ? (
                <img src={cat.image_url} alt={cat.name} loading="lazy" />
              ) : (
                <div className="game-card-fallback">
                  <img src="/logo.webp" alt="" />
                </div>
              )}
              <span className="game-card-count">{t('games.count', { n: list.length })}</span>
            </div>
            <div className="game-card-body">
              <span className="game-card-name">{cat.name}</span>
              <div className="game-card-meta">
                {minPrice !== null ? (
                  <span>{t('games.from')} <Price usd={minPrice} className="game-card-price" /></span>
                ) : (
                  <span>{t('games.soon')}</span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default GamesGrid;
