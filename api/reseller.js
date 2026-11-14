// /api/reseller — bayi sistemi
// Bayi (giriş yapmış, resellers/{uid} kaydı olan):
//   GET  ?action=me                 → bayi bilgisi, limitler, bayi fiyatlı katalog ve stok
//   POST ?action=generate           → { product_id, plan_id, quantity, note } stoktan key çıkar (bakiyeden düşer)
//   POST ?action=topup              → { amount_usd } Shopier ile bakiye yükleme sayfası açar
//   GET  ?action=topup-status&id=…  → yüklemenin durumu (ödeme geldiyse bakiyeye eklenmiştir)
// Yönetici:
//   POST ?action=admin-save         → bayi oluştur/düzenle (e-posta ile; hesabı yoksa açılır ve şifre e-postası gider)
//   POST ?action=admin-balance      → { uid, amount_usd, note } bakiye ekle/çıkar
import process from 'node:process';
import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth, getPlans, roundUsd, getUsdTry, usdToTry, paymentLog } from './_lib/firebaseAdmin.js';
import { requireAdmin, sendError, HttpError } from './_lib/adminAuth.js';
import { createShopierProduct, checkPendingOrder } from './_lib/shopierPay.js';
import { requireReseller, generateKeys, resellerPrice, resellerVisible, currentUsage, applyBalance } from './_lib/reseller.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const lastCheck = new Map();

const body = (req) => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {});
const query = (req) => req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

const requireUser = async (req) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw new HttpError(401, 'Giriş gerekli.');
  try {
    return await adminAuth().verifyIdToken(h.slice(7));
  } catch {
    throw new HttpError(401, 'Oturum geçersiz.');
  }
};

const int = (v, max = 100000) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = query(req);
  const action = String(q.action || '');
  const db = adminDb();

  try {
    /* ================= Yönetici ================= */
    if (action === 'admin-save' && req.method === 'POST') {
      const admin = await requireAdmin(req);
      const b = body(req);
      const email = String(b.email || '').trim().toLowerCase();
      const data = {
        display_name: String(b.display_name || '').trim().slice(0, 40),
        status: b.status === 'suspended' ? 'suspended' : 'active',
        discount_pct: Math.min(90, Math.max(0, Number(b.discount_pct) || 0)),
        daily_limit: int(b.daily_limit),
        monthly_limit: int(b.monthly_limit),
        notes: String(b.notes || '').slice(0, 500),
        is_test: b.is_test === true,
        updated_at: FieldValue.serverTimestamp(),
      };
      if (!data.display_name) throw new HttpError(400, 'Bayi adı gerekli.');

      let uid = b.uid ? String(b.uid) : null;
      let created = false;
      if (!uid) {
        if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Geçerli bir e-posta gerekli.');
        const auth = adminAuth();
        try {
          uid = (await auth.getUserByEmail(email)).uid;
        } catch (err) {
          if (err.code !== 'auth/user-not-found') throw err;
          uid = (await auth.createUser({ email, emailVerified: true, password: crypto.randomBytes(24).toString('base64url'), displayName: data.display_name })).uid;
          created = true;
        }
        const exists = await db.collection('resellers').doc(uid).get();
        if (exists.exists) throw new HttpError(409, 'Bu e-posta zaten bayi.');
        await db.collection('resellers').doc(uid).set({
          ...data,
          email,
          balance_usd: roundUsd(Number(b.initial_balance) || 0),
          usage: {},
          total_keys: 0,
          total_spent_usd: 0,
          created_at: FieldValue.serverTimestamp(),
          created_by: admin.nickname || '?',
        });
        if (Number(b.initial_balance) > 0) {
          await db.collection('reseller_tx').add({ reseller_id: uid, type: 'adjust', amount_usd: roundUsd(Number(b.initial_balance)), balance_after: roundUsd(Number(b.initial_balance)), note: 'Açılış bakiyesi', ref: null, at: FieldValue.serverTimestamp() });
        }
        if (created || b.send_invite) {
          // Yeni hesaba "şifreni belirle" e-postası
          const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
          await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Firebase-Locale': 'tr' },
            body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
          }).catch(() => null);
        }
      } else {
        const ref = db.collection('resellers').doc(uid);
        if (!(await ref.get()).exists) throw new HttpError(404, 'Bayi bulunamadı.');
        await ref.update(data);
      }
      await db.collection('admin_logs').add({
        actor_uid: admin.uid,
        actor_nick: admin.nickname || '?',
        action: b.uid ? 'update' : 'create',
        target_type: 'reseller',
        target_id: uid,
        summary: `Bayi ${b.uid ? 'güncellendi' : 'eklendi'}: ${data.display_name}${data.is_test ? ' [TEST]' : ''} (indirim %${data.discount_pct}, günlük ${data.daily_limit || '∞'}, aylık ${data.monthly_limit || '∞'}, ${data.status === 'active' ? 'aktif' : 'askıda'})`,
        at: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ uid, created });
    }

    if (action === 'admin-balance' && req.method === 'POST') {
      const admin = await requireAdmin(req);
      const b = body(req);
      const amount = roundUsd(Number(b.amount_usd));
      if (!amount || Math.abs(amount) > 100000) throw new HttpError(400, 'Geçerli bir tutar gir.');
      const note = String(b.note || '').trim().slice(0, 200) || (amount > 0 ? 'Yönetici bakiye ekledi' : 'Yönetici bakiye düştü');
      const ref = db.collection('resellers').doc(String(b.uid));
      const after = await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists) throw new HttpError(404, 'Bayi bulunamadı.');
        if ((s.get('balance_usd') || 0) + amount < -0.001) throw new HttpError(400, 'Bakiye eksiye düşemez.');
        return applyBalance(tx, ref, s.get('balance_usd'), { amount, type: 'adjust', note: `${note} (${admin.nickname || '?'})` });
      });
      await db.collection('admin_logs').add({
        actor_uid: admin.uid,
        actor_nick: admin.nickname || '?',
        action: 'update',
        target_type: 'reseller',
        target_id: ref.id,
        summary: `Bayi bakiyesi ${amount > 0 ? '+' : ''}${amount.toFixed(2)}$ (${note}) → ${after.toFixed(2)}$`,
        at: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ balance: after });
    }

    /* ================= Bayi ================= */
    const user = await requireUser(req);

    // Herkes kendi bayiliğini açabilir (yönetici Ayarlar'dan kapatabilir). Bakiye 0 ile başlar;
    // key çıkarmak için önce bakiye yüklemek gerekir. Varsayılan limit/indirim settings/reseller'dan gelir.
    if (action === 'signup' && req.method === 'GET') {
      const s = (await db.collection('settings').doc('reseller').get()).data() || {};
      const exists = (await db.collection('resellers').doc(user.uid).get()).exists;
      return res.status(200).json({ open: s.signup_open !== false, exists, rules: s.rules || '' });
    }
    if (action === 'signup' && req.method === 'POST') {
      const s = (await db.collection('settings').doc('reseller').get()).data() || {};
      if (s.signup_open === false) throw new HttpError(403, 'Bayi başvuruları şu an kapalı.');
      const b = body(req);
      const name = String(b.display_name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      if (name.length < 2) throw new HttpError(400, 'Bayi adı en az 2 karakter olmalı.');
      if (!b.accept_rules) throw new HttpError(400, 'Bayi kurallarını kabul etmelisin.');
      const ref = db.collection('resellers').doc(user.uid);
      await db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) throw new HttpError(409, 'Zaten bayi hesabın var.');
        tx.set(ref, {
          email: user.email || '',
          display_name: name,
          status: 'active',
          balance_usd: 0,
          discount_pct: Math.min(90, Math.max(0, Number(s.default_discount_pct) || 0)),
          daily_limit: int(s.default_daily_limit ?? 20),
          monthly_limit: int(s.default_monthly_limit ?? 300),
          usage: {},
          total_keys: 0,
          total_spent_usd: 0,
          notes: '',
          self_signup: true,
          created_at: FieldValue.serverTimestamp(),
          created_by: 'self',
        });
      });
      await db.collection('admin_logs').add({
        actor_uid: user.uid,
        actor_nick: `bayi:${name}`,
        action: 'create',
        target_type: 'reseller',
        target_id: user.uid,
        summary: `Yeni bayi kaydı (kendi oluşturdu): ${name}`,
        at: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'me' && req.method === 'GET') {
      const { data: r } = await requireReseller(db, user.uid);
      const [prods, cats, setSnap] = await Promise.all([
        db.collection('products').get(),
        db.collection('categories').get(),
        db.collection('settings').doc('reseller').get(),
      ]);
      const catName = Object.fromEntries(cats.docs.map((c) => [c.id, c.get('name')]));
      // Stok sayımları paralel (sırayla yapınca panel yavaş açılıyordu)
      const catalog = await Promise.all(
        prods.docs
          .filter((d) => resellerVisible(d.data(), r))
          .map(async (d) => {
            const p = d.data();
            const plans = await Promise.all(
              getPlans(p).map(async (pl) => {
                const stock = (await db.collection('license_keys').where('product_id', '==', d.id).where('plan_id', '==', String(pl.id)).where('status', '==', 'available').count().get()).data().count;
                return { id: String(pl.id), label: pl.label, retail_usd: roundUsd(pl.price_usd), price_usd: resellerPrice(pl, r), stock };
              }),
            );
            return { id: d.id, name: p.name, category: catName[p.category_id] || '', image_url: p.image_url || '', status: p.status || 'undetected', loader_url: p.loader_url || '', plans };
          }),
      );
      const s = setSnap.exists ? setSnap.data() : {};
      return res.status(200).json({
        reseller: {
          uid: user.uid,
          display_name: r.display_name,
          email: r.email,
          status: r.status,
          balance_usd: roundUsd(r.balance_usd || 0),
          discount_pct: r.discount_pct || 0,
          daily_limit: r.daily_limit || 0,
          monthly_limit: r.monthly_limit || 0,
          usage: currentUsage(r),
          total_keys: r.total_keys || 0,
          total_spent_usd: roundUsd(r.total_spent_usd || 0),
          created_at: r.created_at?.toDate?.()?.toISOString() || null,
        },
        catalog,
        info: { rules: s.rules || '', guide: s.guide || '', min_topup_usd: Number(s.min_topup_usd) || 5 },
      });
    }

    if (action === 'generate' && req.method === 'POST') {
      const b = body(req);
      const r = await generateKeys(db, user.uid, { productId: b.product_id, planId: b.plan_id, quantity: b.quantity, note: b.note });
      return res.status(200).json(r);
    }

    if (action === 'topup' && req.method === 'POST') {
      const { data: r } = await requireReseller(db, user.uid);
      const set = (await db.collection('settings').doc('reseller').get()).data() || {};
      const min = Number(set.min_topup_usd) || 5;
      const usd = roundUsd(Number(body(req).amount_usd));
      if (!(usd >= min) || usd > 5000) throw new HttpError(400, `Yükleme tutarı en az $${min}, en fazla $5000 olmalı.`);
      const rate = await getUsdTry();
      const total = usdToTry(usd, rate);
      const orderId = 'RGX' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
      const sp = await createShopierProduct({
        orderId,
        title: `RGX Software — Bayi bakiye yükleme $${usd.toFixed(2)}`,
        description: `RGX Software bayi bakiyesi (${r.display_name}).`,
        total,
        currency: 'TRY',
      });
      await db.collection('orders').doc(orderId).set({
        merchant_oid: orderId,
        kind: 'reseller_topup',
        user_id: user.uid,
        total_amount: total,
        total_usd: usd,
        credit_usd: usd,
        currency: 'TRY',
        fx_rate: rate,
        items: [{ product_id: null, name: `Bayi bakiye yükleme ($${usd.toFixed(2)})`, plan_id: 'topup', durationLabel: '', quantity: 1, price_usd: usd, price: total, subtotal: total }],
        payment_method: 'shopier',
        status: 'pending_payment',
        shopier_product_id: sp.id,
        shopier_url: sp.url,
        customer_name: r.display_name,
        customer_email: r.email || user.email || '',
        created_at: FieldValue.serverTimestamp(),
      });
      await paymentLog(db, { order_id: orderId, event: 'created', amount: total, currency: 'TRY', payment_id: sp.id, message: `Bayi bakiye yükleme başlatıldı: ${r.display_name} $${usd}` });
      return res.status(200).json({ order_id: orderId, url: sp.url, total, currency: 'TRY', usd });
    }

    if (action === 'topup-status' && req.method === 'GET') {
      const id = String(q.id || '');
      if (!/^RGX[A-Z0-9]{6,20}$/.test(id)) throw new HttpError(400, 'Geçersiz istek.');
      const ref = db.collection('orders').doc(id);
      let snap = await ref.get();
      if (!snap.exists || snap.get('user_id') !== user.uid || snap.get('kind') !== 'reseller_topup') throw new HttpError(404, 'Yükleme bulunamadı.');
      if (snap.get('status') === 'pending_payment' && Date.now() - (lastCheck.get(id) || 0) > 8000) {
        lastCheck.set(id, Date.now());
        try {
          if (await checkPendingOrder(db, snap)) snap = await ref.get();
        } catch (err) {
          console.warn('topup check', err.message);
        }
      }
      const st = snap.get('status');
      const bal = (await db.collection('resellers').doc(user.uid).get()).get('balance_usd') || 0;
      return res.status(200).json({ status: st === 'Completed' ? 'paid' : st === 'pending_payment' ? 'pending' : st === 'payment_review' ? 'review' : 'failed', balance: roundUsd(bal) });
    }

    return res.status(404).json({ error: 'Bilinmeyen işlem.' });
  } catch (err) {
    if (!(err instanceof HttpError)) console.error('reseller', err);
    return sendError(res, err);
  }
}
