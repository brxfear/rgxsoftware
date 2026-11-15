// Sayfalar arası ortak durum: katalog, kullanıcı, site ayarları ve açık pencereler (giriş, sepet, ödeme).
import { create } from 'zustand';
import { collection, doc, getDoc, getDocs, orderBy, query, limit } from 'firebase/firestore';
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
  announcements: null,
  campaign: null, // settings/campaign (aktif ve süresi dolmamışsa)
  reseller: null, // giriş yapan kullanıcı bayiyse resellers/{uid} kaydı

  authOpen: false,
  cartOpen: false,
  checkoutOpen: false,
  buyNowItem: null, // "Hemen satın al": sepete eklemeden tek ürünle ödeme

  loadCatalog: async () => {
    if (get()._loading) return;
    set({ _loading: true, loading: true, loadError: false });
    try {
      const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);
      set({ categories, products: products.filter((p) => p.is_available !== false && !p.test_only), loading: false });
    } catch (err) {
      console.error('Katalog yüklenemedi', err);
      set({ loading: false, loadError: true });
    } finally {
      set({ _loading: false });
    }
  },

  loadSettings: async () => {
    try {
      const [s, c] = await Promise.all([getDoc(doc(db, 'settings', 'discord')), getDoc(doc(db, 'settings', 'campaign'))]);
      if (s.exists()) set({ discord: { invite_url: DEFAULT_DISCORD, ...s.data() } });
      const cd = c.exists() ? c.data() : null;
      const ends = cd?.ends_at ? new Date(cd.ends_at).getTime() : 0;
      if (cd?.active && (!ends || ends > Date.now())) set({ campaign: cd });
    } catch {
      /* varsayılan link kalır */
    }
  },

  loadAnnouncements: async () => {
    try {
      const snap = await getDocs(query(collection(db, 'announcements'), orderBy('created_at', 'desc'), limit(50)));
      set({ announcements: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
    } catch {
      set({ announcements: [] });
    }
  },

  setUser: (user) => {
    set({ user, authReady: true, reseller: null });
    if (user) {
      getDoc(doc(db, 'resellers', user.uid))
        .then((s) => get().user?.uid === user.uid && set({ reseller: s.exists() ? { uid: s.id, ...s.data() } : null }))
        .catch(() => {});
    }
  },

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
