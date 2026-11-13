// Misafir sipariş görüntüleme: /?siparis=RGX…&k=<gizli anahtar>
// Ödeme sonrası verilen link; giriş yapmadan siparişin durumunu ve teslim edilen key'leri gösterir.
import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useT, translate } from '../../i18n';
import { fmtMoney } from '../../lib/currency';
import OrderDelivery from './OrderDelivery';
import './AccountModal.css';

const OrderLookup = ({ orderId, viewKey, onClose }) => {
  const { t } = useT();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let alive = true;
    fetch(`/api/order-status?id=${encodeURIComponent(orderId)}&key=${encodeURIComponent(viewKey)}&detail=1`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!alive) return;
        if (!r.ok) setState({ loading: false, data: null, error: d?.error || 'Sipariş bulunamadı.' });
        else setState({ loading: false, data: d, error: null });
      })
      .catch(() => alive && setState({ loading: false, data: null, error: translate('checkout.unreachable') }));
    return () => {
      alive = false;
    };
  }, [orderId, viewKey]);

  const d = state.data;
  const statusText = d
    ? d.status === 'delivered'
      ? t('account.status.done')
      : d.status === 'paid'
        ? t('account.status.paid')
        : d.status === 'pending'
          ? t('account.status.pending')
          : t('account.status.failed')
    : '';

  return (
    <div className="acc-overlay" onClick={onClose}>
      <div className="acc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="acc-head">
          <div className="acc-identity">
            <div>
              <strong>{t('delivery.orderTitle')}</strong>
              <span>#{orderId.slice(-8)}</span>
            </div>
          </div>
          <button className="acc-icon-btn" onClick={onClose} aria-label={t('modal.close')}><X size={18} /></button>
        </header>
        <div className="acc-body">
          {state.loading && <p className="acc-muted"><Loader2 size={16} className="co-spin" /> {t('account.loading')}</p>}
          {state.error && <p className="acc-muted">{state.error}</p>}
          {d && (
            <article className="acc-order">
              <div className="acc-order-top">
                <code>#{orderId.slice(-8)}</code>
                <span className={`acc-pill acc-pill-${d.status === 'delivered' ? 'ok' : d.status === 'paid' ? 'info' : d.status === 'pending' ? 'muted' : 'bad'}`}>{statusText}</span>
              </div>
              {d.total != null && <div className="acc-order-foot"><span /><strong>{fmtMoney(d.total, d.currency)}</strong></div>}
              {d.delivery ? <OrderDelivery delivery={d.delivery} /> : <p className="acc-muted">{t('delivery.notYet')}</p>}
            </article>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderLookup;
