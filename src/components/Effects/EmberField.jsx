// Kor / kıvılcım alanı: ekranın altından yükselen kırmızı korlar.
// - Fare yaklaşınca korlar itilir ve parlar; fareye yakın korlar ince ışık çizgileriyle bağlanır.
// - Tıklama noktasından kıvılcım patlaması.
// - Fareyi takip eden yumuşak kırmızı ışık.
// Performans: tek canvas, DPR sınırlı, sekme gizliyken durur; "hareketi azalt" açıksa sabit görüntü.
import React, { useEffect, useRef } from 'react';

const RED = [224, 38, 47];
const HOT = [255, 140, 90];

const EmberField = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
    let embers = [];
    let sparks = [];

    const rand = (a, b) => a + Math.random() * (b - a);

    const makeEmber = (fromBottom = false) => ({
      x: rand(0, w),
      y: fromBottom ? h + rand(0, 60) : rand(0, h),
      vx: rand(-0.15, 0.15),
      vy: rand(-0.55, -0.15),
      r: rand(0.6, 2.2),
      life: rand(0.5, 1),
      flicker: rand(0, Math.PI * 2),
      heat: Math.random() < 0.18 ? 1 : 0, // bazıları daha sıcak (turuncu)
    });

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.min(coarse ? 45 : 130, (w * h) / (coarse ? 14000 : 11000)));
      while (embers.length < target) embers.push(makeEmber());
      embers.length = target;
    };

    const burst = (x, y) => {
      const n = coarse ? 14 : 26;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + rand(-0.2, 0.2);
        const s = rand(1.2, 4.2);
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, life: 1, r: rand(0.8, 1.8) });
      }
    };

    const color = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    const drawStatic = () => {
      ctx.clearRect(0, 0, w, h);
      for (const e of embers) {
        ctx.fillStyle = color(e.heat ? HOT : RED, 0.35 * e.life);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (t) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      ctx.clearRect(0, 0, w, h);

      // fare yumuşak takip
      mouse.x += (mouse.tx - mouse.x) * 0.12;
      mouse.y += (mouse.ty - mouse.y) * 0.12;

      // fare ışığı
      if (mouse.active) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 260);
        g.addColorStop(0, 'rgba(224,38,47,0.10)');
        g.addColorStop(1, 'rgba(224,38,47,0)');
        ctx.fillStyle = g;
        ctx.fillRect(mouse.x - 260, mouse.y - 260, 520, 520);
      }

      const R = 150; // etki yarıçapı
      const near = [];
      ctx.globalCompositeOperation = 'lighter';

      for (const e of embers) {
        // fare itmesi
        const dx = e.x - mouse.x;
        const dy = e.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        let glow = 0;
        if (mouse.active && d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / R) * 0.9;
          e.vx += (dx / d) * f * 0.35;
          e.vy += (dy / d) * f * 0.35;
          glow = 1 - d / R;
          if (d < R * 0.9) near.push(e);
        }

        // hareket + sürtünme + hafif dalgalanma
        e.vx = e.vx * 0.96 + Math.sin(t * 0.0006 + e.flicker) * 0.004;
        e.vy = e.vy * 0.985 - 0.006;
        e.vy = Math.max(e.vy, -1.6);
        e.x += e.vx;
        e.y += e.vy;
        e.life -= 0.0009;

        if (e.y < -20 || e.x < -40 || e.x > w + 40 || e.life <= 0) Object.assign(e, makeEmber(true));

        const tw = 0.65 + Math.sin(t * 0.004 + e.flicker * 3) * 0.35;
        const a = Math.min(1, (0.25 + glow * 0.9) * tw * Math.min(1, e.life * 1.6));
        const r = e.r * (1 + glow * 1.4);
        const c = e.heat || glow > 0.55 ? HOT : RED;

        // hâle + çekirdek
        ctx.fillStyle = color(c, a * 0.18);
        ctx.beginPath();
        ctx.arc(e.x, e.y, r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color(c, a);
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // fareye yakın korlar arasında ışık çizgileri
      if (near.length > 1) {
        ctx.lineWidth = 0.7;
        for (let i = 0; i < near.length; i++) {
          for (let j = i + 1; j < near.length; j++) {
            const a = near[i];
            const b = near[j];
            const dd = Math.hypot(a.x - b.x, a.y - b.y);
            if (dd < 95) {
              ctx.strokeStyle = color(RED, (1 - dd / 95) * 0.35);
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }

      // kıvılcımlar
      sparks = sparks.filter((s) => s.life > 0);
      for (const s of sparks) {
        s.vx *= 0.94;
        s.vy = s.vy * 0.94 + 0.06;
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.022;
        ctx.strokeStyle = color(HOT, Math.max(0, s.life));
        ctx.lineWidth = s.r;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 3, s.y - s.vy * 3);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
    };

    const onMove = (e) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
      if (!mouse.active) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      }
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.tx = mouse.ty = -9999;
    };
    const onDown = (e) => {
      if (reduce) return;
      if (e.target.closest?.('input, textarea, select')) return;
      burst(e.clientX, e.clientY);
    };
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible';
      if (visible && !running && !reduce) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else if (!visible) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    if (reduce) {
      drawStatic();
    } else {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });
      document.addEventListener('pointerleave', onLeave);
      document.addEventListener('visibilitychange', onVisibility);
      raf = requestAnimationFrame(frame);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="fx-embers" aria-hidden="true" />;
};

export default EmberField;
