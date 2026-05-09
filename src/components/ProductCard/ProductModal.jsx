import React, { useState } from 'react';
import { X, ShoppingBag, Terminal, ShieldCheck, Zap, ChevronLeft, ChevronRight, Play, Clock } from 'lucide-react';
import './ProductModal.css';

const ProductModal = ({ isOpen, onClose, product, onAddToCart }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedPlan, setSelectedPlan] = useState(null);

    if (!isOpen || !product) return null;

    const getYoutubeEmbedUrl = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
    };

    // Combine video and images into a single media list
    const mediaItems = [];
    if (product.video_url) {
        mediaItems.push({ type: 'video', url: product.video_url });
    }
    if (product.image_url || product.image) {
        mediaItems.push({ type: 'image', url: product.image_url || product.image });
    }
    if (product.extra_images && Array.isArray(product.extra_images)) {
        product.extra_images.forEach(img => {
            if (img) mediaItems.push({ type: 'image', url: img });
        });
    }

    const nextMedia = () => {
        setCurrentIndex((prev) => (prev + 1) % mediaItems.length);
    };

    const prevMedia = () => {
        setCurrentIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
    };

    const currentMedia = mediaItems[currentIndex];
    const videoEmbedUrl = currentMedia?.type === 'video' ? getYoutubeEmbedUrl(currentMedia.url) : null;

    // Subscription plans
    const plans = [
        { duration: 1, label: '1 GÜN', price: product.daily_price || product.price || 0 },
        { duration: 7, label: '7 GÜN', price: product.weekly_price || 0 },
        { duration: 30, label: '30 GÜN', price: product.monthly_price || 0 },
    ].filter(p => p.price > 0);

    const handleBuy = () => {
        if (!selectedPlan) return;
        onAddToCart({
            ...product,
            selectedDuration: selectedPlan.duration,
            selectedPrice: selectedPlan.price,
            selectedLabel: selectedPlan.label
        });
        setSelectedPlan(null);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="glass-panel product-modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-modal" onClick={onClose}><X /></button>

                <div className="modal-scroll-container">
                    <div className="modal-grid">
                        <div className="modal-image-gallery">
                            <div className="main-image-slider">
                                {currentMedia?.type === 'video' ? (
                                    <div className="video-container-glow slider-video">
                                        {videoEmbedUrl ? (
                                            <iframe
                                                src={videoEmbedUrl}
                                                title="Product Video"
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            ></iframe>
                                        ) : (
                                            <video controls autoPlay muted loop>
                                                <source src={currentMedia.url} type="video/mp4" />
                                            </video>
                                        )}
                                    </div>
                                ) : (
                                    <img src={currentMedia?.url} alt={product.name} className="modal-image" />
                                )}
                                
                                {mediaItems.length > 1 && (
                                    <>
                                        <button className="slider-nav prev" onClick={prevMedia}><ChevronLeft /></button>
                                        <button className="slider-nav next" onClick={nextMedia}><ChevronRight /></button>
                                    </>
                                )}
                                
                                <div className="image-glow"></div>
                                <div className="image-badge cyber-font">
                                    <ShieldCheck size={14} /> {currentMedia?.type === 'video' ? 'VIDEO FEED' : 'ENCRYPTED DATA'}
                                </div>
                            </div>

                            {mediaItems.length > 1 && (
                                <div className="thumbnail-strip">
                                    {mediaItems.map((item, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`thumbnail-item ${idx === currentIndex ? 'active' : ''} ${item.type === 'video' ? 'video-thumb' : ''}`}
                                            onClick={() => setCurrentIndex(idx)}
                                        >
                                            {item.type === 'video' ? (
                                                <div className="thumb-video-placeholder">
                                                    <Play size={20} />
                                                </div>
                                            ) : (
                                                <img src={item.url} alt={`thumb-${idx}`} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="modal-info">
                            <div className="modal-header">
                                <span className="status-indicator">SYSTEM ONLINE</span>
                                <h2 className="cyber-font neon-text">{product.name}</h2>
                            </div>

                            {/* Subscription Plan Selector */}
                            <div className="subscription-selector">
                                <h4 className="cyber-font"><Clock size={14} /> ABONELİK SÜRESİ SEÇ:</h4>
                                <div className="plan-options">
                                    {plans.map(plan => (
                                        <button
                                            key={plan.duration}
                                            className={`plan-card ${selectedPlan?.duration === plan.duration ? 'selected' : ''}`}
                                            onClick={() => setSelectedPlan(plan)}
                                        >
                                            <span className="plan-duration cyber-font">{plan.label}</span>
                                            <span className="plan-price">₺{plan.price}</span>
                                            {plan.duration === 30 && <span className="plan-badge">POPÜLER</span>}
                                        </button>
                                    ))}
                                </div>
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
                                    className={`neon-button buy-now-btn ${!selectedPlan ? 'disabled' : ''}`}
                                    onClick={handleBuy}
                                    disabled={!selectedPlan}
                                >
                                    <ShoppingBag size={20} /> 
                                    {selectedPlan 
                                        ? `${selectedPlan.label} - ₺${selectedPlan.price} SATIN AL` 
                                        : 'ÖNCE SÜRE SEÇ'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductModal;
