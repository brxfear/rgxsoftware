import React from 'react';
import { toDate } from '../../lib/db';
import { vouchImageUrl } from '../../lib/vouches';
import { useT } from '../../i18n';

const DiscordGlyph = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
    <path fill="currentColor" d="M20.32 4.37A19.8 19.8 0 0 0 15.4 2.8a13.8 13.8 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.5 0 12.6 12.6 0 0 0-.64-1.29 19.7 19.7 0 0 0-4.92 1.53C.6 9.05-.24 13.6.18 18.1a19.9 19.9 0 0 0 6.04 3.05c.49-.66.92-1.36 1.29-2.1a12.9 12.9 0 0 1-2.03-.97l.5-.39a14.2 14.2 0 0 0 12.06 0l.5.39c-.65.38-1.33.71-2.04.97.37.74.8 1.44 1.29 2.1a19.8 19.8 0 0 0 6.04-3.05c.5-5.2-.84-9.72-3.57-13.73ZM8.02 15.33c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.1 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.1 2.15 2.42 0 1.34-.94 2.42-2.15 2.42Z" />
  </svg>
);

/** Tek bir Discord vouch kartı (isim, avatar, tarih, metin, görseller). */
const VouchCard = ({ vouch, onImage }) => {
  const { lang } = useT();
  const date = toDate(vouch.created_at)?.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const name = vouch.author_name || 'Discord';
  const images = Array.from({ length: vouch.image_count || 0 }, (_, i) => i);

  return (
    <article className="vouch-card">
      <header className="vouch-head">
        {vouch.author_avatar ? (
          <img className="vouch-avatar" src={vouch.author_avatar} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="vouch-avatar vouch-avatar-letter">{name[0].toUpperCase()}</span>
        )}
        <div className="vouch-who">
          <strong>{name}</strong>
          <span>{date}</span>
        </div>
        <span className="vouch-badge"><DiscordGlyph /> Discord</span>
      </header>

      {images.length > 0 && (
        <div className={`vouch-images n${Math.min(images.length, 2)}`}>
          {images.slice(0, 4).map((i) => (
            <button key={i} className="vouch-img" onClick={() => onImage?.(vouchImageUrl(vouch.id, i))} aria-label={`${name} görsel ${i + 1}`}>
              <img src={vouchImageUrl(vouch.id, i)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {vouch.content && <p className="vouch-text">“{vouch.content}”</p>}
    </article>
  );
};

export default VouchCard;
