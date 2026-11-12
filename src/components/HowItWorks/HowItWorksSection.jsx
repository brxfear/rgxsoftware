import React from 'react';
import { CreditCard, Zap, ShieldCheck } from 'lucide-react';

const HowItWorksSection = () => {
  const steps = [
    {
      num: "01",
      title: "Planını Seç",
      desc: "İhtiyacına göre 1 Günlük, 7 Günlük, 30 Günlük veya Sınırsız lisans sürelerini karşılaştır ve sepete ekle."
    },
    {
      num: "02",
      title: "Güvenle Öde",
      desc: "Kredi kartı, banka kartı (3D Secure) veya Kripto yöntemleriyle komisyonsuz, güvenli ödemeni tamamla."
    },
    {
      num: "03",
      title: "Anında Teslim Al",
      desc: "Lisans anahtarın ve adım adım videolu kurulum kılavuzun siparişin ardından saniyeler içinde ekranında belirir."
    }
  ];

  return (
    <section id="how-it-works" className="section-how">
      <div className="container">
        <div className="section-header-center">
          <span className="section-tag">KOLAY VE OTOMATİK</span>
          <h2 className="section-title">Nasıl Çalışıyoruz?</h2>
          <p className="section-desc">Sen sadece oyuna odaklan, gerisini tam otomatik altyapımız halletsin.</p>
        </div>

        <div className="how-steps-grid">
          {steps.map((st, i) => (
            <div key={i} className="how-step-card glass-card">
              <div className="how-step-badge">{st.num}</div>
              <h3 className="how-step-title">{st.title}</h3>
              <p className="how-step-desc">{st.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
