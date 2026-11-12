import React from 'react';
import { MessageCircle, Users, Headphones, Sparkles } from 'lucide-react';

const DiscordBanner = () => {
  return (
    <section className="section-discord">
      <div className="container">
        <div className="discord-card glass-panel">
          <div className="discord-glow-effect"></div>
          
          <div className="discord-content">
            <div className="discord-tag">
              <Sparkles size={14} />
              <span>BÜYÜYEN TOPLULUK</span>
            </div>
            
            <h2 className="discord-title">
              Binlerce Oyuncunun Olduğu <span className="hero-accent">Discord Sunucumuza</span> Katıl
            </h2>
            
            <p className="discord-desc">
              Canlı hile durum bildirimleri, uzman ekipten 7/24 kurulum desteği, haftalık hediye çekilişleri ve doğrulanmış müşteri yorumları tek bir yerde.
            </p>

            <div className="discord-features">
              <div className="dc-feat-item">
                <Users size={16} className="text-cyan" />
                <span>+2.500 Aktif Üye</span>
              </div>
              <div className="dc-feat-item">
                <Headphones size={16} className="text-cyan" />
                <span>7/24 Anlık Destek</span>
              </div>
              <div className="dc-feat-item">
                <MessageCircle size={16} className="text-cyan" />
                <span>Ticket & Kurulum</span>
              </div>
            </div>

            <a 
              href="https://discord.gg/dQ5u8TRAxr" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-primary dc-join-btn"
            >
              <MessageCircle size={18} />
              <span>Discord Sunucusuna Katıl</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DiscordBanner;
