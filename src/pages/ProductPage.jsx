import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingCart, Zap, ShieldCheck, Headphones, ChevronLeft, ChevronRight, Check, Star, Minus, Plus, Lock, Lightbulb } from 'lucide-react';
import ProductCard from '../components/ProductCard/ProductCard';
import { useShopStore, useDiscordUrl } from '../store/useShopStore';
import { useCartStore } from '../store/useCartStore';
import { getPlans } from '../lib/db';
import { categorySlug, productSlug, productPath } from '../lib/slug';
import { useMoney } from '../lib/currency';
import { usePageTitle } from '../lib/usePageTitle';
import { useT, planLabel, localized } from '../i18n';
import './product.css';

const youtubeEmbed = (url) => {
  const m = url?.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return m && m[2].length === 11 ? `https://www.youtube.com/embed/${m[2]}` : null;
};

/** Plan adından gün sayısı: "7 Gün" → 7, "1 Ay" → 30. Sınırsız/bilinmeyen → null */
const planDays = (label = '') => {
  const m = label.toLocaleLowerCase('tr-TR').match(/(\d+)\s*(gün|gun|day|hafta|week|ay|month)/);
  if (!m) return null;
  const n = Number(m[1]);
  return /hafta|week/.test(m[2]) ? n * 7 : /ay|month/.test(m[2]) ? n * 30 : n;
};

const ProductView = ({ product, category, categories, products }) => {
  const { t, lang } = useT();
  const { fmt } = useMoney();
  const discordUrl = useDiscordUrl();
  const plans = useMemo(() => getPlans(product), [product]);
  const [planId, setPlanId] = useState(() => (plans.find((p) => p.id === product.featured_plan_id) || plans[0])?.id ?? null);
  const [qty, setQty] = useState(1);
  const [index, setIndex] = useState(0);

  const media = useMemo(() => {
    const list = [];
    if (product.video_url) list.push({ type: 'video', url: product.video_url });
    if (product.image_url) list.push({ type: 'image', url: product.image_url });
    (product.extra_images || []).forEach((url) => url && list.push({ type: 'image', url }));
    if (!list.length) list.push({ type: 'image', url: '/logo.webp', fallback: true });
    return list;
  }, [product]);

  useEffect(() => {
    if (media.length < 2) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % media.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + media.length) % media.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media.length]);

  const selected = plans.find((p) => p.id === planId) || null;
  const current = media[index];
  const embed = current?.type === 'video' ? youtubeEmbed(current.url) : null;

  // Günlük fiyat ve en kısa plana göre tasarruf
  const base = plans
    .map((p) => ({ p, d: planDays(p.label) }))
    .filter((x) => x.d)
    .sort((a, b) => a.d - b.d)[0];
  const perDay = (p) => {
    const d = planDays(p.label);
    return d ? Number(p.price_usd) / d : null;
  };
  const saving = (p) => {
    const pd = perDay(p);
    if (!pd || !base || base.p.id === p.id) return 0;
    const baseDay = Number(base.p.price_usd) / base.d;
    return Math.round((1 - pd / baseDay) * 100);
  };
  const bestValue = plans.reduce((best, p) => (saving(p) > (best ? saving(best) : 0) ? p : best), null);
  const upsell = selected && bestValue && bestValue.id !== selected.id && saving(bestValue) - saving(selected) >= 10 ? bestValue : null;

  const item = () => ({
    id: `buy-${product.id}-${selected.id}`,
    product_id: product.id,
    name: product.name,
    price: Number(selected.price_usd),
    duration: selected.id,
    durationLabel: selected.label,
    image: product.image_url || '',
    quantity: qty,
  });

  const buy = () => selected && useShopStore.getState().openCheckout(item());
  const add = async () => {
    if (!selected) return;
    const payload = { ...product, selectedDuration: selected.id, selectedPrice: Number(selected.price_usd), selectedLabel: selected.label };
    for (let i = 0; i < qty; i++) await useCartStore.getState().addItem(payload);
  };

  const related = products.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 4);
  const description = localized(product, 'description', lang);
  const details = localized(product, 'details', lang);

  return (
    <>
      <nav className="crumbs" aria-label="breadcrumb">
        <Link to="/products">{t('shop.title')}</Link>
        <span>/</span>
        {category && (
          <>
            <Link to={`/products/${categorySlug(category)}`}>{category.name}</Link>
            <span>/</span>
          </>
        )}
        <strong>{product.name}</strong>
      </nav>

      <header className="pp-head">
        <h1 className="page-title">{product.name}</h1>
        <div className="pp-head-chips">
          {category && <span className="pm-chip">{category.name}</span>}
          <span className="pm-chip pm-chip-ok"><span className="status-dot-green" /> Undetected</span>
        </div>
        <p className="pp-head-sub">{t('product.tagline')}</p>
      </header>

      <div className="pp-grid">
        <div className="pp-left">
          <div className="pm-media pp-media">
            {current?.type === 'video' ? (
              embed ? (
                <iframe src={embed} title={product.name} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              ) : (
                <video src={current.url} controls playsInline />
              )
            ) : (
              <img src={current?.url} alt={product.name} className={current?.fallback ? 'is-fallback' : ''} />
            )}
            {media.length > 1 && (
              <>
                <button className="pm-nav prev" onClick={() => setIndex((i) => (i - 1 + media.length) % media.length)} aria-label={t('product.prev')}><ChevronLeft size={18} /></button>
                <button className="pm-nav next" onClick={() => setIndex((i) => (i + 1) % media.length)} aria-label={t('product.next')}><ChevronRight size={18} /></button>
              </>
            )}
          </div>
          {media.length > 1 && (
            <div className="pm-thumbs">
              {media.map((m, i) => (
                <button key={i} className={i === index ? 'on' : ''} onClick={() => setIndex(i)} aria-label={`${t('product.media')} ${i + 1}`}>
                  {m.type === 'video' ? <span className="pm-thumb-video">▶</span> : <img src={m.url} alt="" />}
                </button>
              ))}
            </div>
          )}

        </div>

        <aside className="pp-buy">
          <div className="pp-box">
            <span className="pp-box-label">{t('product.choosePlan')}</span>
            <div className="pp-plans" role="radiogroup" aria-label={t('modal.choosePlan')}>
              {plans.map((p) => {
                const on = p.id === planId;
                const pd = perDay(p);
                const s = saving(p);
                return (
                  <button key={p.id} role="radio" aria-checked={on} className={`pp-plan ${on ? 'on' : ''}`} onClick={() => setPlanId(p.id)}>
                    <span className="pm-radio">{on && <Check size={12} strokeWidth={3} />}</span>
                    <span className="pp-plan-text">
                      <strong>{planLabel(p.label, lang)}</strong>
                      {pd && planDays(p.label) > 1 && (
                        <small>
                          {t('product.perDay', { price: fmt(pd) })}
                          {s > 0 && <em> · {t('product.save', { n: s })}</em>}
                        </small>
                      )}
                    </span>
                    {p.id === product.featured_plan_id && <span className="pp-plan-badge"><Star size={10} fill="currentColor" /> {t('modal.popular')}</span>}
                    {p.id !== product.featured_plan_id && bestValue?.id === p.id && <span className="pp-plan-badge">{t('product.bestValue')}</span>}
                    <span className="pp-plan-price">{fmt(p.price_usd)}</span>
                  </button>
                );
              })}
              {!plans.length && <p className="pm-empty">{t('modal.notForSale')}</p>}
            </div>
          </div>

          {upsell && (
            <div className="pp-upsell">
              <Lightbulb size={16} />
              <span>{t('product.upsell', { plan: planLabel(upsell.label, lang), n: saving(upsell) })}</span>
              <button onClick={() => setPlanId(upsell.id)}>{t('product.switch')}</button>
            </div>
          )}

          <div className="pp-box pp-qty">
            <span>{t('product.qty')}</span>
            <div className="pp-qty-ctrl">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="-"><Minus size={14} /></button>
              <strong>{qty}</strong>
              <button onClick={() => setQty((q) => Math.min(10, q + 1))} disabled={qty >= 10} aria-label="+"><Plus size={14} /></button>
            </div>
          </div>

          <div className="pp-total">
            <span>{selected ? `${planLabel(selected.label, lang)}${qty > 1 ? ` × ${qty}` : ''}` : ''}</span>
            <strong>{selected ? fmt(Number(selected.price_usd) * qty) : '—'}</strong>
          </div>

          <button className="pm-cta" onClick={buy} disabled={!selected}>
            <Lock size={16} /> {t('product.checkout')}{selected ? ` — ${fmt(Number(selected.price_usd) * qty)}` : ''}
          </button>
          <button className="pm-cta-secondary" onClick={add} disabled={!selected}>
            <ShoppingCart size={16} /> {t('modal.addToCart')}
          </button>

          <div className="pp-perks">
            <span><Zap size={15} /> {t('modal.perk1')}</span>
            <span><ShieldCheck size={15} /> {t('modal.perk2')}</span>
            <a href={discordUrl} target="_blank" rel="noopener noreferrer"><Headphones size={15} /> {t('modal.perk3')}</a>
            <Link to="/reviews"><Star size={15} /> {t('product.reviews')}</Link>
          </div>
        </aside>

        {(description || details) && (
          <div className="pp-info">
            {description && <p className="pm-desc">{description}</p>}
            {details && (
              <>
                <h2>{t('modal.features')}</h2>
                <div className="pm-details">{details}</div>
              </>
            )}
          </div>
        )}
      </div>

      {related.length > 0 && (
        <section className="section-block pp-related">
          <h2 className="section-title">{t('product.related')}</h2>
          <div className="product-grid product-grid-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} to={productPath(p, categories)} categoryName={category?.name} />
            ))}
          </div>
        </section>
      )}
    </>
  );
};

/** /products/:cat/:product */
const ProductPage = () => {
  const { t } = useT();
  const { product: slug } = useParams();
  const categories = useShopStore((s) => s.categories);
  const products = useShopStore((s) => s.products);
  const loading = useShopStore((s) => s.loading);
  const product = products.find((p) => productSlug(p) === slug || p.id === slug);
  const category = product && categories.find((c) => c.id === product.category_id);
  usePageTitle(product?.name || t('shop.title'));

  return (
    <div className="page container">
      {loading ? (
        <div className="empty-state">{t('products.loading')}</div>
      ) : !product ? (
        <div className="empty-state">
          <p>{t('product.notFound')}</p>
          <Link className="btn-secondary" to="/products">{t('shop.back')}</Link>
        </div>
      ) : (
        <ProductView key={product.id} product={product} category={category} categories={categories} products={products} />
      )}
    </div>
  );
};

export default ProductPage;
