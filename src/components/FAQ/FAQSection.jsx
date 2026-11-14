import React, { useState } from 'react';
import { useT } from '../../i18n';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { useDiscordUrl } from '../../store/useShopStore';


const FAQSection = () => {
  const { t } = useT();
  const discordUrl = useDiscordUrl();
  const faqs = t('faq.items');
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
              <span>{t('faq.badge')}</span>
            </div>
            <h2 className="faq-title">{t('faq.title')}</h2>
            <p className="faq-subtitle">{t('faq.subtitle')}</p>
            
            <div className="faq-support-box glass-panel">
              <h4>{t('faq.boxTitle')}</h4>
              <p>{t('faq.boxText')}</p>
              <a 
                href={discordUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-primary support-btn"
              >
                {t('faq.boxBtn')}
              </a>
            </div>
          </div>

          {/* Sağ Kolon: Accordion Listesi */}
          <div className="faq-accordion-list">
            {faqs.map((faq, index) => {
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

