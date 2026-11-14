import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchVouches, cleanVouchText } from '../../lib/vouches';
import { useT } from '../../i18n';

/** Ana sayfada sonsuz kayan şerit: Discord'dan gelen son gerçek yorumlar. */
const VouchMarquee = () => {
  const { t } = useT();
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetchVouches(24)
      .then((list) => setItems(list.filter((v) => v.content).slice(0, 16)))
      .catch(() => setItems([]));
  }, []);

  if (items.length < 3) return null;
  const loop = [...items, ...items];

  return (
    <>
      <div className="mq-label"><span className="status-dot-green" /> {t('marquee.label')}</div>
      <div className="marquee" style={{ '--mq-dur': `${Math.max(30, items.length * 5)}s` }}>
        <div className="marquee-track">
          {loop.map((v, i) => (
            <Link key={`${v.id}-${i}`} to="/reviews" className="mq-item" aria-hidden={i >= items.length}>
              {v.author_avatar ? <img src={v.author_avatar} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="mq-letter">{(v.author_name || '?')[0].toUpperCase()}</span>}
              <span>
                <strong>{v.author_name}</strong>
                <small>“{cleanVouchText(v.content)}”</small>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};

export default VouchMarquee;
