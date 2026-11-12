import React from 'react';
import { useT } from '../../i18n';
import { MessageCircle, Users, Headphones } from 'lucide-react';

const DISCORD_URL = 'https://discord.gg/rgxsoftware1';

const DiscordBanner = () => {
  const { t } = useT();
  return (
    <section className="section-discord">
      <div className="container">
        <div className="discord-card glass-panel">
          <div className="discord-glow-effect"></div>

          <div className="discord-content">
            <div className="discord-tag">
              <MessageCircle size={14} />
              <span>DISCORD</span>
            </div>

            <h2 className="discord-title">
              {t('discord.title1')} <span className="hero-accent">{t('discord.title2')}</span> {t('discord.title3')}
            </h2>

            <p className="discord-desc">
              {t('discord.desc')}
            </p>

            <div className="discord-features">
              <div className="dc-feat-item">
                <Users size={16} className="text-red" />
                <span>{t('discord.f1')}</span>
              </div>
              <div className="dc-feat-item">
                <Headphones size={16} className="text-red" />
                <span>{t('discord.f2')}</span>
              </div>
              <div className="dc-feat-item">
                <MessageCircle size={16} className="text-red" />
                <span>{t('discord.f3')}</span>
              </div>
            </div>

            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn-primary dc-join-btn">
              <MessageCircle size={18} />
              <span>{t('discord.join')}</span>
            </a>
          </div>

          <div className="discord-visual">
            <div className="discord-visual-frame">
              <video
                src="/media/logo-anim.mp4"
                poster="/media/logo-anim-poster.webp"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="RGX Software animasyonlu logo"
              />
            </div>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="discord-widget">
              <span className="discord-widget-name">RGX SOFTWARE</span>
              <span className="discord-widget-status">
                <span className="status-dot-green"></span> {t('discord.widget')}
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DiscordBanner;
