// Duman izi: fare hareket ettikçe arkasında kırmızı duman/sis bırakır.
// Duman bulutları büyüyerek yukarı süzülür, kıvrılır ve söner. Fare yokken ekranda
// yavaşça gezinen tek bir kaynak hafif sis üretir. Sekme gizliyken durur.
import React, { useEffect, useRef } from 'react';

const makeSprite = (rgb, size = 160) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  // birkaç yumuşak daireyle düzensiz bir duman topağı
  for (let i = 0; i < 7; i++) {
    const cx = size / 2 + (Math.random() - 0.5) * size * 0.28;
    const cy = size / 2 + (Math.random() - 0.5) * size * 0.28;
    const r = size * (0.22 + Math.random() * 0.2);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${rgb},0.36)`);
    g.addColorStop(0.5, `rgba(${rgb},0.15)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
  }
  return c;
};

const SmokeTrail = () => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;

    const sprites = [makeSprite('200,24,34'), makeSprite('150,14,22'), makeSprite('255,70,70')];
    const MAX = 260;
    let parts = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = null;
    let lastMove = 0;
    const idle = { x: 0, y: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (x, y, vx, vy, strength = 1) => {
      if (parts.length >= MAX) parts.shift();
      const hot = Math.random() < 0.15;
      parts.push({
        x,
        y,
        vx: vx * 0.25 + (Math.random() - 0.5) * 0.6,
        vy: vy * 0.25 + (Math.random() - 0.5) * 0.6 - 0.35,
        r: 18 + Math.random() * 22,
        grow: 0.55 + Math.random() * 0.5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.02,
        life: 1,
        decay: 0.006 + Math.random() * 0.006,
        a: (hot ? 0.5 : 0.75) * strength,
        s: hot ? sprites[2] : sprites[Math.random() < 0.5 ? 0 : 1],
        seed: Math.random() * 1000,
      });
    };

    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      ctx.clearRect(0, 0, w, h);

      // fare bir süredir durmuşsa yavaşça gezinen kaynaktan hafif sis
      if (t - lastMove > 2500 && Math.random() < 0.18) {
        idle.x = w * (0.5 + Math.sin(t * 0.00012) * 0.38);
        idle.y = h * (0.62 + Math.cos(t * 0.00017) * 0.22);
        spawn(idle.x, idle.y, 0, -0.4, 0.45);
      }

      ctx.globalCompositeOperation = 'lighter';
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        // kıvrılan hareket
        const curl = Math.sin(p.seed + t * 0.0012 + p.y * 0.01) * 0.04;
        p.vx = p.vx * 0.975 + curl;
        p.vy = p.vy * 0.975 - 0.012;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.grow;
        p.rot += p.vr;
        p.life -= p.decay;

        const fadeIn = Math.min(1, (1 - p.life) * 8);
        ctx.globalAlpha = Math.max(0, p.a * p.life * fadeIn);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(p.s, -p.r, -p.r, p.r * 2, p.r * 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const onMove = (e) => {
      const x = e.clientX;
      const y = e.clientY;
      lastMove = performance.now();
      if (!last) {
        last = { x, y };
        return;
      }
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.min(6, Math.floor(dist / 14));
      for (let i = 1; i <= steps; i++) spawn(last.x + (dx * i) / steps, last.y + (dy * i) / steps, dx / steps, dy / steps);
      if (steps) last = { x, y };
    };
    const onLeave = () => {
      last = null;
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === 'visible') raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="fx-smoke" aria-hidden="true" />;
};

export default SmokeTrail;
