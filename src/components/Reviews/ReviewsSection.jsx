import React from 'react';
import { Star, MessageSquare } from 'lucide-react';

const mockReviews = [
  {
    author: "Kadir B.",
    game: "Valorant Hypervisor",
    rating: 5,
    text: "Sipariş verdim 10 saniye sonra key geldi, 2 haftadır Immortal eloda oynuyorum ban falan yok mükemmel."
  },
  {
    author: "Mert T.",
    game: "CS2 Rage & Legit",
    rating: 5,
    text: "Menüsü çok akıcı ve sade, FPS kesinlikle düşürmüyor. Ticket açtım 2 dakikada geri döndüler, helal olsun."
  },
  {
    author: "Caner S.",
    game: "HWID Spoofer",
    rating: 5,
    text: "Valorant anakart banım vardı format bile atmadan direkt açtı, tertemiz çalışıyor elinize sağlık."
  }
];

const ReviewsSection = () => {
  return (
    <section id="reviews" className="section-reviews">
      <div className="container">
        <div className="section-header-flex">
          <div>
            <span className="section-tag">TOPLULUK DEĞERLENDİRMELERİ</span>
            <h2 className="section-title">Müşteri Yorumları</h2>
            <p className="section-desc">Müşterilerimizin sipariş sonrasında Discord sunucumuzda paylaştığı gerçek geri bildirimler.</p>
          </div>
          <a 
            href="https://discord.gg/dQ5u8TRAxr" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn-secondary"
          >
            <MessageSquare size={16} />
            <span>Tüm Yorumları Gör</span>
          </a>
        </div>

        <div className="reviews-grid">
          {mockReviews.map((rev, i) => (
            <div key={i} className="review-card glass-panel">
              <div className="review-stars">
                {[...Array(rev.rating)].map((_, s) => (
                  <Star key={s} size={15} fill="#fbbf24" color="#fbbf24" />
                ))}
              </div>
              <p className="review-text">"{rev.text}"</p>
              <div className="review-author-info">
                <div className="review-avatar">
                  {rev.author.charAt(0)}
                </div>
                <div>
                  <h4 className="review-name">{rev.author}</h4>
                  <span className="review-game">{rev.game}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;

