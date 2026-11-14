import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import VouchCard from './VouchCard';
import { fetchVouches } from '../../lib/vouches';
import { useT } from '../../i18n';

/** Ana sayfadaki kısa yorum bölümü: Discord'dan çekilen son yorumlar. */
const ReviewsSection = () => {
  const { t } = useT();
  const [vouches, setVouches] = useState(null);

  useEffect(() => {
    fetchVouches(30)
      .then((list) => setVouches(list.filter((v) => v.content).slice(0, 6)))
      .catch(() => setVouches([]));
  }, []);

  if (vouches && !vouches.length) return null;

  return (
    <section id="reviews" className="section-reviews">
      <div className="container">
        <div className="section-header-flex">
          <div>
            <span className="section-tag">{t('reviews.tag')}</span>
            <h2 className="section-title">{t('reviews.title')}</h2>
            <p className="section-desc">{t('reviews.desc')}</p>
          </div>
          <Link to="/reviews" className="btn-secondary">
            <span>{t('reviews.all')}</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="vouch-masonry vouch-masonry-home">
          {(vouches || []).map((v) => (
            <VouchCard key={v.id} vouch={v} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
