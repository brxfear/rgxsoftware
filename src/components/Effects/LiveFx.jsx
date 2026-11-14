// Sitenin "canlılığı": kaydırınca beliren içerikler, fareyi takip eden ışık ve kartlarda hafif 3B eğim.
// DOM'a sınıf ekleyerek çalışır; sayfa değiştikçe yeni öğeleri kendisi bulur.
// "Hareketi azalt" açıksa hiçbir şey yapmaz; dokunmatik cihazlarda eğim kapalıdır.
import { useEffect } from 'react';

const REVEAL = [
  '.section-block', '.section-title', '.section-desc', '.page-head', '.crumbs',
  '.product-card', '.rpc', '.gs-card', '.vouch-card', '.st-row', '.st-summary', '.ann-card',
  '.ap-stat', '.ap-hero-card', '.payment-tile', '.about-feature', '.how-step', '.faq-item',
  '.cat-hero', '.pp-box', '.pp-left', '.hero-stats-bar', '.discord-card', '.marquee',
].join(',');

const GLOW = '.rpc, .gs-card, .product-card, .vouch-card, .st-row, .ann-card, .ap-stat, .payment-tile, .pp-box, .about-feature, .ap-panel, .st-summary';
const TILT = '.gs-card, .product-card, .rpc';

const LiveFx = () => {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const fine = window.matchMedia('(pointer: fine)').matches;
    document.documentElement.classList.add('fx-live');

    /* ---------- Kaydırınca belirme ---------- */
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('rv-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    const seen = new WeakSet();
    const scan = (root = document) => {
      root.querySelectorAll?.(REVEAL).forEach((el) => {
        if (seen.has(el) || el.classList.contains('rv-in')) return;
        if (el.closest('.rs, .ap-body, .adm-shell')) return; // panellerde anında göster
        seen.add(el);
        // Aynı kapsayıcıdaki kardeşler sırayla gelsin
        const siblings = el.parentElement ? [...el.parentElement.children].filter((c) => c.matches(REVEAL)) : [];
        const idx = Math.max(0, siblings.indexOf(el));
        el.style.setProperty('--rv-d', `${Math.min(idx, 8) * 70}ms`);
        // Zaten ekrandaysa (ilk açılış) da yumuşakça gelsin
        el.classList.add('rv');
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => n.nodeType === 1 && (n.matches?.(REVEAL) ? scan(n.parentElement || document) : scan(n)));
    });
    mo.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });

    /* ---------- Işık + eğim ---------- */
    let active = null;
    let raf = 0;
    let last = null;
    const apply = () => {
      raf = 0;
      if (!active || !last) return;
      const r = active.getBoundingClientRect();
      const x = last.clientX - r.left;
      const y = last.clientY - r.top;
      active.style.setProperty('--sx', `${x}px`);
      active.style.setProperty('--sy', `${y}px`);
      if (fine && active.matches(TILT)) {
        const rx = ((y / r.height) - 0.5) * -6;
        const ry = ((x / r.width) - 0.5) * 8;
        active.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
        active.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      }
    };
    const reset = (el) => {
      if (!el) return;
      el.classList.remove('fx-hot');
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    };
    const onMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest?.(GLOW) || null;
      if (el !== active) {
        reset(active);
        active = el;
        el?.classList.add('fx-hot');
      }
      last = e;
      if (active && !raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      reset(active);
      active = null;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.documentElement.classList.remove('fx-live');
    };
  }, []);
  return null;
};

export default LiveFx;
