// Discord REST (bot token ile). Gateway/sürekli açık bot gerekmez: mesajlar REST ile okunur.
import process from 'node:process';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const API = 'https://discord.com/api/v10';

export const botToken = () => process.env.DISCORD_BOT_TOKEN || '';

export const discord = async (path, { method = 'GET', auth = true, retry = true } = {}) => {
  const headers = { 'User-Agent': 'RGXSiteBot (https://github.com/brxfear/rgxsoftware, 1.0)' };
  if (auth) {
    if (!botToken()) throw Object.assign(new Error('DISCORD_BOT_TOKEN tanımlı değil.'), { status: 503 });
    headers.Authorization = `Bot ${botToken()}`;
  }
  const r = await fetch(API + path, { method, headers });
  if (r.status === 429 && retry) {
    const body = await r.json().catch(() => ({}));
    await new Promise((ok) => setTimeout(ok, Math.min(5000, (body.retry_after || 1) * 1000)));
    return discord(path, { method, auth, retry: false });
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(`Discord ${r.status}: ${data?.message || 'hata'}`);
    err.status = r.status;
    err.code = data?.code;
    throw err;
  }
  return data;
};

/** discord.gg/abc, discord.com/invite/abc → abc */
export const inviteCode = (url = '') => String(url).trim().replace(/^https?:\/\/(www\.)?(discord\.gg|discord(app)?\.com\/invite)\//i, '').split(/[/?#]/)[0];

const isImage = (a) => (a.content_type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.filename || '');
export const imageAttachments = (m) => (m.attachments || []).filter(isImage);

const avatarUrl = (u) => {
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=64`;
  const idx = Number((BigInt(u.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
};

const cleanContent = (m) => {
  const names = Object.fromEntries((m.mentions || []).map((u) => [u.id, u.global_name || u.username]));
  return String(m.content || '')
    .replace(/<@!?(\d+)>/g, (_, id) => `@${names[id] || 'kullanıcı'}`)
    .replace(/<@&\d+>/g, '')
    .replace(/<#\d+>/g, '#kanal')
    .replace(/<a?:(\w+):\d+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1500);
};

/** Discord mesajı → vouch belgesi (yorum sayılmayacak mesajlarda null) */
export const toVouch = (m, channelId) => {
  if (m.author?.bot || ![0, 19].includes(m.type)) return null;
  const content = cleanContent(m);
  const images = imageAttachments(m);
  if (!content && !images.length) return null;
  return {
    channel_id: channelId,
    author_id: m.author.id,
    author_name: (m.author.global_name || m.author.username || 'Discord').slice(0, 60),
    author_avatar: avatarUrl(m.author),
    content,
    image_count: Math.min(images.length, 4),
    created_at: Timestamp.fromDate(new Date(m.timestamp)),
    synced_at: FieldValue.serverTimestamp(),
  };
};

const bigger = (a, b) => (!a ? b : !b ? a : BigInt(a) > BigInt(b) ? a : b);

/**
 * Vouch kanalını Firestore'a eşitler.
 * full=false: son kayıttan sonraki yeni mesajlar; full=true: kanalı baştan tarar (en fazla 2000 mesaj)
 * ve kanalda artık olmayan (silinmiş) yorumları da kaldırır.
 */
export const syncVouches = async (db, { full = false } = {}) => {
  const cfg = (await db.collection('settings').doc('discord').get()).data() || {};
  const channelId = cfg.vouch_channel_id;
  if (!channelId) throw Object.assign(new Error('Vouch kanalı seçilmemiş (Admin → Ayarlar → Discord).'), { status: 400 });

  const stateRef = db.collection('private').doc('discord_sync');
  const state = (await stateRef.get()).data() || {};
  const sameChannel = state.channel_id === channelId;
  const incremental = !full && sameChannel && state.last_message_id;

  const messages = [];
  let lastId = sameChannel ? state.last_message_id : null;
  let complete = false;

  if (incremental) {
    let after = state.last_message_id;
    for (let page = 0; page < 10; page++) {
      const batch = await discord(`/channels/${channelId}/messages?limit=100&after=${after}`);
      if (!batch.length) break;
      messages.push(...batch);
      for (const m of batch) after = bigger(after, m.id);
      if (batch.length < 100) break;
    }
    lastId = messages.reduce((acc, m) => bigger(acc, m.id), lastId);
  } else {
    let before = null;
    for (let page = 0; page < 20; page++) {
      const batch = await discord(`/channels/${channelId}/messages?limit=100${before ? `&before=${before}` : ''}`);
      messages.push(...batch);
      if (batch.length < 100) {
        complete = true;
        break;
      }
      before = batch[batch.length - 1].id;
    }
    lastId = messages.reduce((acc, m) => bigger(acc, m.id), null);
  }

  const col = db.collection('vouches');
  const seen = new Set();
  let writes = [];
  let added = 0;
  for (const m of messages) {
    const v = toVouch(m, channelId);
    if (!v) continue;
    seen.add(m.id);
    writes.push([col.doc(m.id), v]);
    added++;
  }

  let removed = 0;
  if (complete) {
    const existing = await col.select().get();
    for (const d of existing.docs) {
      if (!seen.has(d.id)) {
        writes.push([d.ref, null]);
        removed++;
      }
    }
  }

  while (writes.length) {
    const chunk = writes.slice(0, 450);
    writes = writes.slice(450);
    const b = db.batch();
    for (const [ref, data] of chunk) (data ? b.set(ref, data, { merge: true }) : b.delete(ref));
    await b.commit();
  }

  // Sunucu üye sayısı (üst bardaki Discord rozeti için)
  let memberCount = null;
  if (cfg.invite_url) {
    try {
      const inv = await discord(`/invites/${inviteCode(cfg.invite_url)}?with_counts=true`, { auth: false });
      memberCount = inv.approximate_member_count || null;
      if (memberCount) {
        await db.collection('settings').doc('discord').set({ member_count: memberCount, online_count: inv.approximate_presence_count || 0 }, { merge: true });
      }
    } catch {
      /* davet linki geçersiz olabilir; yorumları etkilemez */
    }
  }

  await stateRef.set({ channel_id: channelId, last_message_id: lastId || null, last_run: FieldValue.serverTimestamp(), last_added: added }, { merge: true });
  return { scanned: messages.length, added, removed, member_count: memberCount };
};
