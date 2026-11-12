import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

const defaultFaqs = [
  {
    q: "Hangi oyunlar için yazılım satın alabilirim?",
    a: "Valorant, CS2, Rust, Apex Legends, Fortnite ve daha pek çok popüler oyun için ESP, Aimbot, Wallhack ve HWID Spoofer çözümleri sunuyoruz."
  },
  {
    q: "Satın aldıktan sonra teslimat nasıl ve ne kadar sürede yapılır?",
    a: "Teslimat tamamen otomatiktir. Ödemeniz onaylandıktan sonra lisans anahtarınız ve detaylı kurulum kılavuzunuz anında e-postanıza gönderilir ve hesabınızda aktifleşir."
  },
  {
    q: "Hangi ödeme yöntemlerini kabul ediyorsunuz?",
    a: "Kredi kartı, banka kartı (PayTR güvencesiyle 3D Secure), Havale/EFT ve popüler kripto para birimleri (USDT, BTC, ETH) ile güvenle ödeme yapabilirsiniz."
  },
  {
    q: "Yazılımlar tespit ediliyor mu (Undetected)?",
    a: "Tüm yazılımlarımız çekirdek (Kernel/Hypervisor) düzeyinde geliştirilir ve sürekli güncellenir. Canlı durum panelimizden her ürünün güncel durumunu anlık takip edebilirsiniz."
  },
  {
    q: "Kurulumda zorlanır mıyım, destek veriyor musunuz?",
    a: "Kurulum 1-2 dakika sürer ve videolu rehber mevcuttur. Herhangi bir sorunuzda 7/24 Discord destek ekibimiz ve ticket sistemimiz üzerinden birebir yardımcı olmaktadır."
  }
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (idx) => {
    setOpenIndex(openIndex === idx ? -1 : idx);
  };

  return (
    <section id="faq" className="section-faq">
      <div className="container">
        <div className="faq-grid">
          {/* Sol Kolon: Başlık & Destek */}
          <div className="faq-intro">
            <div className="faq-badge">
              <HelpCircle size={15} />
              <span>YARDIM MERKEZİ</span>
            </div>
            <h2 className="faq-title">Sıkça Sorulan Sorular</h2>
            <p className="faq-subtitle">
              Teslimat, ödeme yöntemleri, uyumluluk ve güvenlikle ilgili en merak edilen soruların net cevapları.
            </p>
            
            <div className="faq-support-box glass-panel">
              <h4>Aklında başka bir soru mu var?</h4>
              <p>Destek ekibimiz Discord üzerinde 7/24 Türkçe ve anlık yanıt veriyor.</p>
              <a 
                href="https://discord.gg/dQ5u8TRAxr" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-primary support-btn"
              >
                Discord Destek Al
              </a>
            </div>
          </div>

          {/* Sağ Kolon: Accordion Listesi */}
          <div className="faq-accordion-list">
            {defaultFaqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div 
                  key={index} 
                  className={`faq-item glass-card ${isOpen ? 'is-open' : ''}`}
                  onClick={() => toggle(index)}
                >
                  <button className="faq-question">
                    <span>{faq.q}</span>
                    <ChevronDown size={18} className={`faq-arrow ${isOpen ? 'rotate' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="faq-answer">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
