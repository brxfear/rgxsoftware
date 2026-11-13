// Sade imleç: küçük kırmızı nokta; tıklanabilir öğelerin üstünde hafifçe büyür.
// Yazı alanlarında normal imleç kalır. Sadece fareli cihazlarda açılır.
import React, { useEffect, useRef, useState } from 'react';

const INTERACTIVE = 'a, button, [role="button"], [role="radio"], [role="menuitem"], summary, label, select, .product-card, .game-card';
const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"]';

const CursorDot = () => {
  const ref = useRef(null);
  const [enabled] = useState(() => window.matchMedia('(pointer: fine)').matches);

  useEffect(() => {
    if (!enabled) return undefined;
    const dot = ref.current;
    const root = document.documentElement;
    root.classList.add('has-cursor-dot');

    const onMove = (e) => {
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      dot.classList.add('on');
      const t = e.target;
      const overText = !!t.closest?.(TEXT);
      dot.classList.toggle('hide', overText);
      dot.classList.toggle('hover', !overText && !!t.closest?.(INTERACTIVE));
    };
    const onDown = () => dot.classList.add('down');
    const onUp = () => dot.classList.remove('down');
    const onLeave = () => dot.classList.remove('on');

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      root.classList.remove('has-cursor-dot');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div ref={ref} className="fx-dot" aria-hidden="true" />;
};

export default CursorDot;
