import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { Shield, ShieldCheck, Zap, ArrowRight, CreditCard, CheckCircle2, Landmark } from 'lucide-react';

import Navbar from './components/Navbar/Navbar';
import TabSwitcher from './components/TabSwitcher/TabSwitcher';
import ProductCard from './components/ProductCard/ProductCard';
import AdminGate from './components/Admin/AdminGate';
import Cart from './components/Cart/Cart';
import CheckoutModal from './components/Checkout/CheckoutModal';
import ProductModal from './components/ProductCard/ProductModal';
import AuthModal from './components/Auth/AuthModal';
import AccountModal from './components/Account/AccountModal';
import OrderLookup from './components/Account/OrderLookup';
import PendingPaymentWatcher from './components/Checkout/PendingPaymentWatcher';
import FAQSection from './components/FAQ/FAQSection';
import ReviewsSection from './components/Reviews/ReviewsSection';
import HowItWorksSection from './components/HowItWorks/HowItWorksSection';
import DiscordBanner from './components/Discord/DiscordBanner';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { fetchCategories, fetchProducts, createManualOrder, getStartPrice } from './lib/db';
import { roundUsd, loadUsdTry, usdToTry, currencyForLang } from './lib/currency';
import Price from './components/Price';
import { readPendingPayment } from './lib/shopierWindow';
import SmokeTrail from './components/Effects/SmokeTrail';
import CursorDot from './components/Effects/CursorDot';
import { useCartStore } from './store/useCartStore';
import { triggerConfetti } from './utils/celebration';
import { useT, translate } from './i18n';
import './App.css';
import './brand.css';

const DISCORD_URL = 'https://discord.gg/rgxsoftware1';

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

function Store() {
  const { t, lang } = useT();
  const [activeSection, setActiveSection] = useState('home');
  const [activeTab, setActiveTab] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & User states
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [accountTab, setAccountTab] = useState(null);
  const [lookup, setLookup] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get('siparis') && q.get('k') ? { id: q.get('siparis'), key: q.get('k') } : null;
  });
  const [, setProfileVersion] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  // "Hemen satın al": sepete eklemeden sadece bu ürünle ödeme
  const [buyNowItem, setBuyNowItem] = useState(null);

  const { cart, addItem, fetchCart } = useCartStore();
  const checkoutItems = buyNowItem ? [buyNowItem] : cart;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        fetchCart();
      } else {
        useCartStore.setState({ cart: [] });
      }
    });

    (async () => {
      setLoading(true);
      try {
        const [cats, prods] = await Promise.all([fetchCategories(), fetchProducts()]);
        setCategories(cats);
        setProducts(prods.filter(p => p.is_available !== false));
      } catch (err) {
        console.error('Veriler yüklenemedi:', err);
        toast.error(translate('products.loadError'));
      } finally {
        setLoading(false);
      }
    })();

    // Shopier dönüşü: /?odeme=basarili | /?odeme=basarisiz
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('odeme');
    if (payment) {
      if (payment === 'basarili') {
        triggerConfetti();
        if (readPendingPayment()?.fromCart !== false) useCartStore.getState().clearCart();
        toast.success(translate('checkout.paidToast'), { duration: 6000 });
      } else {
        toast.error(translate('checkout.failToast'), { duration: 6000 });
      }
      window.history.replaceState({}, '', window.location.pathname);
    }

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = activeTab
    ? products.filter(p => p.category_id === activeTab)
    : products;

  const featuredProducts = products.slice(0, 4);
  const categoryName = (id) => categories.find(c => c.id === id)?.name;

  return (
    <div className="main-wrapper">
      <SmokeTrail />
      <CursorDot />
      {/* Mitamers Style Glass Header */}
      <Navbar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        user={user}
        onAuthClick={() => setIsAuthOpen(true)}
        onAccountClick={(tab) => setAccountTab(tab)}
        cartCount={cart.reduce((total, item) => total + item.quantity, 0)}
        onCartClick={() => setIsCartOpen(true)}
      />

      <main>
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

            {/* Showcase panel */}
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

            <p className="hero-subtext">
              {t('hero.sub')}
            </p>

            <div className="hero-cta-group">
              <button className="btn-primary btn-lg" onClick={() => scrollToId('products-section')}>
                <span>{t('hero.shop')}</span>
                <ArrowRight size={17} />
              </button>
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-lg">
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
        {featuredProducts.length > 0 && (
          <section className="container section-block">
            <div className="section-header-flex">
              <div>
                <h2 className="section-title">{t('featured.title')}</h2>
                <p className="section-desc">{t('featured.desc')}</p>
              </div>
              <button className="link-arrow" onClick={() => scrollToId('products-section')}>
                {t('featured.all')} <ArrowRight size={15} />
              </button>
            </div>
            <div className="product-grid product-grid-4">
              {featuredProducts.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={{ ...product, image: product.image_url, category_name: categoryName(product.category_id) }}
                  onClick={(p) => setSelectedProduct(p)}
                  highlight={i === 0}
                />
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
            </div>
            <div className="games-grid">
              {categories.map((cat) => {
                const catProducts = products.filter(p => p.category_id === cat.id);
                const minPrice = catProducts.length ? Math.min(...catProducts.map(getStartPrice)) : null;
                return (
                  <button
                    key={cat.id}
                    className="game-card"
                    onClick={() => {
                      setActiveTab(cat.id);
                      scrollToId('products-section');
                    }}
                  >
                    <div className="game-card-media">
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} loading="lazy" />
                      ) : (
                        <div className="game-card-fallback">
                          <img src="/logo.webp" alt="" />
                        </div>
                      )}
                    </div>
                    <div className="game-card-body">
                      <span className="game-card-name">{cat.name}</span>
                      <div className="game-card-meta">
                        <span>{t('games.count', { n: catProducts.length })}</span>
                        {minPrice !== null && (
                          <span>{t('games.from')} <Price usd={minPrice} className="game-card-price" /></span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
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

        {/* ================= TÜM ÜRÜNLER ================= */}
        <section id="products-section" className="container section-block">
          <div className="section-header-flex">
            <div>
              <h2 className="section-title">{t('products.title')}</h2>
              <p className="section-desc">{t('products.desc')}</p>
            </div>
          </div>

          <TabSwitcher games={categories} activeTab={activeTab} onTabChange={setActiveTab} />

          {loading ? (
            <div className="empty-state">{t('products.loading')}</div>
          ) : (
            <div className="product-grid">
              {filteredProducts.length > 0 ? (
                filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={{ ...product, image: product.image_url, category_name: categoryName(product.category_id) }}
                    onClick={(p) => setSelectedProduct(p)}
                  />
                ))
              ) : (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  {t('products.empty')}
                </div>
              )}
            </div>
          )}
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
      </main>

      {/* ================= MODALS ================= */}
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => {
          setIsCartOpen(false);
          setBuyNowItem(null);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setBuyNowItem(null);
        }}
        items={checkoutItems}
        fromCart={!buyNowItem}
        user={user}
        totalUsd={roundUsd(checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0))}
        onComplete={async (data) => {
          const currency = currencyForLang(lang);
          const items = checkoutItems.map(item => ({
            product_id: item.product_id,
            plan_id: String(item.duration),
            quantity: item.quantity,
          }));

          // ---- Kart: Shopier (sunucu fiyatı hesaplar, sipariş için geçici Shopier ödeme sayfası açar)
          if (data.payment_method === 'shopier') {
            try {
              const idToken = user ? await user.getIdToken() : null;
              const res = await fetch('/api/shopier-session', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                },
                body: JSON.stringify({ items, currency, lang, buyer: { name: data.name, email: data.email, phone: data.phone } }),
              });
              const out = await res.json().catch(() => null);
              if (!res.ok || !out?.url) throw new Error(out?.error || t('checkout.unreachable'));
              return { type: 'shopier', url: out.url, orderId: out.order_id, key: out.key };
            } catch (err) {
              toast.error(t('checkout.payFailed') + ': ' + err.message);
              throw err;
            }
          }

          // ---- IBAN: elle onaylanan sipariş (TR'de ₺, EN'de $)
          let rate = null;
          if (currency === 'TRY') {
            rate = await loadUsdTry();
            if (!rate) {
              toast.error(t('checkout.fxFailed'));
              throw new Error('fx');
            }
          }
          const toCur = (usd) => (rate ? usdToTry(usd, rate) : roundUsd(usd));
          const detailedItems = checkoutItems.map(item => ({
            product_id: item.product_id,
            name: item.name,
            plan_id: String(item.duration),
            durationLabel: item.durationLabel || '',
            quantity: item.quantity,
            price_usd: item.price,
            price: toCur(item.price),
            subtotal: toCur(item.price) * item.quantity,
          }));
          try {
            const ref = await createManualOrder({
              user_id: user?.uid || null,
              total_amount: roundUsd(detailedItems.reduce((s, i) => s + i.subtotal, 0)),
              total_usd: roundUsd(checkoutItems.reduce((s, i) => s + i.price * i.quantity, 0)),
              ...(rate ? { fx_rate: rate } : {}),
              currency,
              items: detailedItems,
              payment_method: 'iban',
              customer_name: data.name,
              customer_phone: data.phone,
              customer_email: data.email || user?.email || '',
            });
            if (!buyNowItem) await useCartStore.getState().clearCart();
            return { type: 'iban', orderId: ref.id };
          } catch (err) {
            toast.error(t('checkout.orderFailed') + ': ' + err.message);
            throw err;
          }
        }}
      />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {!lookup && <PendingPaymentWatcher />}

      {lookup && (
        <OrderLookup
          orderId={lookup.id}
          viewKey={lookup.key}
          onClose={() => {
            setLookup(null);
            window.history.replaceState({}, '', window.location.pathname);
          }}
        />
      )}

      <AccountModal
        isOpen={!!accountTab && !!user}
        initialTab={accountTab || 'profile'}
        user={user}
        onClose={() => setAccountTab(null)}
        onProfileUpdated={() => setProfileVersion((v) => v + 1)}
      />

      <ProductModal
        key={selectedProduct?.id || 'none'}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onAddToCart={(p) => addItem(p)}
        onBuyNow={(p) => {
          const duration = p.selectedDuration || 1;
          setBuyNowItem({
            id: `buy-${p.id}-${duration}`,
            product_id: p.id,
            name: p.name,
            price: p.selectedPrice || p.price,
            duration,
            durationLabel: p.selectedLabel || '',
            image: p.image_url || p.image || '',
            quantity: 1,
          });
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
        categoryName={categoryName(selectedProduct?.category_id)}
      />

      {/* Footer */}
      <footer className="main-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <img src="/logo.webp" alt="RGX Software" width="56" height="56" />
            <div>
              <strong>RGX SOFTWARE</strong>
              <p>{t('footer.tagline')}</p>
            </div>
          </div>
          <nav className="footer-links">
            <a href="#products-section">{t('footer.products')}</a>
            <a href="#how-it-works">{t('footer.how')}</a>
            <a href="#reviews">{t('footer.reviews')}</a>
            <a href="#faq">{t('footer.faq')}</a>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a>
          </nav>
        </div>
        <div className="container footer-bottom">
          <p>&copy; {new Date().getFullYear()} RGX SOFTWARE. {t('footer.rights')}</p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Toaster position="bottom-right" />
      <Routes>
        <Route path="/" element={<Store />} />
        <Route path="/admin" element={<AdminGate />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
