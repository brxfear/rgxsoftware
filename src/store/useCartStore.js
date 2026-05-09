import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

export const useCartStore = create(
    persist(
        (set, get) => ({
            cart: [],
            loading: false,

            fetchCart: async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                set({ loading: true });
                const { data, error } = await supabase
                    .from('cart_items')
                    .select('*, products(*)')
                    .eq('user_id', user.id);

                if (error) {
                    console.error('Fetch cart error:', error);
                } else {
                    set({
                        cart: data.map(item => ({
                            id: item.id,
                            product_id: item.product_id,
                            name: item.products.name,
                            price: item.products.price,
                            image: item.products.image_url,
                            quantity: item.quantity
                        }))
                    });
                }
                set({ loading: false });
            },

            addItem: async (product) => {
                const toastStyle = {
                    background: '#141419',
                    color: '#bc13fe',
                    border: '1px solid #bc13fe',
                    fontFamily: 'Space Grotesk'
                };

                const { data: { user } } = await supabase.auth.getUser();

                // Local logic (Persistence handles this)
                const localExisting = get().cart.find(item => (item.product_id || item.id) === product.id && item.duration === (product.selectedDuration || 1));

                if (localExisting) {
                    set({
                        cart: get().cart.map(item =>
                            (item.product_id || item.id) === product.id && item.duration === (product.selectedDuration || 1)
                                ? { ...item, quantity: item.quantity + 1 }
                                : item
                        )
                    });
                } else {
                    set({
                        cart: [...get().cart, {
                            id: `${product.id}_${product.selectedDuration || 1}`,
                            product_id: product.id,
                            name: product.name,
                            price: product.selectedPrice || product.price,
                            duration: product.selectedDuration || 1,
                            durationLabel: product.selectedLabel || '1 GÜN',
                            image: product.image_url || product.image,
                            quantity: 1
                        }]
                    });
                }

                toast.success('Ürün sepete eklendi! 👾', { style: toastStyle });

                // Remote sync if logged in
                if (user) {
                    const existingItem = get().cart.find(item => item.product_id === product.id && item.id !== product.id); // Check for DB id
                    // Actually, if we use persist, the DB sync needs to be careful.
                    // For now, let's keep the user's request for "localStorage" as the main one.
                    const { data: dbItem } = await supabase
                        .from('cart_items')
                        .select('id, quantity')
                        .eq('user_id', user.id)
                        .eq('product_id', product.id)
                        .single();

                    if (dbItem) {
                        await supabase
                            .from('cart_items')
                            .update({ quantity: dbItem.quantity + 1 })
                            .eq('id', dbItem.id);
                    } else {
                        await supabase
                            .from('cart_items')
                            .insert([{
                                user_id: user.id,
                                product_id: product.id,
                                quantity: 1
                            }]);
                    }
                    get().fetchCart(); // Re-sync to get DB IDs
                }
            },

            updateQuantity: async (itemId, delta) => {
                const item = get().cart.find(i => i.id === itemId);
                if (!item) return;

                const newQty = item.quantity + delta;
                if (newQty < 1) return;

                // Local Update
                set({
                    cart: get().cart.map(i => i.id === itemId ? { ...i, quantity: newQty } : i)
                });

                // Remote Update
                const { data: { user } } = await supabase.auth.getUser();
                if (user && typeof itemId === 'string' && itemId.length > 30) { // Simple check for UUID
                    await supabase
                        .from('cart_items')
                        .update({ quantity: newQty })
                        .eq('id', itemId);
                }
            },

            removeItem: async (itemId) => {
                // Local Update
                set({
                    cart: get().cart.filter(i => i.id !== itemId)
                });

                // Remote Update
                const { data: { user } } = await supabase.auth.getUser();
                if (user && typeof itemId === 'string' && itemId.length > 30) {
                    await supabase
                        .from('cart_items')
                        .delete()
                        .eq('id', itemId);
                }
            },

            clearCart: async () => {
                set({ cart: [] });
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('cart_items').delete().eq('user_id', user.id);
                }
            }
        }),
        {
            name: 'brx-cart-storage',
        }
    )
);

