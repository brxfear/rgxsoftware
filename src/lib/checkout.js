// Ödeme penceresinin "tamamla" adımı: Shopier (kart) oturumu açar ya da havale siparişi oluşturur.
import { toast } from 'react-hot-toast';
import { createManualOrder } from './db';
import { roundUsd, loadUsdTry, usdToTry, currencyForLang } from './currency';
import { useCartStore } from '../store/useCartStore';
import { translate } from '../i18n';

export const completeCheckout = async ({ data, items, user, lang, fromCart }) => {
  const currency = currencyForLang(lang);

  // ---- Kart: Shopier (sunucu fiyatı hesaplar, sipariş için geçici Shopier ödeme sayfası açar)
  if (data.payment_method === 'shopier') {
    try {
      const idToken = user ? await user.getIdToken() : null;
      const res = await fetch('/api/shopier-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({
          items: items.map((i) => ({ product_id: i.product_id, plan_id: String(i.duration), quantity: i.quantity })),
          currency,
          lang,
          buyer: { name: data.name, email: data.email },
        }),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok || !out?.url) throw new Error(out?.error || translate('checkout.unreachable'));
      return { type: 'shopier', url: out.url, orderId: out.order_id, key: out.key };
    } catch (err) {
      toast.error(translate('checkout.payFailed') + ': ' + err.message);
      throw err;
    }
  }

  // ---- IBAN: elle onaylanan sipariş (TR'de ₺, EN'de $)
  let rate = null;
  if (currency === 'TRY') {
    rate = await loadUsdTry();
    if (!rate) {
      toast.error(translate('checkout.fxFailed'));
      throw new Error('fx');
    }
  }
  const toCur = (usd) => (rate ? usdToTry(usd, rate) : roundUsd(usd));
  const detailed = items.map((i) => ({
    product_id: i.product_id,
    name: i.name,
    plan_id: String(i.duration),
    durationLabel: i.durationLabel || '',
    quantity: i.quantity,
    price_usd: i.price,
    price: toCur(i.price),
    subtotal: toCur(i.price) * i.quantity,
  }));
  try {
    const ref = await createManualOrder({
      user_id: user?.uid || null,
      total_amount: roundUsd(detailed.reduce((s, i) => s + i.subtotal, 0)),
      total_usd: roundUsd(items.reduce((s, i) => s + i.price * i.quantity, 0)),
      ...(rate ? { fx_rate: rate } : {}),
      currency,
      items: detailed,
      payment_method: 'iban',
      customer_name: data.name,
      customer_phone: '',
      customer_email: data.email || user?.email || '',
    });
    if (fromCart) await useCartStore.getState().clearCart();
    return { type: 'iban', orderId: ref.id };
  } catch (err) {
    toast.error(translate('checkout.orderFailed') + ': ' + err.message);
    throw err;
  }
};
