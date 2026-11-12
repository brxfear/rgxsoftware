import React, { useEffect, useMemo, useState } from 'react';
import { X, ShoppingCart, Zap, ShieldCheck, Headphones, ChevronLeft, ChevronRight, Check, Star } from 'lucide-react';
import { getPlans } from '../../lib/db';
import { useMoney } from '../../lib/currency';
import { useT, planLabel, localized } from '../../i18n';
import './ProductModal.css';

const youtubeEmbed = (url) => {
  const m = url?.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return m && m[2].length === 11 ? `https://www.youtube.com/embed/${m[2]}` : null;
};

const ProductModal = ({ isOpen, onClose, product, onAddToCart, onBuyNow, categoryName }) => {
  const { t, lang } = useT();
  const { fmt } = useMoney();
  // App bu bileşeni key={ürün id} ile verir; her ürün açılışında state sıfırdan kurulur.
  const [index, setIndex] = useState(0);
  const [planId, setPlanId] = useState(() => {
    const list = product ? getPlans(product) : [];
    return (list.find((p) => p.id === product?.featured_plan_id) || list[0])?.id ?? null;
  });

  const plans = useMemo(() => (product ? getPlans(product) : []), [product]);

  const media = useMemo(() => {
    if (!product) return [];
    const list = [];
    if (product.video_url) list.push({ type: 'video', url: product.video_url });
    if (product.image_url || product.image) list.push({ type: 'image', url: product.image_url || product.image });
    (product.extra_images || []).forEach((url) => url && list.push({ type: 'image', url }));
    if (!list.length) list.push({ type: 'image', url: '/logo.webp', fallback: true });
    return list;
  }, [product]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && media.length > 1) setIndex((i) => (i + 1) % media.length);
      if (e.key === 'ArrowLeft' && media.length > 1) setIndex((i) => (i - 1 + media.length) % media.length);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose, media.length]);

  if (!isOpen || !product) return null;

  const selected = plans.find((p) => p.id === planId) || null;
  const current = media[index];
  const embed = current?.type === 'video' ? youtubeEmbed(current.url) : null;
  const cheapest = plans.length ? Math.min(...plans.map((p) => Number(p.price_usd))) : 0;

  const payload = () => ({
    ...product,
    selectedDuration: selected.id,
    selectedPrice: Number(selected.price_usd),
    selectedLabel: selected.label,
  });

  const add = () => {
    if (!selected) return;
    onAddToCart(payload());
    onClose();
  };

  const buy = () => {
    if (!selected) return;
    (onBuyNow || onAddToCart)(payload());
    onClose();
  };

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" role="dialog" aria-modal="true" aria-label={product.name} onClick={(e) => e.stopPropagation()}>
        <button className="pm-close" onClick={onClose} aria-label={t('modal.close')}><X size={18} /></button>

        <div className="pm-grid">
          {/* -------- Sol üst: medya -------- */}
          <div className="pm-main">
            <div className="pm-media">
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
                  <button className="pm-nav prev" onClick={() => setIndex((i) => (i - 1 + media.length) % media.length)} aria-label="Önceki"><ChevronLeft size={18} /></button>
                  <button className="pm-nav next" onClick={() => setIndex((i) => (i + 1) % media.length)} aria-label="Sonraki"><ChevronRight size={18} /></button>
                </>
              )}
            </div>

            {media.length > 1 && (
              <div className="pm-thumbs">
                {media.map((m, i) => (
                  <button key={i} className={i === index ? 'on' : ''} onClick={() => setIndex(i)} aria-label={`Medya ${i + 1}`}>
                    {m.type === 'video' ? <span className="pm-thumb-video">▶</span> : <img src={m.url} alt="" />}
                  </button>
                ))}
              </div>
            )}

          </div>

          {/* -------- Sağ: satın alma -------- */}
          <aside className="pm-buy">
            <div className="pm-badges">
              {categoryName && <span className="pm-chip">{categoryName}</span>}
              <span className="pm-chip pm-chip-ok"><span className="status-dot-green" /> Undetected</span>
            </div>
            <h2 className="pm-title">{product.name}</h2>
            <p className="pm-from">{t('modal.from')} <strong>{fmt(cheapest)}</strong></p>

            <div className="pm-plans" role="radiogroup" aria-label={t('modal.choosePlan')}>
              {plans.map((p) => {
                const on = p.id === planId;
                return (
                  <button key={p.id} role="radio" aria-checked={on} className={`pm-plan ${on ? 'on' : ''}`} onClick={() => setPlanId(p.id)}>
                    <span className="pm-radio">{on && <Check size={12} strokeWidth={3} />}</span>
                    <span className="pm-plan-label">
                      {planLabel(p.label, lang)}
                      {p.id === product.featured_plan_id && <em><Star size={10} fill="currentColor" /> {t('modal.popular')}</em>}
                    </span>
                    <span className="pm-plan-price">{fmt(p.price_usd)}</span>
                  </button>
                );
              })}
              {!plans.length && <p className="pm-empty">{t('modal.notForSale')}</p>}
            </div>

            <div className="pm-total">
              <span>{t('modal.total')}</span>
              <strong>{selected ? fmt(selected.price_usd) : '—'}</strong>
            </div>

            <button className="pm-cta" onClick={buy} disabled={!selected}>
              <Zap size={17} /> {t('modal.buyNow')}
            </button>
            <button className="pm-cta-secondary" onClick={add} disabled={!selected}>
              <ShoppingCart size={16} /> {t('modal.addToCart')}
            </button>

            <ul className="pm-perks">
              <li><Zap size={14} /> {t('modal.perk1')}</li>
              <li><ShieldCheck size={14} /> {t('modal.perk2')}</li>
              <li><Headphones size={14} /> {t('modal.perk3')}</li>
            </ul>
          </aside>

          {/* -------- Sol alt: açıklama -------- */}
            {(product.description || product.details) && (
              <div className="pm-info">
                {localized(product, 'description', lang) && <p className="pm-desc">{localized(product, 'description', lang)}</p>}
                {product.details && (
                  <>
                    <h3>{t('modal.features')}</h3>
                    <div className="pm-details">{localized(product, 'details', lang)}</div>
                  </>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
