import React from 'react';
import { useT } from '../../i18n';
import { MessageSquare } from 'lucide-react';

// Discord sunucusundaki gerçek müşteri yorumları (olduğu gibi).
const reviews = [
  { author: 'Bennu', date: '10.11.2026', text: 'hatasız boyasız oneclick external alın aldırın' },
  { author: 'santa', date: '10.11.2026', text: 'cok guzel oneclick kullandım' },
  { author: 'its_Secret', date: '10.11.2026', text: '+rep Support Goated too!' },
];

const ReviewsSection = () => {
  const { t } = useT();
  return (
    <section id="reviews" className="section-reviews">
      <div className="container">
        <div className="section-header-flex">
          <div>
            <span className="section-tag">{t('reviews.tag')}</span>
            <h2 className="section-title">{t('reviews.title')}</h2>
            <p className="section-desc">{t('reviews.desc')}</p>
          </div>
          <a
            href="https://discord.gg/rgxsoftware1"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <MessageSquare size={16} />
            <span>{t('reviews.all')}</span>
          </a>
        </div>

        <div className="reviews-grid">
          {reviews.map((rev) => (
            <div key={rev.author} className="review-card glass-panel">
              <p className="review-text">“{rev.text}”</p>
              <div className="review-author-info">
                <div className="review-avatar">{rev.author.charAt(0).toUpperCase()}</div>
                <div>
                  <h4 className="review-name">{rev.author}</h4>
                  <span className="review-game">{t('reviews.via')} · {rev.date}</span>
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
