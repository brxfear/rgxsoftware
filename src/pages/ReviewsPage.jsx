import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { BadgeCheck, MessageSquare } from 'lucide-react';
import VouchCard from '../components/Reviews/VouchCard';
import Lightbox from '../components/Lightbox';
import { Stars } from '../components/Reviews/ReviewForm';
import { db } from '../lib/firebase';
import { toDate } from '../lib/db';
import { fetchVouches, requestVouchSync } from '../lib/vouches';
import { useDiscordUrl } from '../store/useShopStore';
import { usePageTitle } from '../lib/usePageTitle';
import { useT } from '../i18n';

const DiscordGlyph = ({ size = 26 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path fill="currentColor" d="M20.32 4.37A19.8 19.8 0 0 0 15.4 2.8a13.8 13.8 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.5 0 12.6 12.6 0 0 0-.64-1.29 19.7 19.7 0 0 0-4.92 1.53C.6 9.05-.24 13.6.18 18.1a19.9 19.9 0 0 0 6.04 3.05c.49-.66.92-1.36 1.29-2.1a12.9 12.9 0 0 1-2.03-.97l.5-.39a14.2 14.2 0 0 0 12.06 0l.5.39c-.65.38-1.33.71-2.04.97.37.74.8 1.44 1.29 2.1a19.8 19.8 0 0 0 6.04-3.05c.5-5.2-.84-9.72-3.57-13.73ZM8.02 15.33c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.1 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.1 2.15 2.42 0 1.34-.94 2.42-2.15 2.42Z" />
  </svg>
);

/** /reviews — doğrulanmış site yorumları + Discord vouch kanalı */
const ReviewsPage = () => {
  const { t, lang } = useT();
  usePageTitle(t('reviewsPage.title'));
  const discordUrl = useDiscordUrl();
  const [site, setSite] = useState(null);
  const [vouches, setVouches] = useState(null);
  const [siteFilter, setSiteFilter] = useState('all');
  const [dcFilter, setDcFilter] = useState('all');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let alive = true;
    getDocs(query(collection(db, 'reviews'), orderBy('created_at', 'desc'), limit(300)))
      .then((s) => alive && setSite(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => alive && setSite([]));
    const load = () => fetchVouches().then((l) => alive && setVouches(l)).catch(() => alive && setVouches((v) => v || []));
    load();
    requestVouchSync().then((r) => r?.added > 0 && load());
    return () => {
      alive = false;
    };
  }, []);

  const avg = useMemo(() => (site?.length ? site.reduce((s, r) => s + r.rating, 0) / site.length : 0), [site]);
  const siteShown = (site || []).filter((r) => (siteFilter === '5' ? r.rating === 5 : siteFilter === 'low' ? r.rating < 5 : true));
  const dc = vouches || [];
  const dcShown = dc.filter((v) => (dcFilter === 'img' ? v.image_count > 0 : dcFilter === 'text' ? !v.image_count : true));
  const locale = lang === 'tr' ? 'tr-TR' : 'en-GB';

  return (
    <div className="page container">
      <nav className="crumbs" aria-label="breadcrumb">
        <Link to="/">{t('nav.home')}</Link>
        <span>/</span>
        <strong>{t('reviewsPage.title')}</strong>
      </nav>

      {/* ---------- Site yorumları ---------- */}
      <section className="rvp-section">
        <div className="rvp-head">
          <div>
            <span className="st-eyebrow">{t('reviewsPage.siteEyebrow')}</span>
            <h1 className="page-title page-title-xl">{t('reviewsPage.heading')}</h1>
            <p className="page-sub">{t('reviewsPage.siteSub')}</p>
          </div>
          <div className="rvp-score">
            <img src="/logo.webp" alt="" />
            <div>
              <strong>{site?.length ? avg.toFixed(2) : '—'}</strong>
              <Stars value={Math.round(avg)} size={15} />
              <small>{t('reviewsPage.verifiedCount', { n: site?.length || 0 })}</small>
            </div>
          </div>
        </div>
        <div className="filter-pills" role="tablist">
          {[['all', t('reviewsPage.all'), site?.length || 0], ['5', '5 ★', (site || []).filter((r) => r.rating === 5).length], ['low', t('reviewsPage.fourBelow'), (site || []).filter((r) => r.rating < 5).length]].map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={siteFilter === k} className={siteFilter === k ? 'on' : ''} onClick={() => setSiteFilter(k)}>{l} <span>{n}</span></button>
          ))}
        </div>
        {site === null ? (
          <div className="empty-state">{t('account.loading')}</div>
        ) : !siteShown.length ? (
          <div className="rvp-empty">{t('reviewsPage.siteEmpty')}</div>
        ) : (
          <div className="rvp-grid">
            {siteShown.map((r) => (
              <article key={r.id} className="rvp-card">
                <div className="rvp-card-top">
                  <Stars value={r.rating} />
                  <span className="rvp-verified"><BadgeCheck size={13} /> {t('reviewsPage.verifiedPurchase')}</span>
                </div>
                <p className="rvp-text">{r.text ? `“${r.text}”` : t('reviewsPage.noText')}</p>
                <div className="rvp-card-foot">
                  <span className="rvp-avatar">{(r.name || '?')[0].toUpperCase()}</span>
                  <div>
                    <strong>{r.product_name}</strong>
                    <small>{r.name || '—'}</small>
                  </div>
                  <time>{toDate(r.created_at)?.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) || ''}</time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Discord ---------- */}
      <section className="rvp-section">
        <div className="rvp-head">
          <div>
            <span className="st-eyebrow">{t('reviewsPage.dcEyebrow')}</span>
            <h2 className="page-title">{t('reviewsPage.dcHeading')}</h2>
            <p className="page-sub">{t('reviewsPage.dcSub')}</p>
          </div>
          <a className="rvp-score rvp-score-dc" href={discordUrl} target="_blank" rel="noopener noreferrer">
            <span className="rvp-dc-ico"><DiscordGlyph /></span>
            <div>
              <strong>{dc.length}</strong>
              <small>{t('reviewsPage.dcCount')}</small>
            </div>
          </a>
        </div>
        <div className="filter-pills" role="tablist">
          {[['all', t('reviewsPage.all'), dc.length], ['img', t('reviewsPage.withImg'), dc.filter((v) => v.image_count > 0).length], ['text', t('reviewsPage.textOnly'), dc.filter((v) => !v.image_count).length]].map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={dcFilter === k} className={dcFilter === k ? 'on' : ''} onClick={() => setDcFilter(k)}>{l} <span>{n}</span></button>
          ))}
        </div>
        {vouches === null ? (
          <div className="empty-state">{t('account.loading')}</div>
        ) : !dcShown.length ? (
          <div className="rvp-empty"><MessageSquare size={20} /> {t('reviewsPage.empty')}</div>
        ) : (
          <div className="vouch-masonry">
            {dcShown.map((v) => <VouchCard key={v.id} vouch={v} onImage={setLightbox} />)}
          </div>
        )}
      </section>
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
};

export default ReviewsPage;
