// Aynı sekmede Shopier'e gidip dönen müşteri için: bekleyen ödemeyi otomatik kontrol eder.
import React, { useEffect, useState } from 'react';
import { X, Loader2, Check, AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n';
import { readPendingPayment, clearPendingPayment } from '../../lib/shopierWindow';
import { useCartStore } from '../../store/useCartStore';
import { triggerConfetti } from '../../utils/celebration';
import './CheckoutModal.css';

const PendingPaymentWatcher = () => {
  const { t } = useT();
  const [pending, setPending] = useState(() => readPendingPayment());
  const [state, setState] = useState('checking'); // checking | paid | failed
  const [open, setOpen] = useState(() => !!readPendingPayment());

  useEffect(() => {
    if (!pending || state !== 'checking') return;
    let alive = true;
    let timer;
    let tries = 0;
    const tick = async () => {
      tries++;
      try {
        const r = await fetch(`/api/order-status?id=${encodeURIComponent(pending.orderId)}&key=${pending.key}`, { cache: 'no-store' });
        const d = await r.json().catch(() => null);
        if (!alive) return;
        if (d?.status === 'paid' || d?.status === 'delivered') {
          clearPendingPayment();
          setState('paid');
          setOpen(true);
          triggerConfetti();
          await useCartStore.getState().clearCart();
          return;
        }
        if (d?.status === 'failed' || r.status === 404) {
          clearPendingPayment();
          setState('failed');
          return;
        }
      } catch {
        /* tekrar dene */
      }
      // ilk 2 dk sık, sonra seyrek kontrol
      if (alive) timer = setTimeout(tick, tries < 30 ? 4000 : 15000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pending, state]);

  if (!pending || !open) return null;

  const close = () => {
    setOpen(false);
    if (state !== 'checking') setPending(null);
  };

  return (
    <div className="co-overlay" onClick={close}>
      <div className="co-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="co-head">
          <span />
          <div className="co-steps"><span className="on">#{pending.orderId.slice(-8)}</span></div>
          <button className="co-icon" onClick={close} aria-label={t('modal.close')}><X size={17} /></button>
        </header>
        <div className="co-body">
          {state === 'checking' && (
            <div className="co-wait-card">
              <Loader2 size={26} className="co-spin" />
              <strong>{t('checkout.checking')}</strong>
              <span>{t('checkout.checkingNote')}</span>
            </div>
          )}
          {state === 'paid' && (
            <>
              <div className="co-success">
                <Check size={22} />
                <div>
                  <strong>{t('checkout.paidTitle')}</strong>
                  <span>{t('checkout.orderNo')}: <code>#{pending.orderId.slice(-8)}</code></span>
                </div>
              </div>
              <p className="co-note">{t('checkout.paidText')}</p>
              <a className="co-cta" href={`/?siparis=${encodeURIComponent(pending.orderId)}&k=${pending.key}`}>{t('delivery.viewOrder')}</a>
            </>
          )}
          {state === 'failed' && <p className="co-note"><AlertTriangle size={15} /> {t('checkout.expired')}</p>}
        </div>
      </div>
    </div>
  );
};

export default PendingPaymentWatcher;
