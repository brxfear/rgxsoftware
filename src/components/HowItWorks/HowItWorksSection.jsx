import React from 'react';
import { useT } from '../../i18n';
import { CreditCard, Zap, ShieldCheck } from 'lucide-react';

const HowItWorksSection = () => {
  const { t } = useT();
  const steps = [1, 2, 3].map((n) => ({ num: `0${n}`, title: t(`how.s${n}t`), desc: t(`how.s${n}d`) }));

  return (
    <section id="how-it-works" className="section-how">
      <div className="container">
        <div className="section-header-center">
          <span className="section-tag">{t('how.tag')}</span>
          <h2 className="section-title">{t('how.title')}</h2>
          <p className="section-desc">{t('how.desc')}</p>
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

