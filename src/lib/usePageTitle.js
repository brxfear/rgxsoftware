import { useEffect } from 'react';

const SITE = 'https://www.rgx.wtf';

const setMeta = (selector, attr, value) => {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
};

/** Sekme başlığı + arama motorları için canonical/og adresi: "Valorant | RGX Software" */
export const usePageTitle = (title) => {
  useEffect(() => {
    const full = title ? `${title} | RGX Software` : 'RGX Software | Private Yazılımlar';
    document.title = full;
    const url = SITE + (window.location.pathname.replace(/\/+$/, '') || '/');
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[property="og:title"]', 'content', full);
    setMeta('meta[name="twitter:title"]', 'content', full);
  }, [title]);
};
