// Özel imleç: kırmızı nokta + yumuşakça takip eden halka.
// Buton/link üstünde halka büyür, tıklamada küçülür; yazı alanlarında normal imleç kalır.
// Sadece fareli (ince işaretçili) cihazlarda ve "hareketi azalt" kapalıyken açılır.
import React, { useEffect, useRef, useState } from 'react';

const INTERACTIVE = 'a, button, [role="button"], [role="radio"], [role="menuitem"], summary, label, select, .product-card, .game-card';
const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"]';

const CustomCursor = () => {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [enabled] = useState(
    () => window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add('has-custom-cursor');

    const dot = dotRef.current;
    const ring = ringRef.current;
    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ringPos = { ...pos };
    let raf = 0;
    let visible = false;

    const loop = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!visible) {
        visible = true;
        ringPos.x = pos.x;
        ringPos.y = pos.y;
        dot.classList.add('on');
        ring.classList.add('on');
      }
      const t = e.target;
      const overText = !!t.closest?.(TEXT);
      const overLink = !overText && !!t.closest?.(INTERACTIVE);
      ring.classList.toggle('hover', overLink);
      dot.classList.toggle('hide', overText);
      ring.classList.toggle('hide', overText);
    };
    const onDown = () => ring.classList.add('down');
    const onUp = () => ring.classList.remove('down');
    const onLeave = () => {
      visible = false;
      dot.classList.remove('on');
      ring.classList.remove('on');
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('has-custom-cursor');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      <div ref={ringRef} className="fx-cursor-ring" aria-hidden="true" />
      <div ref={dotRef} className="fx-cursor-dot" aria-hidden="true" />
    </>
  );
};

export default CustomCursor;
