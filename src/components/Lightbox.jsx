import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT } from '../i18n';

/** Tam ekran görsel */
const Lightbox = ({ src, onClose }) => {
  const { t } = useT();
  useEffect(() => {
    if (!src) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);
  if (!src) return null;
  return createPortal(
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button className="lightbox-close" aria-label={t('modal.close')}><X size={20} /></button>
      <img src={src} alt="" onClick={(e) => e.stopPropagation()} />
    </div>,
    document.body,
  );
};

export default Lightbox;
