// Test bayileri + sadece test bayilerine görünen bir demo ürün ve test keyleri oluşturur.
// Çalıştırma: node scripts/seed-test-resellers.mjs        (FIREBASE_SERVICE_ACCOUNT .env'den okunur)
// Silmek için:  node scripts/seed-test-resellers.mjs --remove
// Giriş bilgileri test-resellers.local.txt dosyasına yazılır (git'e gitmez).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
const auth = getAuth();
const db = getFirestore();

const RESELLERS = [
  { email: 'bayi1@rgx.test', display_name: 'Test Bayi Alfa', balance: 50, discount_pct: 0, daily_limit: 10, monthly_limit: 100 },
  { email: 'bayi2@rgx.test', display_name: 'Test Bayi Beta', balance: 15, discount_pct: 10, daily_limit: 3, monthly_limit: 20 },
  { email: 'bayi3@rgx.test', display_name: 'Test Bayi Gama (askıda)', balance: 0, discount_pct: 0, daily_limit: 0, monthly_limit: 0, status: 'suspended' },
];
const PRODUCT_ID = 'test-reseller-demo';

if (process.argv.includes('--remove')) {
  for (const r of RESELLERS) {
    try {
      const u = await auth.getUserByEmail(r.email);
      for (const col of ['reseller_keys', 'reseller_tx', 'hwid_requests']) {
        const field = col === 'hwid_requests' ? 'uid' : 'reseller_id';
        const q = await db.collection(col).where(field, '==', u.uid).get();
        for (const d of q.docs) await d.ref.delete();
      }
      await db.collection('resellers').doc(u.uid).delete();
      await auth.deleteUser(u.uid);
      console.log('silindi', r.email);
    } catch (e) {
      console.log('yok', r.email, e.code || e.message);
    }
  }
  const keys = await db.collection('license_keys').where('product_id', '==', PRODUCT_ID).get();
  for (const d of keys.docs) await d.ref.delete();
  await db.collection('products').doc(PRODUCT_ID).delete();
  console.log('test ürünü ve keyleri silindi');
  process.exit(0);
}

const lines = ['RGX test bayi hesapları — giriş: siteye bu e-posta/şifre ile gir, sonra /reseller', ''];
for (const r of RESELLERS) {
  const password = 'Rgx-' + crypto.randomBytes(6).toString('base64url');
  let user;
  try {
    user = await auth.getUserByEmail(r.email);
    await auth.updateUser(user.uid, { password, displayName: r.display_name, emailVerified: true });
  } catch {
    user = await auth.createUser({ email: r.email, password, displayName: r.display_name, emailVerified: true });
  }
  await db.collection('resellers').doc(user.uid).set({
    email: r.email,
    display_name: r.display_name,
    status: r.status || 'active',
    balance_usd: r.balance,
    discount_pct: r.discount_pct,
    daily_limit: r.daily_limit,
    monthly_limit: r.monthly_limit,
    usage: {},
    total_keys: 0,
    total_spent_usd: 0,
    notes: 'Test hesabı (scripts/seed-test-resellers.mjs)',
    is_test: true,
    created_at: FieldValue.serverTimestamp(),
    created_by: 'seed',
  });
  await db.collection('reseller_tx').add({ reseller_id: user.uid, type: 'adjust', amount_usd: r.balance, balance_after: r.balance, note: 'Test açılış bakiyesi', ref: null, at: FieldValue.serverTimestamp() });
  lines.push(`${r.display_name}: ${r.email} / ${password}  (bakiye $${r.balance}, günlük ${r.daily_limit || '∞'}, aylık ${r.monthly_limit || '∞'}${r.status ? ', ASKIDA' : ''})`);
}

// Sadece test bayilerine görünen demo ürün + test keyleri
await db.collection('products').doc(PRODUCT_ID).set({
  name: 'TEST — Bayi Demo Ürünü',
  description: 'Sadece test bayilerine görünür. Silmek için: node scripts/seed-test-resellers.mjs --remove',
  category_id: '',
  plans: [
    { id: 'demo1d', label: '1 Gün', price_usd: 3, reseller_price_usd: 2 },
    { id: 'demo30d', label: '30 Gün', price_usd: 20, reseller_price_usd: 12 },
  ],
  price: 3,
  is_available: false,
  test_only: true,
  status: 'undetected',
  created_at: FieldValue.serverTimestamp(),
});
const existing = await db.collection('license_keys').where('product_id', '==', PRODUCT_ID).where('status', '==', 'available').get();
if (existing.size < 10) {
  const batch = db.batch();
  for (let i = 0; i < 12; i++) {
    const plan = i < 8 ? 'demo1d' : 'demo30d';
    batch.set(db.collection('license_keys').doc(), {
      product_id: PRODUCT_ID,
      plan_id: plan,
      key: `TEST-${plan.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      status: 'available',
      order_id: null,
      added_by: 'seed',
      created_at: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}
lines.push('', `Test ürünü: "TEST — Bayi Demo Ürünü" (1 Gün bayi $2, 30 Gün bayi $12) — 8 + 4 test keyi.`);
fs.writeFileSync('test-resellers.local.txt', lines.join('\n') + '\n');
console.log('Test bayileri hazır →', 'test-resellers.local.txt');
