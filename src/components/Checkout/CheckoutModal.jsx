import React, { useState } from 'react';
import { CreditCard, Wallet, Send, X, ArrowLeft, User, MessageSquare, Copy, Check, Shield } from 'lucide-react';
import './CheckoutModal.css';

const CheckoutModal = ({ isOpen, onClose, total, onComplete, t }) => {
    const [step, setStep] = useState(1); // 1: Info Form, 2: Method Selection, 3: Details
    const [method, setMethod] = useState(null);
    const [copied, setCopied] = useState(false);
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        contact: ''
    });

    if (!isOpen) return null;

    const handleInfoSubmit = (e) => {
        e.preventDefault();
        setStep(2);
    };

    const handleFinalize = () => {
        onComplete({
            ...customerInfo,
            payment_method: method
        });
    };

    const resetAndClose = () => {
        setStep(1);
        setMethod(null);
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
                        {step === 1 ? t('checkout.step1_title') : t('checkout.step2_title')}
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
                                {method === 'crypto' ? t('checkout.btc_address') : t('checkout.transfer_data')}
                            </p>
                            <div className="data-box">
                                {method === 'crypto' ? (
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
                            <button onClick={handleFinalize} className="action-button-large finalize">
                                {t('checkout.confirm')} <Send size={16} />
                            </button>

                            <button className="back-link-capsule" onClick={() => setStep(2)} style={{ alignSelf: 'center' }}>
                                {t('checkout.back_selection')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckoutModal;
