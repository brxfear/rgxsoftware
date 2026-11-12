// Shopier API (api_pay4) yardımcıları.
// Shopier panel > Entegrasyonlar > Modül Yönetimi'nden alınan "API Kullanıcı" ve "API Şifre" kullanılır.
// Env: SHOPIER_API_KEY, SHOPIER_API_SECRET, SHOPIER_WEBSITE_INDEX (varsayılan 1), SHOPIER_CURRENCY (USD | TRY | EUR)
import process from 'node:process';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

export const SHOPIER_PAY_URL = 'https://www.shopier.com/ShowProduct/api_pay4.php';
const CURRENCY_CODES = { TRY: 0, TL: 0, USD: 1, EUR: 2 };

export const shopierConfig = () => {
  const key = process.env.SHOPIER_API_KEY;
  const secret = process.env.SHOPIER_API_SECRET;
  if (!key || !secret) throw new Error('SHOPIER_API_KEY / SHOPIER_API_SECRET tanımlı değil.');
  const currency = (process.env.SHOPIER_CURRENCY || 'USD').toUpperCase();
  if (!(currency in CURRENCY_CODES)) throw new Error('SHOPIER_CURRENCY USD, TRY veya EUR olmalı.');
  return {
    key,
    secret,
    websiteIndex: process.env.SHOPIER_WEBSITE_INDEX || '1',
    currency,
    currencyCode: CURRENCY_CODES[currency],
  };
};

const hmac = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64');

/** Shopier ödeme sayfasına POST edilecek imzalı form alanları. */
export const buildShopierFields = ({ cfg, orderId, total, productName, buyer, userId }) => {
  const random_nr = String(crypto.randomInt(100000, 999999));
  const total_order_value = Number(total).toFixed(2);
  const [first, ...rest] = String(buyer.name).trim().split(/\s+/);
  const surname = rest.join(' ') || first;
  const address = 'Dijital teslimat';

  const fields = {
    API_key: cfg.key,
    website_index: cfg.websiteIndex,
    platform_order_id: orderId,
    product_name: String(productName).slice(0, 250),
    product_type: '1', // dijital / indirilebilir ürün
    buyer_name: first.slice(0, 50),
    buyer_surname: surname.slice(0, 50),
    buyer_email: buyer.email,
    buyer_account_age: '0',
    buyer_id_nr: String(userId || '0').slice(0, 64),
    buyer_phone: buyer.phone,
    billing_address: address,
    billing_city: 'Istanbul',
    billing_country: 'Turkey',
    billing_postcode: '34000',
    shipping_address: address,
    shipping_city: 'Istanbul',
    shipping_country: 'Turkey',
    shipping_postcode: '34000',
    total_order_value,
    currency: String(cfg.currencyCode),
    platform: '0',
    is_in_frame: '0',
    current_language: '0',
    modul_version: '1.0.4',
    random_nr,
  };
  fields.signature = hmac(random_nr + orderId + total_order_value + cfg.currencyCode, cfg.secret);
  return fields;
};

/** Shopier geri dönüşündeki imzayı doğrular: base64(HMAC-SHA256(random_nr + platform_order_id, secret)). */
export const verifyShopierCallback = (body, secret) => {
  const { random_nr, platform_order_id, signature } = body || {};
  if (!random_nr || !platform_order_id || !signature) return false;
  const expected = Buffer.from(hmac(String(random_nr) + String(platform_order_id), secret));
  const got = Buffer.from(String(signature));
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
};
