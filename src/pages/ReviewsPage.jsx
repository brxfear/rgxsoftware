import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import VouchCard from '../components/Reviews/VouchCard';
import { fetchVouches, requestVouchSync } from '../lib/vouches';
import { useDiscordUrl } from '../store/useShopStore';
import { usePageTitle } from '../lib/usePageTitle';
import { useT } from '../i18n';

/** /reviews — Discord vouch kanalındaki tüm müşteri yorumları */
const ReviewsPage = () => {
  const { t } = useT();
  usePageTitle(t('reviewsPage.title'));
  const discordUrl = useDiscordUrl();
  const [vouches, setVouches] = useState(null);
  const [filter, setFilter] = useState('all');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchVouches()
        .then((list) => alive && setVouches(list))
        .catch(() => alive && setVouches((v) => v || []));
    load();
    // Sunucudan yeni vouch'ları çekmesini iste; yeni varsa listeyi yenile
    requestVouchSync().then((r) => r?.added > 0 && load());
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => e.key === 'Escape' && setLightbox(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const all = vouches || [];
  const withImg = all.filter((v) => v.image_count > 0);
  const textOnly = all.filter((v) => !v.image_count);
  const shown = filter === 'img' ? withImg : filter === 'text' ? textOnly : all;

  return (
    <div className="page container">
      <nav className="crumbs" aria-label="breadcrumb">
        <Link to="/">{t('nav.home')}</Link>
        <span>/</span>
        <strong>{t('reviewsPage.title')}</strong>
      </nav>

      <header className="page-head">
        <span className="page-chip"><b>{t('reviewsPage.verified')}</b> {t('reviewsPage.chip')}</span>
        <h1 className="page-title page-title-xl">{t('reviewsPage.heading')}</h1>
        <p className="page-sub">{all.length ? t('reviewsPage.sub', { n: all.length }) : t('reviewsPage.subEmpty')}</p>
      </header>

      <div className="filter-pills" role="tablist">
        {[
          ['all', t('reviewsPage.all'), all.length],
          ['img', t('reviewsPage.withImg'), withImg.length],
          ['text', t('reviewsPage.textOnly'), textOnly.length],
        ].map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {label} <span>{n}</span>
          </button>
        ))}
      </div>

      {vouches === null ? (
        <div className="empty-state">{t('account.loading')}</div>
      ) : !shown.length ? (
        <div className="empty-state">
          <p>{t('reviewsPage.empty')}</p>
          <a className="btn-secondary" href={discordUrl} target="_blank" rel="noopener noreferrer">Discord</a>
        </div>
      ) : (
        <div className="vouch-masonry">
          {shown.map((v) => (
            <VouchCard key={v.id} vouch={v} onImage={setLightbox} />
          ))}
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button className="lightbox-close" aria-label={t('modal.close')}><X size={20} /></button>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default ReviewsPage;
