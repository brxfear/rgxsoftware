import React from 'react';
import { ShieldCheck, Eye, Zap, ChevronRight } from 'lucide-react';
import './ProductCard.css';

const ProductCard = ({ product, onClick }) => {
  const lowestPrice = Math.min(
    product.price_1day || product.price || Infinity,
    product.price_7day || Infinity,
    product.price_30day || Infinity,
    product.price_lifetime || Infinity
  );

  const displayPrice = lowestPrice === Infinity ? (product.price || 290) : lowestPrice;

  return (
    <div className="product-card glass-card" onClick={() => onClick(product)}>
      <div className="product-card-top">
        <div className="product-image-wrap">
          <img 
            src={product.image || product.image_url || '/favicon.png'} 
            alt={product.name} 
            className="product-img"
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80';
            }}
          />
          <div className="product-floating-badges">
            <span className="status-badge-undetected">
              <span className="status-dot-green"></span>
              UNDETECTED
            </span>
          </div>
        </div>
      </div>

      <div className="product-card-body">
        <div className="product-meta">
          <span className="product-category-tag">{product.category_name || 'Özel Yazılım'}</span>
          <span className="product-features-count">4 Plan Mevcut</span>
        </div>

        <h3 className="product-title">{product.name}</h3>
        <p className="product-description">{product.description || 'Gelişmiş ESP, Aimbot ve HWID koruması içeren birinci sınıf yazılım.'}</p>

        <div className="product-card-footer">
          <div className="price-block">
            <span className="price-label">Başlangıç</span>
            <div className="price-value">
              <span className="currency">₺</span>
              <span className="amount">{displayPrice.toLocaleString('tr-TR')}</span>
            </div>
          </div>

          <button 
            className="select-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClick(product);
            }}
          >
            <span>İncele</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
