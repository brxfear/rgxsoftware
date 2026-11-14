// Sayfalar arası ortak durum: katalog, kullanıcı, site ayarları ve açık pencereler (giriş, sepet, ödeme).
import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchCategories, fetchProducts } from '../lib/db';

export const DEFAULT_DISCORD = 'https://discord.gg/rgxsoftware1';

export const useShopStore = create((set, get) => ({
  categories: [],
  products: [],
  loading: true,
  loadError: false,
  user: null,
  authReady: false,
  discord: { invite_url: DEFAULT_DISCORD },

  authOpen: false,
  cartOpen: false,
  checkoutOpen: false,
  buyNowItem: null, // "Hemen satın al": sepete eklemeden tek ürünle ödeme

  loadCatalog: async () => {
    if (get()._loading) return;
    set({ _loading: true, loading: true, loadError: false });
    try {
      const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);
      set({ categories, products: products.filter((p) => p.is_available !== false), loading: false });
    } catch (err) {
      console.error('Katalog yüklenemedi', err);
      set({ loading: false, loadError: true });
    } finally {
      set({ _loading: false });
    }
  },

  loadSettings: async () => {
    try {
      const s = await getDoc(doc(db, 'settings', 'discord'));
      if (s.exists()) set({ discord: { invite_url: DEFAULT_DISCORD, ...s.data() } });
    } catch {
      /* varsayılan link kalır */
    }
  },

  setUser: (user) => set({ user, authReady: true }),

  openAuth: () => set({ authOpen: true }),
  closeAuth: () => set({ authOpen: false }),
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
  /** item verilirse sadece o ürünle ödeme açılır, verilmezse sepetle. */
  openCheckout: (item = null) => set({ buyNowItem: item, checkoutOpen: true, cartOpen: false }),
  closeCheckout: () => set({ checkoutOpen: false, buyNowItem: null }),
}));

/** Discord davet linki (admin panelden değiştirilebilir). */
export const useDiscordUrl = () => useShopStore((s) => s.discord?.invite_url || DEFAULT_DISCORD);
