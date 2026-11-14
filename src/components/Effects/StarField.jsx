// Yıldızlı arka plan: yavaşça parlayıp sönen yıldızlar, kaydırınca hafif derinlik, ara sıra kayan yıldız.
// Tek canvas; sekme gizliyken durur; "hareketi azalt" açıksa sabit çizilir.
import React, { useEffect, useRef } from 'react';

const StarField = () => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let stars = [];
    let shooting = null;
    let nextShoot = performance.now() + 3000;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(220, (w * h) / 7000));
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: 0.2 + Math.random() * 0.8, // derinlik (kaydırma hızını etkiler)
        r: Math.random() < 0.08 ? 1.4 + Math.random() * 0.8 : 0.4 + Math.random() * 0.9,
        tw: Math.random() * Math.PI * 2,
        sp: 0.4 + Math.random() * 1.2,
        red: Math.random() < 0.16,
      }));
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      const scroll = window.scrollY;
      for (const s of stars) {
        const y = (((s.y - scroll * s.z * 0.12) % h) + h) % h;
        const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.tw));
        ctx.globalAlpha = a * (0.35 + s.z * 0.65);
        ctx.fillStyle = s.red ? '#ff6a70' : '#f2f2f5';
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.3) {
          // parlak yıldızlara artı biçimli ışıltı
          ctx.globalAlpha *= 0.35;
          ctx.fillRect(s.x - s.r * 3, y - 0.3, s.r * 6, 0.6);
          ctx.fillRect(s.x - 0.3, y - s.r * 3, 0.6, s.r * 6);
        }
      }
      ctx.globalAlpha = 1;

      if (!reduce) {
        if (!shooting && t > nextShoot) {
          const fromLeft = Math.random() < 0.5;
          shooting = { x: fromLeft ? Math.random() * w * 0.5 : w * (0.5 + Math.random() * 0.5), y: Math.random() * h * 0.4, vx: (fromLeft ? 1 : -1) * (9 + Math.random() * 5), vy: 3 + Math.random() * 2, life: 1 };
          nextShoot = t + 5000 + Math.random() * 9000;
        }
        if (shooting) {
          const s = shooting;
          const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12);
          g.addColorStop(0, `rgba(255,235,235,${0.9 * s.life})`);
          g.addColorStop(1, 'rgba(255,90,96,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.vx * 12, s.y - s.vy * 12);
          ctx.stroke();
          s.x += s.vx;
          s.y += s.vy;
          s.life -= 0.016;
          if (s.life <= 0 || s.x < -200 || s.x > w + 200 || s.y > h + 100) shooting = null;
        }
      }
    };

    const loop = (t) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === 'visible' && !reduce) raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);
    if (reduce) draw(0);
    else {
      raf = requestAnimationFrame(loop);
      document.addEventListener('visibilitychange', onVis);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className="fx-stars" aria-hidden="true" />;
};

export default StarField;
