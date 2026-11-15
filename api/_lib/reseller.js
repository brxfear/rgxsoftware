// Bayi (reseller) sistemi: fiyat, limit ve key çıkarma mantığı (sunucu).
// resellers/{uid}: { email, display_name, status: active|suspended, balance_usd, discount_pct,
//                   daily_limit, monthly_limit (0 = sınırsız), usage: { day, day_count, month, month_count },
//                   total_keys, total_spent_usd, created_at }
// reseller_keys/{id}: { reseller_id, key, product_id, product_name, plan_id, plan_label, price_usd, note, created_at }
// reseller_tx/{id}:   { reseller_id, type: topup|purchase|adjust, amount_usd (+/-), balance_after, note, ref, at }
import { FieldValue } from 'firebase-admin/firestore';
import { getPlans, roundUsd } from './firebaseAdmin.js';
import { HttpError } from './adminAuth.js';

/** İstanbul saatine göre bugünün ve bu ayın anahtarı: '2026-11-14', '2026-11' */
export const periodKeys = (d = new Date()) => {
  const day = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  return { day, month: day.slice(0, 7) };
};

/** Bayinin bu plan için ödediği fiyat ($): plan.reseller_price_usd (yoksa satış fiyatı) − bayi indirimi */
export const resellerPrice = (plan, reseller) => {
  const base = Number(plan.reseller_price_usd) > 0 ? Number(plan.reseller_price_usd) : Number(plan.price_usd);
  const pct = Math.min(90, Math.max(0, Number(reseller?.discount_pct) || 0));
  return roundUsd(base * (1 - pct / 100));
};

/** Ürün bayilere açık mı: satıştaysa ya da "sadece bayilere" işaretliyse (bayi satışı kapatılmamışsa) */
export const resellerVisible = (p, r) => {
  if (p.test_only) return !!r?.is_test; // test ürünü sadece test bayilerine görünür
  return p.reseller_enabled !== false && (p.is_available !== false || p.reseller_only === true);
};

/** Günlük/aylık kullanım (dönem değiştiyse sıfırdan) */
export const currentUsage = (r, keys = periodKeys()) => {
  const u = r.usage || {};
  return {
    day: keys.day,
    month: keys.month,
    day_count: u.day === keys.day ? u.day_count || 0 : 0,
    month_count: u.month === keys.month ? u.month_count || 0 : 0,
  };
};

/** Bu istekle limit aşılıyor mu? Kalan hakları da döner. */
export const limitCheck = (r, qty, keys) => {
  const u = currentUsage(r, keys);
  const dayLeft = r.daily_limit > 0 ? r.daily_limit - u.day_count : Infinity;
  const monthLeft = r.monthly_limit > 0 ? r.monthly_limit - u.month_count : Infinity;
  return { usage: u, dayLeft, monthLeft, ok: qty <= dayLeft && qty <= monthLeft };
};

export const STATUS_MSG = {
  pending: 'Başvurun inceleniyor. Onaylanınca panelin açılacak.',
  rejected: 'Başvurun onaylanmadı. Bilgi için Discord’dan destek al.',
  suspended: 'Hesabın askıya alınmış. Destekle iletişime geç.',
};

/** role: 'reseller' (satış) | 'media' (sadece haftalık ücretsiz medya keyleri) | 'both' */
export const canSell = (r) => (r.role || 'reseller') !== 'media';
export const isMedia = (r) => (r.role === 'media' || r.role === 'both') && r.media?.enabled !== false;

export const requireReseller = async (db, uid) => {
  const snap = await db.collection('resellers').doc(uid).get();
  if (!snap.exists) throw new HttpError(403, 'Bayi hesabı değil.');
  if (snap.get('status') !== 'active') throw new HttpError(403, STATUS_MSG[snap.get('status')] || STATUS_MSG.suspended);
  return { ref: snap.ref, data: snap.data() };
};

/** Haftanın anahtarı (İstanbul, pazartesi başlar): '2026-11-09' */
export const weekKey = (d = new Date()) => {
  const day = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  const dt = new Date(`${day}T00:00:00Z`);
  const dow = (dt.getUTCDay() + 6) % 7; // pazartesi = 0
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
};

export const mediaUsage = (r, wk = weekKey()) => ({ week: wk, count: r.media_usage?.week === wk ? r.media_usage.count || 0 : 0 });

/**
 * Medya keyi: haftalık ücretsiz kota, sadece yöneticinin seçtiği ürün/plan(lar) (media.allowed: ['urunId:planId']).
 * Stoktan çekilir, bakiyeden düşmez.
 */
export const generateMediaKeys = async (db, uid, { productId, planId, quantity, note }) => {
  const qty = Math.max(1, Math.min(20, parseInt(quantity, 10) || 1));
  const resRef = db.collection('resellers').doc(uid);
  const prodRef = db.collection('products').doc(String(productId));
  const wk = weekKey();
  return db.runTransaction(async (tx) => {
    const [resSnap, prodSnap] = await Promise.all([tx.get(resRef), tx.get(prodRef)]);
    if (!resSnap.exists) throw new HttpError(403, 'Hesap bulunamadı.');
    const r = resSnap.data();
    if (r.status !== 'active') throw new HttpError(403, STATUS_MSG[r.status] || STATUS_MSG.suspended);
    if (!isMedia(r)) throw new HttpError(403, 'Medya programında değilsin.');
    const allowed = Array.isArray(r.media?.allowed) ? r.media.allowed : [];
    if (!allowed.includes(`${productId}:${planId}`)) throw new HttpError(403, 'Bu ürün/plan medya kotana dahil değil.');
    if (!prodSnap.exists) throw new HttpError(404, 'Ürün bulunamadı.');
    const product = prodSnap.data();
    const plan = getPlans(product).find((p) => String(p.id) === String(planId));
    if (!plan) throw new HttpError(404, 'Plan bulunamadı.');
    const u = mediaUsage(r, wk);
    const limit = Number(r.media?.weekly_limit) || 0;
    if (u.count + qty > limit) throw new HttpError(429, `Haftalık medya kotan doldu (bu hafta kalan: ${Math.max(0, limit - u.count)}).`);
    const stock = await tx.get(db.collection('license_keys').where('product_id', '==', prodSnap.id).where('plan_id', '==', String(plan.id)).where('status', '==', 'available').limit(qty));
    if (stock.size < qty) throw new HttpError(409, stock.size ? `Stokta sadece ${stock.size} key var.` : 'Bu plan için stokta key yok, ekibe yaz.');
    const now = FieldValue.serverTimestamp();
    const txRef = db.collection('reseller_tx').doc();
    const issued = [];
    for (const k of stock.docs) {
      const keyRef = db.collection('reseller_keys').doc();
      issued.push({ id: keyRef.id, key: k.get('key') });
      tx.update(k.ref, { status: 'used', reseller_id: uid, used_at: now, sold_price_usd: 0, media: true });
      tx.set(keyRef, { reseller_id: uid, key: k.get('key'), stock_id: k.id, product_id: prodSnap.id, product_name: product.name, plan_id: String(plan.id), plan_label: plan.label, price_usd: 0, media: true, note: String(note || '').slice(0, 120), tx_id: txRef.id, created_at: now });
    }
    tx.set(txRef, { reseller_id: uid, type: 'media', amount_usd: 0, balance_after: roundUsd(r.balance_usd || 0), note: `Medya: ${qty} × ${product.name} (${plan.label})`, ref: prodSnap.id, at: now });
    tx.update(resRef, { media_usage: { week: wk, count: u.count + qty }, total_keys: FieldValue.increment(qty), last_key_at: now });
    return { keys: issued, week_left: limit - u.count - qty };
  });
};

/**
 * Stoktan key çıkarır: tek transaction içinde stok, bakiye ve limit kontrolü; keyler "used" olur,
 * bayinin listesine eklenir, bakiye düşer, işlem kaydı yazılır.
 */
export const generateKeys = async (db, uid, { productId, planId, quantity, note, backorder = false }) => {
  const qty = Math.max(1, Math.min(50, parseInt(quantity, 10) || 1));
  const keysPeriod = periodKeys();
  const resRef = db.collection('resellers').doc(uid);
  const prodRef = db.collection('products').doc(String(productId));

  return db.runTransaction(async (tx) => {
    const [resSnap, prodSnap] = await Promise.all([tx.get(resRef), tx.get(prodRef)]);
    if (!resSnap.exists) throw new HttpError(403, 'Bayi hesabı değil.');
    const r = resSnap.data();
    if (r.status !== 'active') throw new HttpError(403, STATUS_MSG[r.status] || STATUS_MSG.suspended);
    if (!canSell(r)) throw new HttpError(403, 'Hesabın sadece medya keyleri için açık.');
    if (!prodSnap.exists || !resellerVisible(prodSnap.data(), r)) throw new HttpError(404, 'Ürün bayilere açık değil.');
    const product = prodSnap.data();
    const plan = getPlans(product).find((p) => String(p.id) === String(planId));
    if (!plan) throw new HttpError(404, 'Plan bulunamadı.');

    const lim = limitCheck(r, qty, keysPeriod);
    if (!lim.ok) {
      throw new HttpError(429, lim.dayLeft < qty ? `Günlük key limitine ulaştın (bugün kalan: ${Math.max(0, lim.dayLeft)}).` : `Aylık key limitine ulaştın (bu ay kalan: ${Math.max(0, lim.monthLeft)}).`);
    }

    const unit = resellerPrice(plan, r);
    const cost = roundUsd(unit * qty);
    const balance = roundUsd(r.balance_usd || 0);
    if (balance + 1e-9 < cost) throw new HttpError(402, `Bakiye yetersiz: gereken $${cost.toFixed(2)}, bakiyen $${balance.toFixed(2)}.`);

    const stock = await tx.get(
      db.collection('license_keys').where('product_id', '==', prodSnap.id).where('plan_id', '==', String(plan.id)).where('status', '==', 'available').limit(qty),
    );
    const after = roundUsd(balance - cost);
    const txRef = db.collection('reseller_tx').doc();
    const now = FieldValue.serverTimestamp();
    const usageAfter = { day: lim.usage.day, day_count: lim.usage.day_count + qty, month: lim.usage.month, month_count: lim.usage.month_count + qty };

    if (stock.size < qty) {
      if (!backorder) {
        throw Object.assign(new HttpError(409, stock.size ? `Stokta sadece ${stock.size} key var.` : 'Bu plan için stokta key yok.'), { backorderable: true });
      }
      // Stok yetmiyor: sipariş açılır, bakiye düşer; keyleri yönetici panelden teslim eder (iptal ederse iade olur)
      const orderRef = db.collection('reseller_orders').doc();
      tx.set(orderRef, {
        reseller_id: uid,
        reseller_name: r.display_name || '',
        product_id: prodSnap.id,
        product_name: product.name,
        plan_id: String(plan.id),
        plan_label: plan.label,
        quantity: qty,
        unit_price_usd: unit,
        cost_usd: cost,
        note: String(note || '').slice(0, 120),
        status: 'pending',
        tx_id: txRef.id,
        created_at: now,
      });
      tx.set(txRef, { reseller_id: uid, type: 'purchase', amount_usd: -cost, balance_after: after, note: `${qty} × ${product.name} (${plan.label}) — sipariş, teslim bekliyor`, ref: orderRef.id, at: now });
      tx.update(resRef, { balance_usd: after, usage: usageAfter, total_keys: FieldValue.increment(qty), total_spent_usd: FieldValue.increment(cost), last_key_at: now });
      return { pending: true, order_id: orderRef.id, keys: [], unit_price: unit, cost, balance: after };
    }
    const issued = [];
    for (const k of stock.docs) {
      const keyRef = db.collection('reseller_keys').doc();
      issued.push({ id: keyRef.id, key: k.get('key') });
      tx.update(k.ref, { status: 'used', reseller_id: uid, used_at: now, sold_price_usd: unit });
      tx.set(keyRef, {
        reseller_id: uid,
        key: k.get('key'),
        stock_id: k.id,
        product_id: prodSnap.id,
        product_name: product.name,
        plan_id: String(plan.id),
        plan_label: plan.label,
        price_usd: unit,
        note: String(note || '').slice(0, 120),
        tx_id: txRef.id,
        created_at: now,
      });
    }
    tx.set(txRef, {
      reseller_id: uid,
      type: 'purchase',
      amount_usd: -cost,
      balance_after: after,
      note: `${qty} × ${product.name} (${plan.label})`,
      ref: prodSnap.id,
      at: now,
    });
    tx.update(resRef, {
      balance_usd: after,
      usage: usageAfter,
      total_keys: FieldValue.increment(qty),
      total_spent_usd: FieldValue.increment(cost),
      last_key_at: now,
    });
    return { keys: issued, unit_price: unit, cost, balance: after };
  });
};

/** Bakiyeye ekleme/çıkarma (yönetici düzeltmesi ya da Shopier yüklemesi) — transaction içinde çağrılır */
export const applyBalance = (tx, resRef, current, { amount, type, note, ref }) => {
  const after = roundUsd((Number(current) || 0) + amount);
  tx.update(resRef, { balance_usd: after, ...(type === 'topup' ? { total_topup_usd: FieldValue.increment(amount) } : {}) });
  tx.set(resRef.firestore.collection('reseller_tx').doc(), {
    reseller_id: resRef.id,
    type,
    amount_usd: roundUsd(amount),
    balance_after: after,
    note: String(note || '').slice(0, 200),
    ref: ref || null,
    at: FieldValue.serverTimestamp(),
  });
  return after;
};
