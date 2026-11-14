import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Pin, Sparkles, Info, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import Lightbox from '../components/Lightbox';
import { announcementImageUrl, requestVouchSync } from '../lib/vouches';
import { useShopStore, useDiscordUrl } from '../store/useShopStore';
import { markAnnouncementsSeen } from '../lib/announcements';
import { toDate } from '../lib/db';
import { usePageTitle } from '../lib/usePageTitle';
import { useT } from '../i18n';

const ICON = { update: RefreshCw, new: Sparkles, info: Info, warning: AlertTriangle };

/** /announcements — duyurular */
const AnnouncementsPage = () => {
  const { t, lang } = useT();
  usePageTitle(t('ann.title'));
  const list = useShopStore((s) => s.announcements);
  const discordUrl = useDiscordUrl();
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    // Discord duyuru kanalında yeni mesaj varsa çek, listeyi yenile
    requestVouchSync().then((r) => r?.added > 0 && useShopStore.getState().loadAnnouncements());
  }, []);

  useEffect(() => {
    if (list?.length) markAnnouncementsSeen(list[0]);
  }, [list]);

  const sorted = (list || []).filter((a) => !a.hidden).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const pick = (a, k) => (lang === 'en' && a[`${k}_en`]) || a[k];

  return (
    <div className="page container ann-page">
      <nav className="crumbs" aria-label="breadcrumb">
        <Link to="/">{t('nav.home')}</Link>
        <span>/</span>
        <strong>{t('ann.title')}</strong>
      </nav>
      <header className="page-head">
        <h1 className="page-title">{t('ann.title')}</h1>
        <p className="page-sub">{t('ann.sub')}</p>
      </header>

      {list === null ? (
        <div className="empty-state">{t('account.loading')}</div>
      ) : !sorted.length ? (
        <div className="ap-empty">
          <Megaphone size={24} />
          <p>{t('ann.empty')}</p>
          <a className="ap-btn-ghost" href={discordUrl} target="_blank" rel="noopener noreferrer">Discord</a>
        </div>
      ) : (
        <div className="ann-list">
          {sorted.map((a) => {
            const Icon = ICON[a.type] || Megaphone;
            const date = toDate(a.created_at);
            return (
              <article key={a.id} className={`ann-card ann-${a.type || 'info'}`}>
                <div className="ann-icon"><Icon size={18} /></div>
                <div className="ann-content">
                  <div className="ann-meta">
                    <span className="ann-type">{t(`ann.types.${a.type || 'info'}`)}</span>
                    {a.pinned && <span className="ann-pin"><Pin size={11} /> {t('ann.pinned')}</span>}
                    {date && <time>{date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</time>}
                  </div>
                  <h2>{pick(a, 'title')}</h2>
                  {pick(a, 'body') && <p>{pick(a, 'body')}</p>}
                  {a.image_count > 0 && (
                    <div className={`ann-images n${Math.min(a.image_count, 2)}`}>
                      {Array.from({ length: Math.min(a.image_count, 4) }, (_, i) => (
                        <button key={i} onClick={() => setZoom(announcementImageUrl(a.id, i))}>
                          <img src={announcementImageUrl(a.id, i)} alt="" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                  {a.source === 'discord' && (
                    <div className="ann-foot">
                      {a.author_avatar && <img src={a.author_avatar} alt="" referrerPolicy="no-referrer" />}
                      <span>{a.author_name}</span>
                      {a.message_url && (
                        <a href={a.message_url} target="_blank" rel="noopener noreferrer">{t('ann.openDiscord')} <ExternalLink size={12} /></a>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  );
};

export default AnnouncementsPage;
