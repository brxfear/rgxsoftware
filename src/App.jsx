import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';

import Navbar from './components/Navbar/Navbar';
import Cart from './components/Cart/Cart';
import CheckoutModal from './components/Checkout/CheckoutModal';
import AuthModal from './components/Auth/AuthModal';
import OrderLookup from './components/Account/OrderLookup';
import PendingPaymentWatcher from './components/Checkout/PendingPaymentWatcher';
import SmokeTrail from './components/Effects/SmokeTrail';
import CursorDot from './components/Effects/CursorDot';

import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import CategoryPage from './pages/CategoryPage';
import ProductPage from './pages/ProductPage';
import ReviewsPage from './pages/ReviewsPage';

import { auth } from './lib/firebase';
import { roundUsd } from './lib/currency';
import { completeCheckout } from './lib/checkout';
import { readPendingPayment } from './lib/shopierWindow';
import { useCartStore } from './store/useCartStore';
import { useShopStore, useDiscordUrl } from './store/useShopStore';
import { triggerConfetti } from './utils/celebration';
import { useT, translate } from './i18n';
import './App.css';
import './brand.css';
import './pages/pages.css';

const AccountPage = lazy(() => import('./pages/AccountPage'));
const AdminGate = lazy(() => import('./components/Admin/AdminGate'));

const Footer = () => {
  const { t } = useT();
  const discordUrl = useDiscordUrl();
  return (
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
          <Link to="/products">{t('footer.products')}</Link>
          <Link to="/#how-it-works">{t('footer.how')}</Link>
          <Link to="/reviews">{t('footer.reviews')}</Link>
          <Link to="/#faq">{t('footer.faq')}</Link>
          <a href={discordUrl} target="_blank" rel="noopener noreferrer">Discord</a>
        </nav>
      </div>
      <div className="container footer-bottom">
        <p>&copy; {new Date().getFullYear()} RGX SOFTWARE. {t('footer.rights')}</p>
      </div>
    </footer>
  );
};

/** Sayfa değişince en üste kaydır; /#faq gibi adreslerde o bölüme in. */
const ScrollManager = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      let tries = 0;
      const go = () => {
        const el = document.getElementById(hash.slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else if (tries++ < 20) setTimeout(go, 100);
      };
      go();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
};

function Shell() {
  const { lang } = useT();
  const user = useShopStore((s) => s.user);
  const authOpen = useShopStore((s) => s.authOpen);
  const cartOpen = useShopStore((s) => s.cartOpen);
  const checkoutOpen = useShopStore((s) => s.checkoutOpen);
  const buyNowItem = useShopStore((s) => s.buyNowItem);
  const { closeAuth, closeCart, openCheckout, closeCheckout } = useShopStore.getState();
  const cart = useCartStore((s) => s.cart);
  const checkoutItems = buyNowItem ? [buyNowItem] : cart;
  const [lookup, setLookup] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get('siparis') && q.get('k') ? { id: q.get('siparis'), key: q.get('k') } : null;
  });

  useEffect(() => {
    const store = useShopStore.getState();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      store.setUser(u);
      if (u) useCartStore.getState().fetchCart();
      else useCartStore.setState({ cart: [] });
    });
    store.loadCatalog().then(() => {
      if (useShopStore.getState().loadError) toast.error(translate('products.loadError'));
    });
    store.loadSettings();

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
  }, []);

  return (
    <div className="main-wrapper">
      <SmokeTrail />
      <CursorDot />
      <ScrollManager />
      <Navbar />

      <main>
        <Suspense fallback={<div className="page-loading" />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />

      <Cart isOpen={cartOpen} onClose={closeCart} onCheckout={() => openCheckout(null)} />

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={closeCheckout}
        items={checkoutItems}
        fromCart={!buyNowItem}
        user={user}
        totalUsd={roundUsd(checkoutItems.reduce((sum, i) => sum + i.price * i.quantity, 0))}
        onComplete={(data) => completeCheckout({ data, items: checkoutItems, user, lang, fromCart: !buyNowItem })}
      />

      <AuthModal isOpen={authOpen} onClose={closeAuth} />

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
    </div>
  );
}

function App() {
  return (
    <Router>
      <Toaster position="bottom-right" />
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<ShopPage />} />
          <Route path="products/:cat" element={<CategoryPage />} />
          <Route path="products/:cat/:product" element={<ProductPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="account/:tab" element={<AccountPage />} />
        </Route>
        <Route
          path="/admin"
          element={
            <Suspense fallback={<div className="page-loading" />}>
              <AdminGate />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
