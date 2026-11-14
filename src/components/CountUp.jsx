import React, { useEffect, useRef, useState } from 'react';

/** Görününce 0'dan hedefe sayan sayı */
const CountUp = ({ to, duration = 1200 }) => {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  const n = Number(to) || 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || !n) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = requestAnimationFrame(() => setVal(n));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - start) / duration);
        setVal(Math.round(n * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [n, duration]);

  return <span ref={ref}>{n ? val : '—'}</span>;
};

export default CountUp;
