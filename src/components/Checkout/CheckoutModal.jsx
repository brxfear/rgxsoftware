import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { X, ArrowLeft, ArrowRight, CreditCard, Landmark, Copy, Check, ShieldCheck, MessageCircle, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db } from '../../lib/firebase';
import { useMoney } from '../../lib/currency';
import { useT, planLabel } from '../../i18n';
import { useCartStore } from '../../store/useCartStore';
import { triggerConfetti } from '../../utils/celebration';
import './CheckoutModal.css';

const DISCORD_URL = 'https://discord.gg/rgxsoftware1';

const CopyRow = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="co-copy">
      <span className="co-copy-label">{label}</span>
      <div className="co-copy-row">
        <code>{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          aria-label={`${label} kopyala`}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
};

const CheckoutModal = ({ isOpen, onClose, totalUsd, items = [], user, onComplete }) => {
  const { t, lang } = useT();
  const { fmt } = useMoney();
  const [step, setStep] = useState('info'); // info → method → (iban-done | shopier → paid / expired)
  const [shopier, setShopier] = useState(null); // { url, orderId, key }
  const [info, setInfo] = useState({ name: '', email: '', phone: '' });
  const [method, setMethod] = useState('shopier');
  const [busy, setBusy] = useState(false);
  const [bank, setBank] = useState(null);
  const [ibanOrder, setIbanOrder] = useState(null);
  const [ibanAmount, setIbanAmount] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('info');
    setIbanOrder(null);
    setShopier(null);
    setInfo((i) => ({ ...i, name: i.name || user?.displayName || '', email: i.email || user?.email || '' }));
    getDoc(doc(db, 'settings', 'payment'))
      .then((s) => setBank(s.exists() ? s.data() : {}))
      .catch(() => setBank({}));
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  // Shopier ödemesini birkaç saniyede bir kontrol et
  useEffect(() => {
    if (!isOpen || step !== 'shopier' || !shopier) return;
    let alive = true;
    let timer;
    const tick = async () => {
      try {
        const r = await fetch(`/api/order-status?id=${encodeURIComponent(shopier.orderId)}&key=${shopier.key}`, { cache: 'no-store' });
        const d = await r.json().catch(() => null);
        if (!alive) return;
        if (d?.status === 'paid') {
          setStep('paid');
          triggerConfetti();
          await useCartStore.getState().clearCart();
          return;
        }
        if (d?.status === 'failed') {
          setStep('expired');
          return;
        }
      } catch {
        /* ağ hatası: tekrar dene */
      }
      if (alive) timer = setTimeout(tick, 4000);
    };
    timer = setTimeout(tick, 4000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [isOpen, step, shopier]);

  if (!isOpen) return null;

  const ibanEnabled = !!bank?.iban;
  const set = (k) => (e) => setInfo((i) => ({ ...i, [k]: e.target.value }));

  const submitInfo = (e) => {
    e.preventDefault();
    if (info.name.trim().split(/\s+/).length < 2) return toast.error(t('checkout.fullNameErr'));
    setStep('method');
  };

  const pay = async () => {
    setBusy(true);
    try {
      const result = await onComplete({ ...info, payment_method: method });
      if (result?.type === 'iban') {
        setIbanOrder(result.orderId);
        setIbanAmount(fmt(totalUsd));
        setStep('iban-done');
      } else if (result?.type === 'shopier') {
        setShopier({ url: result.url, orderId: result.orderId, key: result.key });
        setStep('shopier');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const close = () => !busy && onClose();

  return (
    <div className="co-overlay" onClick={close}>
      <div className={`co-modal ${step === 'shopier' ? 'co-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={t('checkout.stepPay')} onClick={(e) => e.stopPropagation()}>
        <header className="co-head">
          {step === 'method' ? (
            <button className="co-icon" onClick={() => setStep('info')} aria-label={t('checkout.back')}><ArrowLeft size={17} /></button>
          ) : <span />}
          <div className="co-steps">
            <span className={step === 'info' ? 'on' : 'done'}>{t('checkout.stepInfo')}</span>
            <span className={step === 'method' || step === 'shopier' ? 'on' : step === 'iban-done' || step === 'paid' ? 'done' : ''}>{t('checkout.stepPay')}</span>
          </div>
          <button className="co-icon" onClick={close} aria-label={t('modal.close')}><X size={17} /></button>
        </header>

        {step !== 'shopier' && step !== 'paid' && (
        <div className="co-summary">
          <div className="co-summary-items">
            {items.map((i) => (
              <div key={i.id}>
                <span>{i.name} <em>· {planLabel(i.durationLabel, lang)}{i.quantity > 1 ? ` × ${i.quantity}` : ''}</em></span>
                <span>{fmt(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="co-summary-total">
            <span>{t('checkout.total')}</span>
            <strong>{fmt(totalUsd)}</strong>
          </div>
        </div>
        )}

        {step === 'shopier' && shopier && (
          <div className="co-shopier">
            <div className="co-shopier-frame">
              <iframe src={shopier.url} title={t('checkout.shopierTitle')} allow="payment" />
            </div>
            <div className="co-shopier-bar">
              <span className="co-waiting"><Loader2 size={15} className="co-spin" /> {t('checkout.waiting')}</span>
              <a href={shopier.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> {t('checkout.openNewTab')}</a>
            </div>
          </div>
        )}

        {step === 'paid' && (
          <div className="co-body">
            <div className="co-success">
              <Check size={22} />
              <div>
                <strong>{t('checkout.paidTitle')}</strong>
                <span>{t('checkout.orderNo')}: <code>#{shopier?.orderId?.slice(-8)}</code></span>
              </div>
            </div>
            <p className="co-note">{t('checkout.paidText')}</p>
            <button className="co-cta" onClick={onClose}>{t('checkout.close')}</button>
          </div>
        )}

        {step === 'expired' && (
          <div className="co-body">
            <p className="co-note"><AlertTriangle size={15} /> {t('checkout.expired')}</p>
            <button className="co-cta" onClick={() => setStep('method')}>{t('checkout.back')}</button>
          </div>
        )}

        {step === 'info' && (
          <form className="co-body" onSubmit={submitInfo}>
            <label className="co-field">
              <span>{t('checkout.name')}</span>
              <input value={info.name} onChange={set('name')} autoComplete="name" placeholder={t('checkout.name')} required />
            </label>
            <label className="co-field">
              <span>{t('checkout.email')} <small>{t('checkout.emailHint')}</small></span>
              <input type="email" value={info.email} onChange={set('email')} autoComplete="email" placeholder="ornek@gmail.com" required />
            </label>
            <label className="co-field">
              <span>{t('checkout.phone')}</span>
              <input type="tel" value={info.phone} onChange={set('phone')} autoComplete="tel" placeholder={t('checkout.phonePh')} required />
            </label>
            <button className="co-cta" type="submit">{t('checkout.next')} <ArrowRight size={16} /></button>
          </form>
        )}

        {step === 'method' && (
          <div className="co-body">
            <div className="co-methods" role="radiogroup" aria-label={t('checkout.stepPay')}>
              <button role="radio" aria-checked={method === 'shopier'} className={`co-method ${method === 'shopier' ? 'on' : ''}`} onClick={() => setMethod('shopier')}>
                <CreditCard size={20} />
                <div>
                  <strong>{t('checkout.card')}</strong>
                  <span>{t('checkout.cardSub')}</span>
                </div>
              </button>
              <button
                role="radio"
                aria-checked={method === 'iban'}
                className={`co-method ${method === 'iban' ? 'on' : ''}`}
                onClick={() => ibanEnabled && setMethod('iban')}
                disabled={!ibanEnabled}
              >
                <Landmark size={20} />
                <div>
                  <strong>{t('checkout.bank')}</strong>
                  <span>{ibanEnabled ? t('checkout.bankSub') : t('checkout.bankOff')}</span>
                </div>
              </button>
            </div>

            {method === 'shopier' ? (
              <p className="co-note"><ShieldCheck size={15} /> {t('checkout.cardNote')}</p>
            ) : (
              <p className="co-note"><Landmark size={15} /> {t('checkout.bankNote')}</p>
            )}

            <button className="co-cta" onClick={pay} disabled={busy || !items.length}>
              {busy ? <><Loader2 size={16} className="co-spin" /> {t('checkout.processing')}</> : method === 'shopier' ? <>{t('checkout.goPay')} · {fmt(totalUsd)}</> : <>{t('checkout.createOrder')} · {fmt(totalUsd)}</>}
            </button>
          </div>
        )}

        {step === 'iban-done' && (
          <div className="co-body">
            <div className="co-success">
              <Check size={22} />
              <div>
                <strong>{t('checkout.created')}</strong>
                <span>{t('checkout.orderNo')}: <code>#{ibanOrder?.slice(-8).toUpperCase()}</code></span>
              </div>
            </div>
            <div className="co-bank">
              <CopyRow label={t('checkout.iban')} value={bank?.iban} />
              <CopyRow label={t('checkout.holder')} value={bank?.account_holder} />
              <CopyRow label={t('checkout.bankName')} value={bank?.bank_name} />
              <CopyRow label={t('checkout.reference')} value={`#${ibanOrder?.slice(-8).toUpperCase()}`} />
            </div>
            <p className="co-note">
              {(lang === 'tr' && bank?.iban_note) || t('checkout.bankDefault', { amount: ibanAmount ?? fmt(totalUsd) })}
            </p>
            <a className="co-cta" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} /> {t('checkout.ticket')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;
