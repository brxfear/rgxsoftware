import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ShieldCheck, Zap, ArrowRight, CreditCard, CheckCircle2, Landmark } from 'lucide-react';
import ProductCard from '../components/ProductCard/ProductCard';
import GamesGrid from '../components/GamesGrid';
import FAQSection from '../components/FAQ/FAQSection';
import ReviewsSection from '../components/Reviews/ReviewsSection';
import HowItWorksSection from '../components/HowItWorks/HowItWorksSection';
import DiscordBanner from '../components/Discord/DiscordBanner';
import { useShopStore, useDiscordUrl } from '../store/useShopStore';
import { productPath } from '../lib/slug';
import { usePageTitle } from '../lib/usePageTitle';
import { useT } from '../i18n';

const HomePage = () => {
  const { t } = useT();
  usePageTitle(null);
  const categories = useShopStore((s) => s.categories);
  const products = useShopStore((s) => s.products);
  const discordUrl = useDiscordUrl();
  const featured = products.slice(0, 4);
  const catName = (id) => categories.find((c) => c.id === id)?.name;

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="hero-stage">
        <div className="hero-texture" aria-hidden="true"></div>
        <div className="hero-beam" aria-hidden="true"></div>
        <div className="hero-halo" aria-hidden="true"></div>

        <div className="container hero-inner">
          <div className="hero-pill-badge">
            <span className="status-dot-green"></span>
            <span>{t('hero.pill')}</span>
          </div>

          <h1 className="hero-heading">
            <span className="hero-title">RGX Software</span> <br />
            <span className="hero-accent">{t('hero.title2')}</span>
          </h1>

          <div className="hero-showcase">
            <div className="showcase-topbar">
              <span className="showcase-chip showcase-chip-live">UNDETECTED</span>
              <span className="showcase-chip">{t('hero.support')}</span>
              <span className="showcase-chip">{t('hero.games', { n: categories.length || '—' })}</span>
              <span className="showcase-rec">
                <span className="rec-dot"></span> RGX
              </span>
            </div>
            <video
              className="showcase-video"
              src="/media/hero-loop.mp4"
              poster="/media/hero-loop-poster.webp"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
            <div className="showcase-vignette" aria-hidden="true"></div>
          </div>

          <p className="hero-subtext">{t('hero.sub')}</p>

          <div className="hero-cta-group">
            <Link className="btn-primary btn-lg" to="/products">
              <span>{t('hero.shop')}</span>
              <ArrowRight size={17} />
            </Link>
            <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-lg">
              <span>{t('hero.discord')}</span>
            </a>
          </div>

          <div className="hero-stats-bar">
            <div className="stat-item">
              <span className="stat-num">{products.length || '—'}</span>
              <span className="stat-label">{t('hero.statProducts')}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-num">{categories.length || '—'}</span>
              <span className="stat-label">{t('hero.statGames')}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-num">{t('hero.statInstant')}</span>
              <span className="stat-label">{t('hero.statDelivery')}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-num">7/24</span>
              <span className="stat-label">{t('hero.statSupport')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= ÖNE ÇIKANLAR ================= */}
      {featured.length > 0 && (
        <section className="container section-block">
          <div className="section-header-flex">
            <div>
              <h2 className="section-title">{t('featured.title')}</h2>
              <p className="section-desc">{t('featured.desc')}</p>
            </div>
            <Link className="link-arrow" to="/products">
              {t('featured.all')} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="product-grid product-grid-4">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} to={productPath(p, categories)} categoryName={catName(p.category_id)} highlight={i === 0} />
            ))}
          </div>
        </section>
      )}

      {/* ================= OYUNLAR ================= */}
      {categories.length > 0 && (
        <section className="container section-block">
          <div className="section-header-flex">
            <div>
              <h2 className="section-title">{t('games.title')}</h2>
              <p className="section-desc">{t('games.desc', { n: categories.length })}</p>
            </div>
            <Link className="link-arrow" to="/products">
              {t('shop.title')} <ArrowRight size={15} />
            </Link>
          </div>
          <GamesGrid categories={categories} products={products} />
        </section>
      )}

      {/* ================= ÖDEME YÖNTEMLERİ ================= */}
      <section className="container section-block">
        <h2 className="section-title">{t('pay.title1')} <span className="hero-accent">{t('pay.title2')}</span> {t('pay.title3')}</h2>
        <p className="section-desc">{t('pay.desc')}</p>
        <div className="payment-grid">
          {[
            { icon: <CreditCard size={22} />, label: t('pay.card'), sub: t('pay.cardSub') },
            { icon: <ShieldCheck size={22} />, label: t('pay.safe'), sub: t('pay.safeSub') },
            { icon: <Landmark size={22} />, label: t('pay.bank'), sub: t('pay.bankSub') },
            { icon: <Zap size={22} />, label: t('pay.instant'), sub: t('pay.instantSub') },
          ].map(({ icon, label, sub }) => (
            <div key={label} className="payment-tile">
              {icon}
              <span className="payment-tile-label">{label}</span>
              <span className="payment-tile-sub">{sub}</span>
            </div>
          ))}
        </div>
      </section>

      <HowItWorksSection />
      <ReviewsSection />

      {/* ================= HAKKIMIZDA ================= */}
      <section className="container section-block">
        <div className="about-panel">
          <div className="about-bg" aria-hidden="true"></div>
          <div className="about-content">
            <span className="section-tag">{t('about.tag')}</span>
            <h2 className="section-title">{t('about.title')}</h2>
            <p className="section-desc">{t('about.desc')}</p>
          </div>
          <div className="about-features">
            {[
              { icon: <ShieldCheck size={18} />, title: t('about.f1t'), desc: t('about.f1d') },
              { icon: <CheckCircle2 size={18} />, title: t('about.f2t'), desc: t('about.f2d') },
              { icon: <Shield size={18} />, title: t('about.f3t'), desc: t('about.f3d') },
              { icon: <Zap size={18} />, title: t('about.f4t'), desc: t('about.f4d') },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="about-feature">
                <div className="about-feature-icon">{icon}</div>
                <div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FAQSection />
      <DiscordBanner />
    </>
  );
};

export default HomePage;
