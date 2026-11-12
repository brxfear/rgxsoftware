import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { auth, db } from '../lib/firebase';

// Sepet: localStorage'da tutulur; giriş yapmış kullanıcı için carts/{uid}/items altına da yazılır.
// Kalem id'si = `${productId}_${duration}` (hem yerelde hem Firestore'da aynı).
const itemId = (productId, duration) => `${productId}_${duration || 1}`;
const itemsCol = (uid) => collection(db, 'carts', uid, 'items');

const toastStyle = {
  background: '#141012',
  color: '#ff4d55',
  border: '1px solid #e0262f',
};

const safe = async (fn) => {
  try {
    await fn();
  } catch (err) {
    console.error('Sepet senkronizasyon hatası:', err);
  }
};

export const useCartStore = create(
  persist(
    (set, get) => ({
      cart: [],
      loading: false,

      /** Girişten sonra: yerel sepeti hesaba yazar, sonra hesabın sepetini yükler. */
      fetchCart: async () => {
        const user = auth.currentUser;
        if (!user) return;
        set({ loading: true });
        await safe(async () => {
          const local = get().cart;
          if (local.length) {
            const batch = writeBatch(db);
            local.forEach((item) => {
              const id = itemId(item.product_id, item.duration);
              batch.set(doc(itemsCol(user.uid), id), {
                product_id: item.product_id,
                name: item.name,
                price: item.price,
                duration: item.duration,
                durationLabel: item.durationLabel,
                image: item.image || '',
                quantity: item.quantity,
                updated_at: serverTimestamp(),
              });
            });
            await batch.commit();
          }
          const snap = await getDocs(itemsCol(user.uid));
          set({
            cart: snap.docs.map((d) => {
              const x = d.data();
              return {
                id: d.id,
                product_id: x.product_id,
                name: x.name,
                price: x.price,
                duration: x.duration || 1,
                durationLabel: x.durationLabel || '1 GÜN',
                image: x.image,
                quantity: x.quantity || 1,
              };
            }),
          });
        });
        set({ loading: false });
      },

      addItem: async (product) => {
        const duration = product.selectedDuration || 1;
        const id = itemId(product.id, duration);
        const existing = get().cart.find((i) => i.id === id);
        let next;

        if (existing) {
          next = { ...existing, quantity: existing.quantity + 1 };
          set({ cart: get().cart.map((i) => (i.id === id ? next : i)) });
        } else {
          next = {
            id,
            product_id: product.id,
            name: product.name,
            price: product.selectedPrice || product.price,
            duration,
            durationLabel: product.selectedLabel || '1 GÜN',
            image: product.image_url || product.image || '',
            quantity: 1,
          };
          set({ cart: [...get().cart, next] });
        }

        toast.success('Ürün sepete eklendi!', { style: toastStyle });

        const user = auth.currentUser;
        if (user) {
          await safe(() =>
            setDoc(doc(itemsCol(user.uid), id), {
              product_id: next.product_id,
              name: next.name,
              price: next.price,
              duration: next.duration,
              durationLabel: next.durationLabel,
              image: next.image,
              quantity: next.quantity,
              updated_at: serverTimestamp(),
            })
          );
        }
      },

      updateQuantity: async (id, delta) => {
        const item = get().cart.find((i) => i.id === id);
        if (!item) return;
        const quantity = item.quantity + delta;
        if (quantity < 1) return;
        set({ cart: get().cart.map((i) => (i.id === id ? { ...i, quantity } : i)) });

        const user = auth.currentUser;
        if (user) await safe(() => updateDoc(doc(itemsCol(user.uid), id), { quantity }));
      },

      removeItem: async (id) => {
        set({ cart: get().cart.filter((i) => i.id !== id) });
        const user = auth.currentUser;
        if (user) await safe(() => deleteDoc(doc(itemsCol(user.uid), id)));
      },

      clearCart: async () => {
        const items = get().cart;
        set({ cart: [] });
        const user = auth.currentUser;
        if (user && items.length) {
          await safe(async () => {
            const batch = writeBatch(db);
            items.forEach((i) => batch.delete(doc(itemsCol(user.uid), i.id)));
            await batch.commit();
          });
        }
      },
    }),
    { name: 'brx-cart-storage' }
  )
);
