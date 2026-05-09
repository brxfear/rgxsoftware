import React from 'react';
import './ProductCard.css';

const ProductCard = ({ product, onClick }) => {
    const lowestPrice = Math.min(
        product.price_1day || product.price || Infinity,
        product.price_7day || Infinity,
        product.price_30day || Infinity,
        product.price_lifetime || Infinity
    );

    return (
        <div className="product-card glass-panel" onClick={() => onClick(product)}>
            <div className="product-image">
                <img src={product.image || product.image_url} alt={product.name} />
                <div className="product-badge cyber-font">Secure</div>
                <div className="card-overlay">
                    <button className="view-specs-btn cyber-font">VIEW SPECS</button>
                </div>
            </div>
            <div className="product-info">
                <h3 className="product-name cyber-font">{product.name}</h3>
                <p className="product-desc">{product.description}</p>
                <div className="product-footer">
                    <div className="product-price">
                        <span className="price-from">başlangıç</span>
                        <div>
                            <span className="currency">₺</span>
                            <span className="amount">{lowestPrice === Infinity ? '0' : lowestPrice}</span>
                        </div>
                    </div>
                    <button
                        className="neon-button buy-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick(product);
                        }}
                    >
                        SEÇ
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductCard;
