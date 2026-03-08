import React from 'react';
import { X, ShoppingBag, Terminal, ShieldCheck, Zap } from 'lucide-react';
import './ProductModal.css';

const ProductModal = ({ isOpen, onClose, product, onAddToCart }) => {
    if (!isOpen || !product) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="glass-panel product-modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-modal" onClick={onClose}><X /></button>

                <div className="modal-grid">
                    <div className="modal-image-container">
                        <img src={product.image || product.image_url} alt={product.name} className="modal-image" />
                        <div className="image-glow"></div>
                        <div className="image-badge cyber-font">
                            <ShieldCheck size={14} /> ENCRYPTED DATA
                        </div>
                    </div>

                    <div className="modal-info">
                        <div className="modal-header">
                            <span className="status-indicator">SYSTEM ONLINE</span>
                            <h2 className="cyber-font neon-text">{product.name}</h2>
                        </div>

                        <div className="modal-price">
                            <span className="price-label cyber-font">PROTOCOL ACCESS FEE:</span>
                            <span className="amount">₺{product.price}</span>
                        </div>

                        <div className="modal-description">
                            <h4 className="cyber-font"><Terminal size={14} /> TECHNICAL SPECS:</h4>
                            <p style={{ whiteSpace: 'pre-wrap' }}>
                                {product.description || "No encrypted data provided for this sector."}
                            </p>
                        </div>

                        {product.details && (
                            <div className="modal-details-extended">
                                <h4 className="cyber-font"><Terminal size={14} /> EXTENDED PROTOCOL DETAILS:</h4>
                                <p style={{ whiteSpace: 'pre-wrap' }}>
                                    {product.details}
                                </p>
                            </div>
                        )}

                        <div className="modal-benefits">
                            <div className="benefit-item">
                                <Zap size={14} /> <span>Instant Digital Delivery</span>
                            </div>
                            <div className="benefit-item">
                                <ShieldCheck size={14} /> <span>24/7 Priority Support</span>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="neon-button buy-now-btn"
                                onClick={() => {
                                    onAddToCart(product);
                                    onClose();
                                }}
                            >
                                <ShoppingBag size={20} /> AUTHENTICATE & BUY
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductModal;
