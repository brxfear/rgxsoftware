// Discord vouch kanalından bot ile çekilen yorumlar (Firestore: vouches).
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';

export const fetchVouches = async (n = 300) => {
  const snap = await getDocs(query(collection(db, 'vouches'), orderBy('created_at', 'desc'), limit(n)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** Sunucuya "yeni vouch var mı bak" der (sunucu 10 dakikada bir kez gerçekten çeker). */
export const requestVouchSync = () =>
  fetch('/api/discord?action=sync', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

/** Görsel: Discord bağlantıları süreli olduğu için sunucu üzerinden açılır. */
export const vouchImageUrl = (vouchId, index) => `/api/discord?action=image&id=${encodeURIComponent(vouchId)}&i=${index}`;
