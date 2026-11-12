import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { Sparkles, Shield, Zap, ArrowRight, CreditCard, ChevronRight, CheckCircle2 } from 'lucide-react';

import Navbar from './components/Navbar/Navbar';
import TabSwitcher from './components/TabSwitcher/TabSwitcher';
import ProductCard from './components/ProductCard/ProductCard';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminLogin from './components/Admin/AdminLogin';
import Cart from './components/Cart/Cart';
import CheckoutModal from './components/Checkout/CheckoutModal';
import ProductModal from './components/ProductCard/ProductModal';
import AuthModal from './components/Auth/AuthModal';
import FAQSection from './components/FAQ/FAQSection';
import ReviewsSection from './components/Reviews/ReviewsSection';
import HowItWorksSection from './components/HowItWorks/HowItWorksSection';
import DiscordBanner from './components/Discord/DiscordBanner';

import { supabase } from './lib/supabaseClient';
import { useCartStore } from './store/useCartStore';
import { triggerConfetti } from './utils/celebration';
import { translations } from './utils/translations';
import './App.css';

// Admin Shield
const ProtectedAdmin = ({ children }) => {
  const [isAuth, setIsAuth] = useState(sessionStorage.getItem('admin_session') === 'active');

  if (!isAuth) {
    return <AdminLogin onLogin={() => {
      sessionStorage.setItem('admin_session', 'active');
      setIsAuth(true);
      toast.success('DECRYPTION COMPLETE. ACCESS GRANTED.');
    }} />;
  }
  return children;
};

function Store() {
  const [language, setLanguage] = useState(localStorage.getItem('brx_lang') || 'tr');
  const [activeSection, setActiveSection] = useState('home');
  const [activeTab, setActiveTab] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & User states
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
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

  const toggleLanguage = () => {
    const newLang = language === 'tr' ? 'en' : 'tr';
    setLanguage(newLang);
    localStorage.setItem('brx_lang', newLang);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchCart();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCart();
      } else {
        useCartStore.setState({ cart: [] });
      }
    });

    fetchInitialData();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchCategories(), fetchProducts()]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (!error && data) {
      setCategories(data);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setProducts(data);
    }
  };

  const filteredProducts = activeTab
    ? products.filter(p => p.category_id === activeTab)
    : products;

  // Öne çıkan ürünler (ilk 3-4 ürün)
  const featuredProducts = products.slice(0, 4);

  return (
    <div className="main-wrapper">
      {/* Mitamers Style Glass Header */}
      <Navbar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        user={user}
        onAuthClick={() => setIsAuthOpen(true)}
        cartCount={cart.reduce((total, item) => total + item.quantity, 0)}
        onCartClick={() => setIsCartOpen(true)}
        language={language}
        onLanguageToggle={toggleLanguage}
      />

      <main>
        {/* ================= HERO SECTION ================= */}
        <section className="hero-stage">
          <div className="hero-beam" aria-hidden="true"></div>
          <div className="hero-halo" aria-hidden="true"></div>

          <div className="container relative z-10">
            <div className="hero-pill-badge">
              <span className="status-dot-green"></span>
              <span>7/24 OTOMATİK TESLİMAT & GÜNCEL KERNEL DRIVER</span>
            </div>

            <h1 className="hero-heading">
              <span className="hero-title">RGX Software</span> <br />
              <span className="hero-accent">Private Hileler & Çözümler</span>
            </h1>

            <p className="hero-subtext">
              Valorant, CS2, Rust ve daha pek çok popüler oyun için donanım banı riski olmadan, 
              kernel seviyesinde undetected aimbot, ESP ve HWID Spoofer çözümleri.
            </p>

            <div className="hero-cta-group">
              <button 
                className="btn-primary" 
                onClick={() => {
                  const el = document.getElementById('products-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else setActiveSection('products');
                }}
              >
                <span>Ürünleri İncele</span>
                <ArrowRight size={17} />
              </button>

              <a 
                href="https://discord.gg/dQ5u8TRAxr" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-secondary"
              >
                <span>Discord Topluluğu</span>
              </a>
            </div>

            {/* Mitamers Hero Stats Bar */}
            <div className="hero-stats-bar">
              <div className="stat-item">
                <span className="stat-num">%100</span>
                <span className="stat-label">Undetected Sistem</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">Anında</span>
                <span className="stat-label">Otomatik Key Teslimi</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">7/24</span>
                <span className="stat-label">Türkçe Canlı Destek</span>
              </div>
            </div>
          </div>
        </section>

        {/* ================= PAYMENT BADGES ================= */}
        <div className="container">
          <div className="payment-bar">
            <div className="payment-item">
              <CreditCard size={18} className="text-cyan" />
              <span>Kredi & Banka Kartı (3D Secure)</span>
            </div>
            <div className="payment-item">
              <Zap size={18} className="text-cyan" />
              <span>Anında Otomatik Teslimat</span>
            </div>
            <div className="payment-item">
              <Shield size={18} className="text-cyan" />
              <span>Tüm Bankalar & Havale / EFT</span>
            </div>
            <div className="payment-item">
              <Sparkles size={18} className="text-cyan" />
              <span>Kripto Para (USDT / BTC / ETH)</span>
            </div>
          </div>
        </div>

        {/* ================= PRODUCTS & GAMES SECTION ================= */}
        <section id="products-section" className="container" style={{ paddingTop: '70px', paddingBottom: '70px' }}>
          <div className="section-header-flex">
            <div>
              <span className="section-tag">ÖNE ÇIKAN VE TÜM YAZILIMLAR</span>
              <h2 className="section-title">Oyununu Seç, Ürünleri İncele</h2>
              <p className="section-desc">Gelişmiş filtreleme ile ihtiyacın olan oyunu seç, süre ve planları karşılaştır.</p>
            </div>
          </div>

          <TabSwitcher
            games={categories}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#8b95a7' }}>
              Yazılımlar ve güncel durumlar yükleniyor...
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.length > 0 ? (
                filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={{ ...product, image: product.image_url }}
                    onClick={(p) => setSelectedProduct(p)}
                  />
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#8b95a7', gridColumn: '1 / -1' }}>
                  Bu kategoride henüz aktif ürün bulunmuyor.
                </div>
              )}
            </div>
          )}
        </section>

        {/* ================= NASIL ÇALIŞIYORUZ ================= */}
        <HowItWorksSection />

        {/* ================= MÜŞTERİ YORUMLARI ================= */}
        <ReviewsSection />

        {/* ================= SIKÇA SORULAN SORULAR ================= */}
        <FAQSection />

        {/* ================= DISCORD BANNER ================= */}
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
            const { data: paytrData, error } = await supabase.functions.invoke('create-paytr-session', {
              body: {
                items: detailedItems,
                total_amount: totalAmount,
                customer_name: data.name,
                customer_email: user?.email || 'guest@rgxsoftware.com',
                customer_phone: data.contact
              }
            });

            if (error || !paytrData?.token) {
              toast.error('Ödeme başlatılamadı: ' + (error?.message || 'Token Hatası'));
              throw new Error('Payment init failed');
            }
            return paytrData.token;
          } else {
            const { error } = await supabase.from('orders').insert([{
              user_id: user?.id || null,
              total_amount: totalAmount,
              items: detailedItems,
              subscription_duration: cart[0]?.duration || 1,
              status: 'Waiting for Confirmation',
              customer_name: data.name,
              customer_phone: data.contact,
              customer_email: user?.email || 'Guest'
            }]);

            if (error) {
              toast.error('Sipariş oluşturulamadı: ' + error.message);
              throw error;
            } else {
              setIsCheckoutOpen(false);
              triggerConfetti();
              await useCartStore.getState().clearCart();
              toast.success('Siparişiniz başarıyla alındı! Key ve kurulum detayları iletiliyor.', { duration: 5000 });
              return 'success';
            }
          }
        }}
      />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <ProductModal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onAddToCart={(p) => addItem(p)}
      />

      {/* Footer */}
      <footer className="main-footer">
        <div className="container">
          <p>&copy; 2026 RGX SOFTWARE. Tüm Hakları Saklıdır.</p>
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
        <Route path="/admin" element={
          <ProtectedAdmin>
            <AdminDashboard />
          </ProtectedAdmin>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
