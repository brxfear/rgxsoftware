import React, { useState } from 'react';
import { X, ShoppingBag, Terminal, ShieldCheck, Zap, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import './ProductModal.css';

const ProductModal = ({ isOpen, onClose, product, onAddToCart }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    if (!isOpen || !product) return null;

    const allImages = [
        product.image_url || product.image,
        ...(product.extra_images || [])
    ].filter(Boolean);

    const getYoutubeEmbedUrl = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
    };

    const videoEmbedUrl = getYoutubeEmbedUrl(product.video_url);
    const isDirectVideo = product.video_url && !videoEmbedUrl;

    const nextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    };

    const prevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="glass-panel product-modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-modal" onClick={onClose}><X /></button>

                <div className="modal-scroll-container">
                    {/* Video Section at Top */}
                    {product.video_url && (
                        <div className="modal-video-section">
                            <div className="video-container-glow">
                                {videoEmbedUrl ? (
                                    <iframe
                                        src={videoEmbedUrl}
                                        title="Product Video"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                ) : (
                                    <video controls>
                                        <source src={product.video_url} type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="modal-grid">
                        <div className="modal-image-gallery">
                            <div className="main-image-slider">
                                <img src={allImages[currentImageIndex]} alt={product.name} className="modal-image" />
                                
                                {allImages.length > 1 && (
                                    <>
                                        <button className="slider-nav prev" onClick={prevImage}><ChevronLeft /></button>
                                        <button className="slider-nav next" onClick={nextImage}><ChevronRight /></button>
                                    </>
                                )}
                                
                                <div className="image-glow"></div>
                                <div className="image-badge cyber-font">
                                    <ShieldCheck size={14} /> ENCRYPTED DATA
                                </div>
                            </div>

                            {allImages.length > 1 && (
                                <div className="thumbnail-strip">
                                    {allImages.map((img, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`thumbnail-item ${idx === currentImageIndex ? 'active' : ''}`}
                                            onClick={() => setCurrentImageIndex(idx)}
                                        >
                                            <img src={img} alt={`thumb-${idx}`} />
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
        </div>
    );
};

export default ProductModal;
