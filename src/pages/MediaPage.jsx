import React from 'react';
import { Link } from 'react-router-dom';
import { Video, KeyRound, BadgePercent, Sparkles, CheckCircle2, ArrowRight, Send } from 'lucide-react';
import { usePageTitle } from '../lib/usePageTitle';
import { useDiscordUrl } from '../store/useShopStore';
import { useT } from '../i18n';
import MediaApply from './MediaApply';

const TXT = {
  tr: {
    title: 'Medya programı', eyebrow: 'İÇERİK ÜRETİCİLERİ',
    h1: 'RGX ile içerik üret,', h2: 'haftalık ücretsiz key al',
    sub: 'YouTube, TikTok, Twitch ya da Kick’te Valorant içeriği üretiyorsan RGX medya programına başvur. Onaylanınca panelinden her hafta ücretsiz key çıkarırsın.',
    apply: 'Başvur', discord: 'Discord’dan sor',
    perksTitle: 'Neler kazanırsın',
    perks: [
      [KeyRound, 'Haftalık ücretsiz key', 'Sana atanan ürünlerden her hafta belirli sayıda key — kota her pazartesi yenilenir.'],
      [BadgePercent, 'Takipçilerine özel kod', 'Kanalına özel indirim kodu; izleyicilerin indirimli alır.'],
      [Sparkles, 'Erken erişim', 'Yeni ürün ve güncellemeleri herkesten önce dene.'],
      [Video, 'Sitede öne çıkma', 'Öne çıkan videoların sitede ve Discord’da paylaşılır.'],
    ],
    stepsTitle: 'Nasıl çalışır',
    steps: [
      ['Başvur', 'Kanal linkin ve Discord kullanıcı adınla formu doldur.'],
      ['Onay', 'Ekibimiz kanalını inceler, uygun bulursa onaylar.'],
      ['Kota', 'Sana hangi üründen haftada kaç key verileceği belirlenir.'],
      ['Üret', 'Panelinden keyini çıkar, videonu çek, linkini Discord’da paylaş.'],
    ],
    reqTitle: 'Şartlar',
    reqs: ['Aktif bir içerik kanalı (YouTube, TikTok, Twitch, Kick…)', 'Videoda RGX’in açıkça gösterilmesi ve rgx.wtf linki', 'Haftalık kotayı kullanıyorsan düzenli içerik paylaşımı', 'Keylerin satılmaması / devredilmemesi'],
    ctaTitle: 'Hazır mısın?', ctaSub: 'Başvurun birkaç gün içinde değerlendirilir; sonuç panelinde ve Discord’da bildirilir.',
  },
  en: {
    title: 'Media program', eyebrow: 'CONTENT CREATORS',
    h1: 'Create with RGX,', h2: 'get free keys every week',
    sub: 'If you make Valorant content on YouTube, TikTok, Twitch or Kick, apply to the RGX media program. Once approved you get free keys from your panel every week.',
    apply: 'Apply', discord: 'Ask on Discord',
    perksTitle: 'What you get',
    perks: [
      [KeyRound, 'Free weekly keys', 'A set number of keys every week from the products assigned to you — refreshed every Monday.'],
      [BadgePercent, 'Code for your audience', 'A personal discount code so your viewers save.'],
      [Sparkles, 'Early access', 'Try new products and updates before everyone else.'],
      [Video, 'Get featured', 'Top videos are shared on the site and Discord.'],
    ],
    stepsTitle: 'How it works',
    steps: [
      ['Apply', 'Fill in the form with your channel link and Discord username.'],
      ['Approval', 'Our team reviews your channel and approves it.'],
      ['Quota', 'We set which product and how many keys per week you get.'],
      ['Create', 'Grab your key in your panel, make the video, share it on Discord.'],
    ],
    reqTitle: 'Requirements',
    reqs: ['An active content channel (YouTube, TikTok, Twitch, Kick…)', 'RGX clearly shown in the video with the rgx.wtf link', 'Regular uploads while you use your weekly quota', 'Keys may not be sold or transferred'],
    ctaTitle: 'Ready?', ctaSub: 'Applications are reviewed within a few days; you’ll be notified in your panel and on Discord.',
  },
};

/** /media — medya (içerik üreticisi) programı */
const MediaPage = () => {
  const { lang } = useT();
  const s = TXT[lang] || TXT.tr;
  usePageTitle(s.title);
  const discordUrl = useDiscordUrl();

  return (
    <div className="page container md-page">
      <section className="md-hero">
        <span className="st-eyebrow">{s.eyebrow}</span>
        <h1 className="page-title page-title-xl">{s.h1} <span className="hero-accent">{s.h2}</span></h1>
        <p className="page-sub">{s.sub}</p>
        <div className="cp-ctas">
          <a className="btn-primary" href="#apply">{s.apply} <ArrowRight size={16} /></a>
          <a className="btn-secondary" href={discordUrl} target="_blank" rel="noopener noreferrer"><Send size={15} /> {s.discord}</a>
        </div>
      </section>

      <h2 className="md-h2">{s.perksTitle}</h2>
      <div className="md-perks">
        {s.perks.map(([Icon, title, text]) => (
          <div key={title} className="md-perk">
            <span className="md-perk-ico"><Icon size={20} /></span>
            <strong>{title}</strong>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="md-cols">
        <div>
          <h2 className="md-h2">{s.stepsTitle}</h2>
          <ol className="md-steps">
            {s.steps.map(([title, text], i) => (
              <li key={title}><span>{i + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="md-h2">{s.reqTitle}</h2>
          <ul className="md-reqs">
            {s.reqs.map((r) => <li key={r}><CheckCircle2 size={16} /> {r}</li>)}
          </ul>
        </div>
      </div>

      <MediaApply lang={lang} />
    </div>
  );
};

export default MediaPage;
