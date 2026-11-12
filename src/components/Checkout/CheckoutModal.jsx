import React, { useState } from 'react';
import { CreditCard, Wallet, Send, X, ArrowLeft, User, MessageSquare, Copy, Check, Shield } from 'lucide-react';
import './CheckoutModal.css';

const CheckoutModal = ({ isOpen, onClose, total, onComplete, t }) => {
    const [step, setStep] = useState(1); // 1: Info Form, 2: Method Selection, 3: Details, 4: iFrame
    const [method, setMethod] = useState(null);
    const [copied, setCopied] = useState(false);
    const [iframeToken, setIframeToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        contact: ''
    });

    React.useEffect(() => {
        if (step === 4 && iframeToken) {
            const script = document.createElement('script');
            script.src = 'https://www.paytr.com/js/iframeResizer.min.js';
            script.async = true;
            script.onload = () => {
                if (window.iFrameResize) window.iFrameResize({}, '#paytriframe');
            };
            document.body.appendChild(script);

            return () => {
                document.body.removeChild(script);
            };
        }
    }, [step, iframeToken]);

    if (!isOpen) return null;

    const handleInfoSubmit = (e) => {
        e.preventDefault();
        setStep(2);
    };

    const handleFinalize = async () => {
        setLoading(true);
        try {
            const token = await onComplete({
                ...customerInfo,
                payment_method: method
            });
            if (token && token !== 'success') {
                setIframeToken(token);
                setStep(4);
            }
        } catch (e) {
            console.error('Payment Error:', e);
        }
        setLoading(false);
    };

    const resetAndClose = () => {
        setStep(1);
        setMethod(null);
        setIframeToken(null);
        setCustomerInfo({ name: '', contact: '' });
        onClose();
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="checkout-overlay" onClick={resetAndClose}>
            <div className="glass-panel checkout-box" onClick={e => e.stopPropagation()}>
                <div className="checkout-header">
                    <h2 className="cyber-font">
                        {step === 1 ? t('checkout.step1_title') : step === 4 ? 'GÜVENLİ ÖDEME' : t('checkout.step2_title')}
                    </h2>
                    <button onClick={resetAndClose} className="close-x"><X size={20} /></button>
                </div>

                {step === 1 && (
                    <form onSubmit={handleInfoSubmit} className="block-form">
                        <div className="input-block">
                            <label className="cyber-font">{t('checkout.name_label')}</label>
                            <div className="input-wrapper">
                                <User size={16} />
                                <input
                                    type="text"
                                    required
                                    placeholder={t('checkout.name_label')}
                                    value={customerInfo.name}
                                    onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="input-block">
                            <label className="cyber-font">{t('checkout.contact_label')}</label>
                            <div className="input-wrapper">
                                <MessageSquare size={16} />
                                <input
                                    type="text"
                                    required
                                    placeholder={t('checkout.contact_label')}
                                    value={customerInfo.contact}
                                    onChange={e => setCustomerInfo({ ...customerInfo, contact: e.target.value })}
                                />
                            </div>
                        </div>

                        <button type="submit" className="action-button-large">
                            {t('checkout.next_phase')} <ArrowLeft style={{ transform: 'rotate(180deg)' }} size={16} />
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <div className="selection-grid fade-in">
                        <button className="back-link-capsule" onClick={() => setStep(1)}>
                            <ArrowLeft size={12} /> {t('checkout.back')}
                        </button>
                        <p className="instruction-text">{t('checkout.select_vector')}</p>
                        <div className="methods-container">
                            <div className="method-card" onClick={() => { setMethod('paytr'); setStep(3); }}>
                                <CreditCard size={24} />
                                <span>Kredi / Banka Kartı</span>
                                <small>PayTR Güvencesiyle</small>
                            </div>
                            <div className="method-card" onClick={() => { setMethod('crypto'); setStep(3); }}>
                                <Wallet size={24} />
                                <span>{t('checkout.crypto')}</span>
                                <small>BTC / ETH / LTC</small>
                            </div>
                            <div className="method-card" onClick={() => { setMethod('fiat'); setStep(3); }}>
                                <CreditCard size={24} />
                                <span>{t('checkout.manual')}</span>
                                <small>IBAN / PAPARA</small>
                            </div>
                        </div>
                    </div>
                )}

                {step === 3 && method && (
                    <div className="transaction-details fade-in">
                        <div className="total-block">
                            <span>{t('checkout.total_due')}</span>
                            <h3 className="neon-text">₺{total.toFixed(2)}</h3>
                        </div>

                        <div className="data-card">
                            <p className="card-label cyber-font">
                                {method === 'paytr' ? 'KREDİ/BANKA KARTI İLE ÖDEME' : method === 'crypto' ? t('checkout.btc_address') : t('checkout.transfer_data')}
                            </p>
                            <div className="data-box">
                                {method === 'paytr' ? (
                                    <div className="iban-block">
                                        <p style={{ fontSize: '0.85rem', color: '#fff', textAlign: 'center', margin: '10px 0' }}>
                                            Onayla butonuna bastıktan sonra 256-bit SSL korumalı PayTR güvenli ödeme sayfasına yönlendirileceksiniz.
                                        </p>
                                    </div>
                                ) : method === 'crypto' ? (
                                    <div className="copy-field">
                                        <code>kullanım dışı...</code>
                                        <button onClick={() => copyToClipboard('TELEGRAM YADA WHATSAPPDAN ULAŞIN t.me/brxfear')}>
                                            {copied ? <Check size={16} color="#00ff88" /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="iban-block">
                                        <div className="copy-field" style={{ marginBottom: '10px' }}>
                                            <strong>IBAN:</strong>
                                            <code>TR12..90</code>
                                            <button onClick={() => copyToClipboard('TR 1234567890')}>
                                                {copied ? <Check size={16} color="#00ff88" /> : <Copy size={16} />}
                                            </button>
                                        </div>
                                        <div className="iban-info" style={{ fontSize: '0.8rem', color: '#fff', textAlign: 'left' }}>
                                            <p><strong>ALICI:</strong> "kullanım dışı"</p>
                                            <p><strong>PAPARA:</strong> "kullanım dışı"</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="discord-alert-block">
                            <Shield size={20} />
                            <p>{t('checkout.discord_alert')}</p>
                        </div>

                        <div className="modal-footer-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                            <button onClick={handleFinalize} className="action-button-large finalize" disabled={loading}>
                                {loading ? 'YÜKLENİYOR...' : t('checkout.confirm')} {!loading && <Send size={16} />}
                            </button>

                            <button className="back-link-capsule" onClick={() => setStep(2)} style={{ alignSelf: 'center' }}>
                                {t('checkout.back_selection')}
                            </button>
                        </div>
                    </div>
                )}
                {step === 4 && iframeToken && (
                    <div className="paytr-iframe-container fade-in" style={{ width: '100%', height: '600px', overflow: 'hidden', padding: '10px' }}>
                        <iframe
                            src={`https://www.paytr.com/odeme/guvenli/${iframeToken}`}
                            id="paytriframe"
                            frameBorder="0"
                            scrolling="no"
                            style={{ width: '100%', height: '100%' }}
                        ></iframe>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckoutModal;
