import React from 'react';
import { MessageCircle, Users, Headphones } from 'lucide-react';

const DISCORD_URL = 'https://discord.gg/dQ5u8TRAxr';

const DiscordBanner = () => {
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
              Topluluğumuz büyüyor, <span className="hero-accent">Discord sunucumuza</span> katıl
            </h2>

            <p className="discord-desc">
              Anlık durum duyuruları, ekipten kurulum desteği, çekilişler ve gerçek müşteri yorumları — hepsi tek sunucuda.
            </p>

            <div className="discord-features">
              <div className="dc-feat-item">
                <Users size={16} className="text-red" />
                <span>Aktif topluluk</span>
              </div>
              <div className="dc-feat-item">
                <Headphones size={16} className="text-red" />
                <span>7/24 destek</span>
              </div>
              <div className="dc-feat-item">
                <MessageCircle size={16} className="text-red" />
                <span>Ticket & kurulum</span>
              </div>
            </div>

            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn-primary dc-join-btn">
              <MessageCircle size={18} />
              <span>Discord'a katıl</span>
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
                <span className="status-dot-green"></span> Sunucuya katıl
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DiscordBanner;
