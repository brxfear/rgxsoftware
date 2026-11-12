import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { Shield, ShieldCheck, Zap, ArrowRight, CreditCard, CheckCircle2, Landmark, Bitcoin } from 'lucide-react';

import Navbar from './components/Navbar/Navbar';
import TabSwitcher from './components/TabSwitcher/TabSwitcher';
import ProductCard from './components/ProductCard/ProductCard';
import AdminGate from './components/Admin/AdminGate';
import Cart from './components/Cart/Cart';
import CheckoutModal from './components/Checkout/CheckoutModal';
import ProductModal from './components/ProductCard/ProductModal';
import AuthModal from './components/Auth/AuthModal';
import AccountModal from './components/Account/AccountModal';
import FAQSection from './components/FAQ/FAQSection';
import ReviewsSection from './components/Reviews/ReviewsSection';
import HowItWorksSection from './components/HowItWorks/HowItWorksSection';
import DiscordBanner from './components/Discord/DiscordBanner';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { fetchCategories, fetchProducts, createManualOrder, getStartPrice } from './lib/db';
import { useCartStore } from './store/useCartStore';
import { triggerConfetti } from './utils/celebration';
import { translations } from './utils/translations';
import './App.css';
import './brand.css';

const DISCORD_URL = 'https://discord.gg/dQ5u8TRAxr';

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

function Store() {
  const [language] = useState(() => localStorage.getItem('brx_lang') || 'tr');
  const [activeSection, setActiveSection] = useState('home');
  const [activeTab, setActiveTab] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & User states
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [accountTab, setAccountTab] = useState(null);
  const [, setProfileVersion] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const { cart, addItem, fetchCart } = useCartStore();

  const t = (path) => {
    const keys = path.split('.');
    let result = translations[language];
    for (const key of keys) {
      if (result && result[key]) result = result[key];
      else return path;
    }
    return result;
  };


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
        toast.error('Ürünler yüklenemedi, sayfayı yenile.');
      } finally {
        setLoading(false);
      }
    })();

    // PayTR dönüşü: /?odeme=basarili | /?odeme=basarisiz
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('odeme');
    if (payment) {
      if (payment === 'basarili') {
        triggerConfetti();
        useCartStore.getState().clearCart();
        toast.success('Ödemen alındı! Key ve kurulum detayları e-postana gönderilecek.', { duration: 6000 });
      } else {
        toast.error('Ödeme tamamlanamadı. Tekrar deneyebilir veya destekle iletişime geçebilirsin.', { duration: 6000 });
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
              <span>Anında otomatik teslimat</span>
            </div>

            <h1 className="hero-heading">
              <span className="hero-title">RGX Software</span> <br />
              <span className="hero-accent">Private Yazılımlar</span>
            </h1>

            {/* Showcase panel */}
            <div className="hero-showcase">
              <div className="showcase-topbar">
                <span className="showcase-chip showcase-chip-live">UNDETECTED</span>
                <span className="showcase-chip">7/24 Destek</span>
                <span className="showcase-chip">{categories.length || '—'} Oyun</span>
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
              Valorant, CS2, Rust ve daha pek çok popüler oyun için kernel seviyesinde
              private çözümler. Kart, havale veya kripto ile öde, anahtarın saniyeler içinde gelsin.
            </p>

            <div className="hero-cta-group">
              <button className="btn-primary btn-lg" onClick={() => scrollToId('products-section')}>
                <span>Mağazaya göz at</span>
                <ArrowRight size={17} />
              </button>
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-lg">
                <span>Discord Topluluğu</span>
              </a>
            </div>

            <div className="hero-stats-bar">
              <div className="stat-item">
                <span className="stat-num">{products.length || '—'}</span>
                <span className="stat-label">Aktif ürün</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">{categories.length || '—'}</span>
                <span className="stat-label">Desteklenen oyun</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">Anında</span>
                <span className="stat-label">Otomatik key teslimi</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">7/24</span>
                <span className="stat-label">Türkçe destek</span>
              </div>
            </div>
          </div>
        </section>

        {/* ================= ÖNE ÇIKANLAR ================= */}
        {featuredProducts.length > 0 && (
          <section className="container section-block">
            <div className="section-header-flex">
              <div>
                <h2 className="section-title">Öne çıkanlar</h2>
                <p className="section-desc">Ekibimizin önerdiği ürünler; her birinin durumu canlı olarak görünür.</p>
              </div>
              <button className="link-arrow" onClick={() => scrollToId('products-section')}>
                Tümünü gör <ArrowRight size={15} />
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
                <h2 className="section-title">Oyunlar</h2>
                <p className="section-desc">{categories.length} oyun için yazılımlar. Oyununu seç, tüm ürünleri yan yana karşılaştır.</p>
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
                        <span>{catProducts.length} ürün</span>
                        {minPrice !== null && (
                          <span>Başlangıç <strong>₺{minPrice.toLocaleString('tr-TR')}</strong></span>
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
          <h2 className="section-title">Kart, havale ve <span className="hero-accent">kripto</span></h2>
          <p className="section-desc">Her yöntemde anahtarın otomatik olarak teslim edilir.</p>
          <div className="payment-grid">
            {[
              { icon: <CreditCard size={22} />, label: 'Visa / Mastercard', sub: '3D Secure' },
              { icon: <Landmark size={22} />, label: 'Havale / EFT', sub: 'Tüm bankalar' },
              { icon: <Bitcoin size={22} />, label: 'Kripto', sub: 'USDT · BTC · ETH' },
              { icon: <Zap size={22} />, label: 'Anında teslimat', sub: 'Otomatik key' },
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
              <h2 className="section-title">Tüm ürünler</h2>
              <p className="section-desc">Oyununu seç, süre ve planları karşılaştır.</p>
            </div>
          </div>

          <TabSwitcher games={categories} activeTab={activeTab} onTabChange={setActiveTab} />

          {loading ? (
            <div className="empty-state">Yazılımlar ve güncel durumlar yükleniyor...</div>
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
                  Bu kategoride henüz aktif ürün bulunmuyor.
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
              <span className="section-tag">Hakkımızda</span>
              <h2 className="section-title">Her üründe elde ettikleriniz</h2>
              <p className="section-desc">Tüm RGX ürünlerinde güvenli teslimat, düzenli güncellemeler, gerçek destek ve anında erişim.</p>
            </div>
            <div className="about-features">
              {[
                { icon: <ShieldCheck size={18} />, title: 'Güvenli ve undetected', desc: 'Sistemlerimiz maksimum güvenlik ve düşük tespit riski için kurgulanır.' },
                { icon: <CheckCircle2 size={18} />, title: 'Sahada test edilmiş', desc: 'Her sürüm, yayın öncesi gerçek oturumlarda denenir.' },
                { icon: <Shield size={18} />, title: 'Güvenli ödeme', desc: 'Tüm işlemler güvenilir ödeme altyapıları üzerinden korunur.' },
                { icon: <Zap size={18} />, title: 'Anında teslimat', desc: 'Başarılı ödeme sonrası erişim anında iletilir.' },
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
        t={t}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        total={cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)}
        t={t}
        onComplete={async (data) => {
          const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

          const detailedItems = cart.map(item => ({
            product_id: item.product_id,
            name: item.name,
            price: item.price,
            duration: item.duration || 1,
            durationLabel: item.durationLabel || '1 GÜN',
            quantity: item.quantity,
            subtotal: item.price * item.quantity
          }));

          if (data.payment_method === 'paytr') {
            const idToken = user ? await user.getIdToken() : null;
            let paytrData = null;
            try {
              const res = await fetch('/api/paytr-session', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                },
                body: JSON.stringify({
                  items: detailedItems.map(({ product_id, duration, quantity }) => ({ product_id, duration, quantity })),
                  customer_name: data.name,
                  customer_email: user?.email || data.email || '',
                  customer_phone: data.contact,
                }),
              });
              paytrData = await res.json().catch(() => null);
              if (!res.ok || !paytrData?.token) throw new Error(paytrData?.error || 'Token alınamadı');
            } catch (err) {
              toast.error('Ödeme başlatılamadı: ' + err.message);
              throw err;
            }
            return paytrData.token;
          }

          try {
            await createManualOrder({
              user_id: user?.uid || null,
              total_amount: totalAmount,
              items: detailedItems,
              subscription_duration: cart[0]?.duration || 1,
              payment_method: data.payment_method || 'manual',
              customer_name: data.name,
              customer_phone: data.contact,
              customer_email: user?.email || 'Misafir',
            });
          } catch (err) {
            toast.error('Sipariş oluşturulamadı: ' + err.message);
            throw err;
          }
          setIsCheckoutOpen(false);
          triggerConfetti();
          await useCartStore.getState().clearCart();
          toast.success('Siparişiniz alındı! Ödemeniz onaylanınca key ve kurulum detayları iletilecek.', { duration: 5000 });
          return 'success';
        }}
      />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <AccountModal
        isOpen={!!accountTab && !!user}
        initialTab={accountTab || 'profile'}
        user={user}
        onClose={() => setAccountTab(null)}
        onProfileUpdated={() => setProfileVersion((v) => v + 1)}
      />

      <ProductModal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onAddToCart={(p) => addItem(p)}
      />

      {/* Footer */}
      <footer className="main-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <img src="/logo.webp" alt="RGX Software" width="56" height="56" />
            <div>
              <strong>RGX SOFTWARE</strong>
              <p>Private yazılımlar, anında teslimat ve 7/24 Türkçe destek.</p>
            </div>
          </div>
          <nav className="footer-links">
            <a href="#products-section">Ürünler</a>
            <a href="#how-it-works">Nasıl çalışır</a>
            <a href="#reviews">Yorumlar</a>
            <a href="#faq">SSS</a>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a>
          </nav>
        </div>
        <div className="container footer-bottom">
          <p>&copy; {new Date().getFullYear()} RGX SOFTWARE. Tüm hakları saklıdır.</p>
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
