// Firestore kural testleri — emulator'de çalışır, canlı projeye dokunmaz.
// Çalıştır: npm run test:rules
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, writeBatch, serverTimestamp } from 'firebase/firestore';

const sha = (e) => crypto.createHash('sha256').update(e.toLowerCase()).digest('hex');
const ADMIN = { uid: 'admin1', email: 'boss@example.com' };
const ADMIN2 = { uid: 'admin2', email: 'second@example.com' };

const env = await initializeTestEnvironment({
  projectId: 'rgx-rules-test',
  firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: Number((process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':')[1]) },
});

const google = (u) => env.authenticatedContext(u.uid, { email: u.email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();
const password = (u) => env.authenticatedContext(u.uid, { email: u.email, email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const seed = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', sha(ADMIN.email)), { nickname: 'Kurucu', added_by_nick: 'kurulum', created_at: new Date() });
    await setDoc(doc(db, 'products', 'p1'), { name: 'Ürün', price_1day: 10, created_at: new Date() });
    await setDoc(doc(db, 'categories', 'c1'), { name: 'Kat', slug: 'kat' });
    await setDoc(doc(db, 'orders', 'o1'), { user_id: 'cust', status: 'Waiting for Confirmation', total_amount: 10, items: [{ name: 'x' }] });
  });
};

// Uygulamadaki loggedWrite ile aynı mantık
const logged = async (db, me, nick, { mode, col, id, data, current, action = 'update', type = 'product' }) => {
  const b = writeBatch(db);
  const entry = (tid, act) => ({ actor_uid: me.uid, actor_nick: nick, action: act, target_type: type, target_id: tid, summary: 'test', at: serverTimestamp() });
  if (mode === 'delete') {
    b.set(doc(db, 'admin_logs', 'del_' + (current?.last_log_id || id)), entry(id, 'delete'));
    b.delete(doc(db, col, id));
  } else {
    const logRef = doc(collection(db, 'admin_logs'));
    const ref = id ? doc(db, col, id) : doc(collection(db, col));
    b.set(logRef, entry(ref.id, mode === 'create' ? 'create' : action));
    if (mode === 'update') b.update(ref, { ...data, last_log_id: logRef.id });
    else b.set(ref, { ...data, last_log_id: logRef.id });
  }
  return b.commit();
};

const results = [];
const test = async (name, fn) => {
  await seed();
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name + ' — ' + e.message.split('\n')[0]]);
  }
};

// --- Herkese açık okuma
await test('misafir ürün ve kategori okuyabilir', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'products', 'p1')));
  await assertSucceeds(getDoc(doc(anon(), 'categories', 'c1')));
});

// --- Admin yetkisi
await test('admin (Google) logla ürün güncelleyebilir', async () => {
  await assertSucceeds(logged(google(ADMIN), ADMIN, 'Kurucu', { mode: 'update', col: 'products', id: 'p1', data: { name: 'Yeni' } }));
});
await test('admin LOGSUZ ürün güncelleyemez', async () => {
  await assertFails(updateDoc(doc(google(ADMIN), 'products', 'p1'), { name: 'X' }));
});
await test('admin LOGSUZ ürün silemez', async () => {
  await assertFails(deleteDoc(doc(google(ADMIN), 'products', 'p1')));
});
await test('admin logla ürün silebilir', async () => {
  await assertSucceeds(logged(google(ADMIN), ADMIN, 'Kurucu', { mode: 'delete', col: 'products', id: 'p1', current: {} }));
});
await test('admin logla ürün ekleyebilir', async () => {
  await assertSucceeds(logged(google(ADMIN), ADMIN, 'Kurucu', { mode: 'create', col: 'products', data: { name: 'N' } }));
});
await test('log takma adı sahte olamaz', async () => {
  await assertFails(logged(google(ADMIN), ADMIN, 'Başkası', { mode: 'update', col: 'products', id: 'p1', data: { name: 'Y' } }));
});
await test('aynı e-posta ama şifreyle girişte admin değil', async () => {
  await assertFails(logged(password(ADMIN), ADMIN, 'Kurucu', { mode: 'update', col: 'products', id: 'p1', data: { name: 'Y' } }));
});
await test('listede olmayan Google hesabı admin değil', async () => {
  const outsider = { uid: 'x', email: 'random@gmail.com' };
  await assertFails(logged(google(outsider), outsider, 'Kurucu', { mode: 'update', col: 'products', id: 'p1', data: { name: 'Y' } }));
  await assertFails(getDocs(collection(google(outsider), 'orders')));
});
await test('admin sipariş durumunu logla değiştirebilir', async () => {
  await assertSucceeds(logged(google(ADMIN), ADMIN, 'Kurucu', { mode: 'update', col: 'orders', id: 'o1', data: { status: 'Completed' }, action: 'status', type: 'order' }));
});

// --- Yönetici ekleme / çıkarma
await test('admin başka yönetici ekleyebilir (hash + takma ad)', async () => {
  await assertSucceeds(logged(google(ADMIN), ADMIN, 'Kurucu', {
    mode: 'set', col: 'admins', id: sha(ADMIN2.email), type: 'admin',
    data: { nickname: 'İkinci', added_by_nick: 'Kurucu', created_at: serverTimestamp() },
  }));
  // eklenen kişi artık admin
  await assertSucceeds(logged(google(ADMIN2), ADMIN2, 'İkinci', { mode: 'update', col: 'products', id: 'p1', data: { name: 'Z' } }));
});
await test('yönetici kaydına e-posta yazılamaz', async () => {
  await assertFails(logged(google(ADMIN), ADMIN, 'Kurucu', {
    mode: 'set', col: 'admins', id: sha(ADMIN2.email), type: 'admin',
    data: { nickname: 'İkinci', added_by_nick: 'Kurucu', created_at: serverTimestamp(), email: ADMIN2.email },
  }));
});
await test('admin olmayan kendini admin yapamaz', async () => {
  const outsider = { uid: 'x', email: 'random@gmail.com' };
  await assertFails(setDoc(doc(google(outsider), 'admins', sha(outsider.email)), { nickname: 'Hacker', added_by_nick: 'x', created_at: serverTimestamp() }));
});
await test('admin kendini çıkaramaz', async () => {
  await assertFails(logged(google(ADMIN), ADMIN, 'Kurucu', { mode: 'delete', col: 'admins', id: sha(ADMIN.email), type: 'admin', current: {} }));
});
await test('admin kendi takma adını değiştirebilir', async () => {
  await assertSucceeds(logged(google(ADMIN), ADMIN, 'Kurucu', { mode: 'update', col: 'admins', id: sha(ADMIN.email), type: 'admin', data: { nickname: 'Patron' } }));
});

// --- Loglar
await test('loglar değiştirilemez ve silinemez', async () => {
  await logged(google(ADMIN), ADMIN, 'Kurucu', { mode: 'update', col: 'products', id: 'p1', data: { name: 'L' } });
  const logs = await getDocs(collection(google(ADMIN), 'admin_logs'));
  assert.ok(logs.size >= 1);
  const ref = logs.docs[0].ref;
  await assertFails(updateDoc(ref, { summary: 'değişti' }));
  await assertFails(deleteDoc(ref));
});
await test('müşteri logları okuyamaz', async () => {
  await assertFails(getDocs(collection(google({ uid: 'c', email: 'c@gmail.com' }), 'admin_logs')));
});

// --- Key stoğu
const addKeys = (db, me, nick, n, extra = {}) => {
  const b = writeBatch(db);
  const logRef = doc(collection(db, 'admin_logs'));
  b.set(logRef, { actor_uid: me.uid, actor_nick: nick, action: 'create', target_type: 'key', target_id: 'p1', summary: 'test', at: serverTimestamp() });
  for (let i = 0; i < n; i++) b.set(doc(collection(db, 'license_keys')), { product_id: 'p1', plan_id: '1d', key: `K-${i}`, status: 'available', last_log_id: logRef.id, ...extra });
  return b.commit();
};
await test('admin tek logla toplu key ekleyebilir', async () => {
  await assertSucceeds(addKeys(google(ADMIN), ADMIN, 'Kurucu', 25));
});
await test('logsuz key eklenemez', async () => {
  await assertFails(setDoc(doc(google(ADMIN), 'license_keys', 'x'), { product_id: 'p1', plan_id: '1d', key: 'K', status: 'available' }));
});
await test('müşteri key stoğunu okuyamaz', async () => {
  await addKeys(google(ADMIN), ADMIN, 'Kurucu', 1);
  await assertFails(getDocs(collection(password({ uid: 'cust', email: 'c@example.com' }), 'license_keys')));
});
await test('key silinemez, sadece durum değişir', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'license_keys', 'k1'), { product_id: 'p1', plan_id: '1d', key: 'K', status: 'available' }));
  const adb = google(ADMIN);
  await assertFails(deleteDoc(doc(adb, 'license_keys', 'k1')));
  const b = writeBatch(adb);
  const logRef = doc(collection(adb, 'admin_logs'));
  b.set(logRef, { actor_uid: ADMIN.uid, actor_nick: 'Kurucu', action: 'delete', target_type: 'key', target_id: 'k1', summary: 't', at: serverTimestamp() });
  b.update(doc(adb, 'license_keys', 'k1'), { status: 'removed', last_log_id: logRef.id });
  await assertSucceeds(b.commit());
});

// --- Müşteri
await test('müşteri kendi siparişini açabilir, ödendi diye açamaz', async () => {
  const c = password({ uid: 'cust', email: 'c@example.com' });
  await assertSucceeds(setDoc(doc(c, 'orders', 'new'), { user_id: 'cust', status: 'Waiting for Confirmation', total_amount: 5, items: [{ name: 'a' }] }));
  await assertFails(setDoc(doc(c, 'orders', 'new2'), { user_id: 'cust', status: 'paid', total_amount: 5, items: [{ name: 'a' }] }));
});

await env.cleanup();
for (const [s, n] of results) console.log(s, n);
const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} geçti`);
process.exit(failed ? 1 : 0);
