import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { X, ArrowLeft, ArrowRight, CreditCard, Landmark, Copy, Check, ShieldCheck, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db } from '../../lib/firebase';
import { fmtUsd } from '../../lib/currency';
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
  const [step, setStep] = useState('info'); // info → method → iban-done
  const [info, setInfo] = useState({ name: '', email: '', phone: '' });
  const [method, setMethod] = useState('shopier');
  const [busy, setBusy] = useState(false);
  const [bank, setBank] = useState(null);
  const [ibanOrder, setIbanOrder] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('info');
    setIbanOrder(null);
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

  if (!isOpen) return null;

  const ibanEnabled = !!bank?.iban;
  const set = (k) => (e) => setInfo((i) => ({ ...i, [k]: e.target.value }));

  const submitInfo = (e) => {
    e.preventDefault();
    if (info.name.trim().split(/\s+/).length < 2) return toast.error('Ad ve soyadını birlikte yaz.');
    setStep('method');
  };

  const pay = async () => {
    setBusy(true);
    try {
      const result = await onComplete({ ...info, payment_method: method });
      if (result?.type === 'iban') {
        setIbanOrder(result.orderId);
        setStep('iban-done');
      }
      // shopier: sayfa Shopier'a yönlendirilir
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const close = () => !busy && onClose();

  return (
    <div className="co-overlay" onClick={close}>
      <div className="co-modal" role="dialog" aria-modal="true" aria-label="Ödeme" onClick={(e) => e.stopPropagation()}>
        <header className="co-head">
          {step === 'method' ? (
            <button className="co-icon" onClick={() => setStep('info')} aria-label="Geri"><ArrowLeft size={17} /></button>
          ) : <span />}
          <div className="co-steps">
            <span className={step === 'info' ? 'on' : 'done'}>1. Bilgiler</span>
            <span className={step === 'method' ? 'on' : step === 'iban-done' ? 'done' : ''}>2. Ödeme</span>
          </div>
          <button className="co-icon" onClick={close} aria-label="Kapat"><X size={17} /></button>
        </header>

        <div className="co-summary">
          <div className="co-summary-items">
            {items.map((i) => (
              <div key={i.id}>
                <span>{i.name} <em>· {i.durationLabel}{i.quantity > 1 ? ` × ${i.quantity}` : ''}</em></span>
                <span>{fmtUsd(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="co-summary-total">
            <span>Toplam</span>
            <strong>{fmtUsd(totalUsd)}</strong>
          </div>
        </div>

        {step === 'info' && (
          <form className="co-body" onSubmit={submitInfo}>
            <label className="co-field">
              <span>Ad Soyad</span>
              <input value={info.name} onChange={set('name')} autoComplete="name" placeholder="Ad Soyad" required />
            </label>
            <label className="co-field">
              <span>E-posta <small>key ve fatura buraya gelir</small></span>
              <input type="email" value={info.email} onChange={set('email')} autoComplete="email" placeholder="ornek@gmail.com" required />
            </label>
            <label className="co-field">
              <span>Telefon</span>
              <input type="tel" value={info.phone} onChange={set('phone')} autoComplete="tel" placeholder="05xx xxx xx xx" required />
            </label>
            <button className="co-cta" type="submit">Devam et <ArrowRight size={16} /></button>
          </form>
        )}

        {step === 'method' && (
          <div className="co-body">
            <div className="co-methods" role="radiogroup" aria-label="Ödeme yöntemi">
              <button role="radio" aria-checked={method === 'shopier'} className={`co-method ${method === 'shopier' ? 'on' : ''}`} onClick={() => setMethod('shopier')}>
                <CreditCard size={20} />
                <div>
                  <strong>Kredi / Banka Kartı</strong>
                  <span>Shopier güvenli ödeme · 3D Secure · anında onay</span>
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
                  <strong>Havale / EFT (IBAN)</strong>
                  <span>{ibanEnabled ? 'Elle onay · dekontu Discord ticket ile ilet' : 'Şu an kullanılamıyor'}</span>
                </div>
              </button>
            </div>

            {method === 'shopier' ? (
              <p className="co-note"><ShieldCheck size={15} /> “Ödemeye geç” dediğinde Shopier'in güvenli ödeme sayfasına yönlendirileceksin. Ödeme onaylanınca siparişin otomatik işlenir.</p>
            ) : (
              <p className="co-note"><Landmark size={15} /> Siparişin oluşturulunca IBAN bilgileri ve sipariş numaran gösterilecek.</p>
            )}

            <button className="co-cta" onClick={pay} disabled={busy || !items.length}>
              {busy ? <><Loader2 size={16} className="co-spin" /> İşleniyor…</> : method === 'shopier' ? <>Ödemeye geç · {fmtUsd(totalUsd)}</> : <>Siparişi oluştur · {fmtUsd(totalUsd)}</>}
            </button>
          </div>
        )}

        {step === 'iban-done' && (
          <div className="co-body">
            <div className="co-success">
              <Check size={22} />
              <div>
                <strong>Siparişin oluşturuldu</strong>
                <span>Sipariş no: <code>#{ibanOrder?.slice(-8).toUpperCase()}</code></span>
              </div>
            </div>
            <div className="co-bank">
              <CopyRow label="IBAN" value={bank?.iban} />
              <CopyRow label="Alıcı" value={bank?.account_holder} />
              <CopyRow label="Banka" value={bank?.bank_name} />
              <CopyRow label="Açıklama" value={`#${ibanOrder?.slice(-8).toUpperCase()}`} />
            </div>
            <p className="co-note">
              {bank?.iban_note || `Toplam ${fmtUsd(totalUsd)} tutarındaki ödemeyi yaptıktan sonra dekontu sipariş numaranla birlikte Discord'da ticket açarak ilet.`}
            </p>
            <a className="co-cta" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} /> Discord'da ticket aç
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;
