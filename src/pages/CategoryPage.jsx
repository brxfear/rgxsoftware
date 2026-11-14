import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown } from 'lucide-react';
import ProductCard from '../components/ProductCard/ProductCard';
import Price from '../components/Price';
import { useShopStore } from '../store/useShopStore';
import { categorySlug, productPath } from '../lib/slug';
import { getStartPrice } from '../lib/db';
import { usePageTitle } from '../lib/usePageTitle';
import { useT, localized } from '../i18n';

const SORTS = {
  featured: () => 0,
  priceAsc: (a, b) => getStartPrice(a) - getStartPrice(b),
  priceDesc: (a, b) => getStartPrice(b) - getStartPrice(a),
  name: (a, b) => a.name.localeCompare(b.name, 'tr'),
};

/** /products/:cat — tek oyunun ürünleri */
const CategoryPage = () => {
  const { t, lang } = useT();
  const { cat: slug } = useParams();
  const categories = useShopStore((s) => s.categories);
  const products = useShopStore((s) => s.products);
  const loading = useShopStore((s) => s.loading);
  const [sort, setSort] = useState('featured');

  const category = categories.find((c) => categorySlug(c) === slug);
  usePageTitle(category?.name || t('shop.title'));

  const list = useMemo(() => {
    if (!category) return [];
    const items = products.filter((p) => p.category_id === category.id);
    return sort === 'featured' ? items : [...items].sort(SORTS[sort]);
  }, [category, products, sort]);

  if (loading) return <div className="page container"><div className="empty-state">{t('products.loading')}</div></div>;

  if (!category) {
    return (
      <div className="page container">
        <div className="empty-state">
          <p>{t('shop.notFound')}</p>
          <Link className="btn-secondary" to="/products">{t('shop.back')}</Link>
        </div>
      </div>
    );
  }

  const minPrice = list.length ? Math.min(...list.map(getStartPrice)) : null;
  const desc = localized(category, 'description', lang) || t('category.sub', { name: category.name });

  return (
    <div className="page container">
      <nav className="crumbs" aria-label="breadcrumb">
        <Link to="/">{t('nav.home')}</Link>
        <span>/</span>
        <Link to="/products">{t('shop.title')}</Link>
        <span>/</span>
        <strong>{category.name}</strong>
      </nav>

      <section className="cat-hero">
        {category.image_url && <img className="cat-hero-bg" src={category.image_url} alt="" aria-hidden="true" />}
        <div className="cat-hero-shade" aria-hidden="true" />
        <div className="cat-hero-inner">
          <span className="cat-hero-chip"><span className="status-dot-green" /> {category.name}</span>
          <h1 className="cat-hero-title">{t('category.title', { name: category.name })}</h1>
          <p className="cat-hero-sub">{desc}</p>
          <button className="btn-primary" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>
            {t('category.toCatalog')} <ArrowDown size={16} />
          </button>
          <div className="cat-hero-stats">
            <div>
              {minPrice !== null ? <Price usd={minPrice} className="cat-hero-num" /> : <strong className="cat-hero-num">—</strong>}
              <span>{t('games.from')}</span>
            </div>
            <div>
              <strong className="cat-hero-num">{list.length}</strong>
              <span>{t('category.products')}</span>
            </div>
          </div>
        </div>
      </section>

      <div id="catalog" className="catalog-bar">
        <span>{t('games.count', { n: list.length })}</span>
        <label className="sort-select">
          <span>{t('category.sort')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">{t('category.sortFeatured')}</option>
            <option value="priceAsc">{t('category.sortPriceAsc')}</option>
            <option value="priceDesc">{t('category.sortPriceDesc')}</option>
            <option value="name">{t('category.sortName')}</option>
          </select>
        </label>
      </div>

      {list.length ? (
        <div className="product-grid product-grid-4">
          {list.map((p, i) => (
            <ProductCard key={p.id} product={p} to={productPath(p, categories)} categoryName={category.name} highlight={sort === 'featured' && i === 0} />
          ))}
        </div>
      ) : (
        <div className="empty-state">{t('products.empty')}</div>
      )}
    </div>
  );
};

export default CategoryPage;
