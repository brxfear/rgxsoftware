import Price from '../Price';
import React from 'react';
import { useT, planLabel } from '../../i18n';
import { ShoppingCart, X, Trash2, Plus, Minus } from 'lucide-react';
import { useCartStore } from '../../store/useCartStore';
import './Cart.css';

const Cart = ({ isOpen, onClose, onCheckout }) => {
    const { t, lang } = useT();
    const { cart, updateQuantity, removeItem, loading } = useCartStore();
    const totalUsd = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (!isOpen) return null;

    return (
        <div className="cart-overlay" onClick={onClose}>
            <div className="glass-panel cart-panel" onClick={e => e.stopPropagation()}>
                <div className="cart-header">
                    <h2 className="cyber-font neon-text"><ShoppingCart size={20} /> {t('cart.title')}</h2>
                    <button onClick={onClose} className="close-btn" aria-label={t('modal.close')}><X /></button>
                </div>

                <div className="cart-items">
                    {loading ? (
                        <div className="empty-cart cyber-font">{t('cart.syncing')}</div>
                    ) : cart.length === 0 ? (
                        <div className="empty-cart cyber-font">{t('cart.empty')}</div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.id} className="cart-item glass-panel">
                                <div className="cart-item-img">
                                    <img src={item.image || '/logo.webp'} alt={item.name} />
                                </div>
                                <div className="cart-item-info">
                                    <span className="item-name">{item.name}</span>
                                    {item.durationLabel && (
                                        <span className="item-duration">{planLabel(item.durationLabel, lang)}</span>
                                    )}
                                    <Price usd={item.price} className="item-price" />
                                    <div className="quantity-controls">
                                        <button onClick={() => updateQuantity(item.id, -1)} disabled={item.quantity <= 1} className="qty-btn"><Minus size={12} /></button>
                                        <span className="qty-val">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, 1)} className="qty-btn"><Plus size={12} /></button>
                                    </div>
                                </div>
                                <button onClick={() => removeItem(item.id)} className="remove-btn">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {!loading && cart.length > 0 && (
                    <div className="cart-footer">
                        <div className="cart-total">
                            <span>{t('cart.total')}</span>
                            <Price usd={totalUsd} className="total-amount" />
                        </div>
                        <button onClick={onCheckout} className="neon-button checkout-btn">
                            {t('cart.checkout')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Cart;
