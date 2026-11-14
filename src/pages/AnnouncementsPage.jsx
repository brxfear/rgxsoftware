import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Pin, Sparkles, Info, AlertTriangle, RefreshCw } from 'lucide-react';
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

  useEffect(() => {
    if (list?.length) markAnnouncementsSeen(list[0]);
  }, [list]);

  const sorted = (list || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
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
                  <p>{pick(a, 'body')}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
