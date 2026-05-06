import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from './components/Navbar/Navbar';
import TabSwitcher from './components/TabSwitcher/TabSwitcher';
import ProductCard from './components/ProductCard/ProductCard';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminLogin from './components/Admin/AdminLogin';
import Cart from './components/Cart/Cart';
import CheckoutModal from './components/Checkout/CheckoutModal';
import ProductModal from './components/ProductCard/ProductModal';
import AuthModal from './components/Auth/AuthModal';
import { supabase } from './lib/supabaseClient';
import { useCartStore } from './store/useCartStore';
import { triggerConfetti } from './utils/celebration';
import { translations } from './utils/translations';
import './App.css';

// Protected Route Shield
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

const DigitalSnow = () => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const chars = "01/*-+$#%&@<>[]{}";
    const particleCount = 80;
    const initialParticles = Array.from({ length: particleCount }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 5 + Math.random() * 10,
      char: chars[Math.floor(Math.random() * chars.length)],
      size: 8 + Math.random() * 12
    }));
    setParticles(initialParticles);
  }, []);

  return (
    <div className="digital-snow">
      {particles.map(p => (
        <span
          key={p.id}
          className="snow-particle"
          style={{
            left: `${p.x}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            fontSize: `${p.size}px`
          }}
        >
          {p.char}
        </span>
      ))}
    </div>
  );
};

const CyberCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="custom-cursor-container">
      <div 
        className="cursor-core" 
        style={{ left: `${position.x}px`, top: `${position.y}px` }} 
      />
    </div>
  );
};

function Store() {
  const [language, setLanguage] = useState(localStorage.getItem('brx_lang') || 'tr');
  const [activeSection, setActiveSection] = useState('home');
  const [activeTab, setActiveTab] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Translation helper
  const t = (path) => {
    const keys = path.split('.');
    let result = translations[language];
    for (const key of keys) {
      if (result[key]) result = result[key];
      else return path;
    }
    return result;
  };

  const toggleLanguage = () => {
    const newLang = language === 'tr' ? 'en' : 'tr';
    setLanguage(newLang);
    localStorage.setItem('brx_lang', newLang);
  };

  // UI States
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const { cart, addItem, fetchCart } = useCartStore();

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

    const categorySubscription = supabase
      .channel('public:categories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchCategories())
      .subscribe();

    const productSubscription = supabase
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(categorySubscription);
      supabase.removeChannel(productSubscription);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchCategories(), fetchProducts()]);
    } catch (error) {
      console.error("Sync Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) {
      setCategories(data);
      if (data.length > 0) {
        setActiveTab(prev => {
          if (!prev || !data.find(c => c.id === prev)) return data[0].id;
          return prev;
        });
      }
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) setProducts(data);
  };

  const filteredProducts = products.filter(p => p.category_id === activeTab);

  return (
    <div className="app">
      <DigitalSnow />
      <CyberCursor />
      <Navbar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        user={user}
        onAuthClick={() => setIsAuthOpen(true)}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onCartClick={() => setIsCartOpen(true)}
        language={language}
        onLanguageToggle={toggleLanguage}
        t={t}
      />

      <main className="container main-layout">
        {activeSection === 'home' && (
          <section className="home-view fade-in">
            <header className="hero-section">
              <h1 className="hero-title neon-text cyber-font">{t('hero.title')}</h1>
              <div className="hero-content-wrapper">
                <section className="hero-block">
                  <h2 className="neon-text cyber-font">{t('hero.brand_title')}</h2>
                  <p>{t('hero.brand_desc')}</p>
                </section>

                <section className="hero-block">
                  <h3 className="cyber-font">{t('hero.who_we_are_title')}</h3>
                  <p>{t('hero.who_we_are_desc')}</p>
                </section>

                <section className="hero-block grid-details">
                  <div className="detail-item">
                    <h4 className="neon-text cyber-font">{t('hero.why_us_title')}</h4>
                    <p><strong>{t('hero.why_us_security')}:</strong> {t('hero.why_us_security_desc')}</p>
                  </div>
                  <div className="detail-item">
                    <p><strong>{t('hero.why_us_delivery')}:</strong> {t('hero.why_us_delivery_desc')}</p>
                  </div>
                  <div className="detail-item">
                    <p><strong>{t('hero.why_us_updates')}:</strong> {t('hero.why_us_updates_desc')}</p>
                  </div>
                  <div className="detail-item">
                    <p><strong>{t('hero.why_us_support')}:</strong> {t('hero.why_us_support_desc')}</p>
                  </div>
                </section>

                <section className="hero-block">
                  <h3 className="cyber-font">{t('hero.vision_title')}</h3>
                  <p>{t('hero.vision_desc')}</p>
                </section>
              </div>
              <button className="neon-button hero-cta" onClick={() => setActiveSection('products')}>
                {t('hero.cta')}
              </button>
            </header>
          </section>
        )}

        {activeSection === 'products' && (
          <section className="products-view fade-in">
            <div className="container">
              <TabSwitcher
                games={categories}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {loading ? (
                <div className="loading-state cyber-font">{t('products.syncing')}</div>
              ) : (
                <div className="product-grid">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(product => (
                      <ProductCard
                        key={product.id}
                        product={{ ...product, image: product.image_url }}
                        onAddToCart={() => addItem(product)}
                        onClick={(p) => setSelectedProduct(p)}
                      />
                    ))
                  ) : (
                    <div className="no-products glass-panel cyber-font">
                      {t('products.nothing_found')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

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

          const { error } = await supabase.from('orders').insert([{
            user_id: user?.id || null,
            total_amount: totalAmount,
            items: cart,
            status: 'Waiting for Confirmation',
            customer_name: data.name,
            customer_phone: data.contact,
            customer_email: user?.email || 'Guest'
          }]);

          if (error) {
            toast.error(t('common.error_order') + error.message);
          } else {
            setIsCheckoutOpen(false);
            triggerConfetti();
            await useCartStore.getState().clearCart();
            toast.success(t('common.success_order'), { duration: 5000 });
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

      <footer className="main-footer">
        <p>&copy; 2026 BRX STORE - DESIGNED FOR BRXFEAR</p>
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
