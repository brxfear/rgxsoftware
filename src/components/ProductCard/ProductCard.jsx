import React from 'react';
import { ChevronRight, Star } from 'lucide-react';
import './ProductCard.css';

const ProductCard = ({ product, onClick, highlight = false }) => {
  const lowestPrice = Math.min(
    product.price_1day || product.price || Infinity,
    product.price_7day || Infinity,
    product.price_30day || Infinity,
    product.price_lifetime || Infinity
  );

  const displayPrice = lowestPrice === Infinity ? (product.price || 290) : lowestPrice;
  const planCount = [product.price_1day || product.price, product.price_7day, product.price_30day, product.price_lifetime].filter(Boolean).length || 1;

  return (
    <div className="product-card glass-card" onClick={() => onClick(product)}>
      <div className="product-card-top">
        <div className="product-image-wrap">
          <img 
            src={product.image || product.image_url || '/logo.webp'} 
            alt={product.name} 
            className="product-img"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/logo.webp';
              e.currentTarget.classList.add('product-img-fallback');
            }}
          />
          <div className="product-floating-badges">
            {highlight && <span className="badge-recommended"><Star size={11} fill="currentColor" /> Ekip önerisi</span>}
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
          <span className="product-features-count">{planCount} plan</span>
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
