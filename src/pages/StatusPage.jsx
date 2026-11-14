import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import StatusPill from '../components/StatusPill';
import { useShopStore, useDiscordUrl } from '../store/useShopStore';
import { productPath } from '../lib/slug';
import { statusHistory, statusOf, fmtUptime, isUp, STATUS_TONE } from '../lib/status';
import { toDate } from '../lib/db';
import { usePageTitle } from '../lib/usePageTitle';
import { useT, localized } from '../i18n';

/** /status — ürünlerin canlı tespit durumu ve 30 günlük geçmişi */
const StatusPage = () => {
  const { t, lang } = useT();
  usePageTitle(t('status.title'));
  const categories = useShopStore((s) => s.categories);
  const products = useShopStore((s) => s.products);
  const loading = useShopStore((s) => s.loading);
  const discordUrl = useDiscordUrl();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-GB';

  const rows = useMemo(() => products.map((p) => ({ p, h: statusHistory(p) })), [products]);
  const down = rows.filter(({ p }) => !isUp(statusOf(p)));
  const avgUptime = rows.length ? rows.reduce((s, r) => s + r.h.uptime, 0) / rows.length : 100;
  const lastUpdate = rows
    .map(({ p, h }) => h.lastChange || toDate(p.updated_at) || toDate(p.created_at))
    .filter(Boolean)
    .sort((a, b) => b - a)[0];

  const groups = categories
    .map((c) => ({ c, items: rows.filter((r) => r.p.category_id === c.id) }))
    .filter((g) => g.items.length);

  return (
    <div className="page container st-page">
      <header className="page-head">
        <span className="st-eyebrow">{t('status.eyebrow')}</span>
        <h1 className="page-title">{t('status.heading1')} <span className="hero-accent">{t('status.heading2')}</span></h1>
        <p className="page-sub">{t('status.sub')}</p>
      </header>

      <div className={`st-summary ${down.length ? 'has-issue' : ''}`}>
        <span className={`st-pill st-${down.length ? 'warn' : 'ok'} st-pill-lg`}>
          <span className="st-dot" />
          {down.length ? t('status.issues', { n: down.length }) : t('status.allOk')}
        </span>
        <span className="st-summary-meta">
          {lastUpdate && <>{t('status.lastUpdate')}: {lastUpdate.toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · </>}
          {fmtUptime(avgUptime)} {t('status.uptime30')}
        </span>
        <a className="st-discord" href={discordUrl} target="_blank" rel="noopener noreferrer">{t('status.discord')} <ExternalLink size={14} /></a>
      </div>

      {loading ? (
        <div className="empty-state">{t('products.loading')}</div>
      ) : (
        groups.map(({ c, items }) => (
          <section key={c.id} className="st-group">
            <h2 className="st-group-title">{c.name}</h2>
            {items.map(({ p, h }) => (
              <article key={p.id} className="st-row">
                <div className="st-row-top">
                  <img className="st-thumb" src={p.image_url || '/logo.webp'} alt="" loading="lazy" />
                  <div className="st-info">
                    <div className="st-tags">
                      <span>{c.name}</span>
                      {p.badge && <em>{p.badge}</em>}
                    </div>
                    <strong>{p.name}</strong>
                    {localized(p, 'description', lang) && <p>{localized(p, 'description', lang)}</p>}
                  </div>
                  <div className="st-actions">
                    <StatusPill product={p} />
                    <Link className="st-buy" to={productPath(p, categories)}>{t('status.viewBuy')} <ArrowRight size={14} /></Link>
                  </div>
                </div>
                <div className="st-bars" role="img" aria-label={t('status.historyLabel')}>
                  {h.bars.map((b, i) => (
                    <span
                      key={i}
                      className={`st-bar st-${STATUS_TONE[b.status]}`}
                      title={`${b.date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · ${b.status === 'nodata' ? t('status.nodata') : t(`status.s.${b.status}`)}`}
                    />
                  ))}
                </div>
                <div className="st-bars-foot">
                  <span>{t('status.history30')}</span>
                  <span className={h.uptime >= 99 ? 'ok' : 'warn'}>{fmtUptime(h.uptime)} {t('status.uptime30')}</span>
                </div>
              </article>
            ))}
          </section>
        ))
      )}

      <div className="st-legend">
        {['undetected', 'testing', 'updating', 'detected'].map((s) => (
          <span key={s}><i className={`st-bar st-${STATUS_TONE[s]}`} /> {t(`status.s.${s}`)}</span>
        ))}
      </div>
    </div>
  );
};

export default StatusPage;
