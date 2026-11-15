// Kampanya: üstte ince duyuru şeridi + ana sayfada büyük kampanya alanı (admin → Kampanya'dan ayarlanır).
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, ArrowRight, Timer } from 'lucide-react';
import { useShopStore, useDiscordUrl } from '../../store/useShopStore';
import { useT } from '../../i18n';
import './campaign.css';

const useCountdown = (endIso) => {
  const end = endIso ? new Date(endIso).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!end) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [end]);
  const ms = Math.max(0, end - now);
  return { ms, d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60, end };
};

const CopyCode = ({ code, big = false }) => {
  const { t } = useT();
  const [ok, setOk] = useState(false);
  return (
    <button
      className={big ? 'cp-copy-big' : 'cp-copy'}
      onClick={() => {
        navigator.clipboard?.writeText(code);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? t('campaign.copied') : t('campaign.copy')}
    </button>
  );
};

/** Navbar'ın üstündeki ince şerit */
export const CampaignBar = () => {
  const { t, lang } = useT();
  const c = useShopStore((s) => s.campaign);
  const cd = useCountdown(c?.ends_at);
  if (!c || c.show_bar === false || (cd.end && !cd.ms)) return null;
  return (
    <div className="cp-bar">
      <span className="cp-bar-badge">{(lang === 'en' && c.badge_en) || c.badge || 'KAMPANYA'}</span>
      <span>{t('campaign.barText', { n: c.percent })}</span>
      {c.code && <code>{c.code}</code>}
      {cd.end > 0 && <span className="cp-bar-time"><Timer size={12} /> {cd.d}g {cd.h}s {cd.m}d {cd.s}sn</span>}
    </div>
  );
};

/** Ana sayfanın en üstündeki büyük kampanya alanı */
export const CampaignHero = () => {
  const { t, lang } = useT();
  const c = useShopStore((s) => s.campaign);
  const discordUrl = useDiscordUrl();
  const cd = useCountdown(c?.ends_at);
  if (!c || c.show_hero === false || (cd.end && !cd.ms)) return null;
  const pick = (k) => (lang === 'en' && c[`${k}_en`]) || c[k] || '';
  const total = c.starts_at && c.ends_at ? new Date(c.ends_at) - new Date(c.starts_at) : 0;
  const progress = total > 0 ? Math.min(100, Math.max(0, 100 - (cd.ms / total) * 100)) : 0;

  return (
    <section className="cp-hero">
      <div className="cp-hero-beams" aria-hidden="true" />
      <div className="cp-hero-inner container">
        <div className="cp-hero-text">
          <span className="cp-chip"><i /> {pick('badge') || 'KAMPANYA'}{c.date_label ? <em>{c.date_label}</em> : null}</span>
          <h2 className="cp-title">
            <span className="cp-title-1">{pick('title1')}</span>
            <span className="cp-title-2">{pick('title2')}</span>
          </h2>
          <p className="cp-sub"><strong>-%{c.percent}</strong> {pick('subtitle') || t('campaign.sub')}</p>
          <div className="cp-row">
            {cd.end > 0 && (
              <div className="cp-count">
                {[[cd.d, t('campaign.days')], [cd.h, t('campaign.hours')], [cd.m, t('campaign.mins')], [cd.s, t('campaign.secs')]].map(([v, l], i) => (
                  <React.Fragment key={l}>
                    {i > 0 && <span className="cp-colon">:</span>}
                    <div className="cp-cell"><strong>{String(v).padStart(2, '0')}</strong><small>{l}</small></div>
                  </React.Fragment>
                ))}
                {total > 0 && <div className="cp-progress"><i style={{ width: `${progress}%` }} /></div>}
              </div>
            )}
            {c.code && (
              <div className="cp-code">
                <div><small>{t('campaign.useCode')}</small><strong>{c.code}</strong></div>
                <CopyCode code={c.code} />
              </div>
            )}
          </div>
          <div className="cp-ctas">
            <Link to="/products" className="btn-primary">{t('campaign.shop')} <ArrowRight size={16} /></Link>
            <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">{t('hero.discord')}</a>
          </div>
        </div>
        <div className="cp-hero-art" aria-hidden="true">
          <img src="/logo.webp" alt="" />
          <div className="cp-pedestal" />
        </div>
      </div>
    </section>
  );
};
