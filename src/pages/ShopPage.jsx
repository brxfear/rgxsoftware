import React from 'react';
import { Link } from 'react-router-dom';
import GamesGrid from '../components/GamesGrid';
import { useShopStore } from '../store/useShopStore';
import { usePageTitle } from '../lib/usePageTitle';
import { useT } from '../i18n';

/** /products — tüm oyunlar */
const ShopPage = () => {
  const { t } = useT();
  usePageTitle(t('shop.title'));
  const categories = useShopStore((s) => s.categories);
  const products = useShopStore((s) => s.products);
  const loading = useShopStore((s) => s.loading);

  return (
    <div className="page container">
      <nav className="crumbs" aria-label="breadcrumb">
        <Link to="/">{t('nav.home')}</Link>
        <span>/</span>
        <strong>{t('shop.title')}</strong>
      </nav>
      <header className="page-head">
        <h1 className="page-title">{t('shop.title')}</h1>
        <p className="page-sub">{t('shop.sub')}</p>
      </header>
      <div className="page-meta-row">
        <span>{t('shop.games', { n: categories.length })}</span>
        <span>{t('shop.products', { n: products.length })}</span>
      </div>
      {loading ? (
        <div className="empty-state">{t('products.loading')}</div>
      ) : categories.length ? (
        <GamesGrid categories={categories} products={products} />
      ) : (
        <div className="empty-state">{t('products.empty')}</div>
      )}
    </div>
  );
};

export default ShopPage;
