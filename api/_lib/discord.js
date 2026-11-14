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
export const imageAttachments = (m) => [...(m.attachments || []), ...(m.message_snapshots?.[0]?.message?.attachments || [])].filter(isImage);

const avatarUrl = (u) => {
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=64`;
  const idx = Number((BigInt(u.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
};

const cleanContent = (m, ctx = {}) => {
  const names = Object.fromEntries((m.mentions || []).map((u) => [u.id, u.global_name || u.username]));
  const ch = (id) => `#${ctx.channelNames?.[id] || 'kanal'}`;
  // İletilen (forward) mesajlarda asıl içerik message_snapshots içindedir
  const raw = m.content || m.message_snapshots?.[0]?.message?.content || '';
  return String(raw)
    .replace(/<@!?(\d+)>/g, (_, id) => `@${names[id] || 'kullanıcı'}`)
    .replace(/<@&\d+>/g, '')
    .replace(/<#(\d+)>/g, (_, id) => ch(id))
    .replace(/https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/\d+\/(\d+)(?:\/\d+)?/g, (_, id) => ch(id))
    .replace(/<a?:(\w+):\d+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1500);
};

/** Mesajdaki görseller: ekler + embed görselleri (en fazla 4) */
export const messageImages = (m) => {
  const list = imageAttachments(m).map((a) => a.proxy_url || a.url);
  for (const e of m.embeds || []) {
    const u = e.image?.proxy_url || e.image?.url || (e.type === 'image' ? e.thumbnail?.proxy_url || e.thumbnail?.url : null);
    if (u) list.push(u);
  }
  return list.slice(0, 4);
};

const stripMd = (s = '') =>
  String(s)
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*|__|~~|\|\|/g, '')
    .replace(/(^|\s)\*(\S[^*]*)\*/g, '$1$2')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)')
    .replace(/@(everyone|here)/g, '')
    .replace(/^>\s?/gm, '')
    .trim();

const base = (m, channelId) => ({
  channel_id: channelId,
  author_id: m.author?.id || null,
  author_name: (m.author?.global_name || m.author?.username || 'Discord').slice(0, 60),
  author_avatar: m.author ? avatarUrl(m.author) : null,
  image_count: messageImages(m).length,
  created_at: Timestamp.fromDate(new Date(m.timestamp)),
  synced_at: FieldValue.serverTimestamp(),
});

/** Discord mesajı → vouch belgesi (yorum sayılmayacak mesajlarda null) */
export const toVouch = (m, channelId, ctx) => {
  if (m.author?.bot || ![0, 19].includes(m.type)) return null;
  const content = cleanContent(m, ctx);
  if (!content && !imageAttachments(m).length) return null;
  return { ...base(m, channelId), content, image_count: Math.min(imageAttachments(m).length, 4) };
};

const guessType = (text) => {
  const s = text.toLocaleLowerCase('tr-TR');
  if (/bakım|maintenance|detected|tespit|kapalı|down|offline|ban dalgası/.test(s)) return 'warning';
  if (/yeni ürün|new product|satışta|released|launch/.test(s)) return 'new';
  if (/güncelle|update|patch|fix|düzelt/.test(s)) return 'update';
  return 'info';
};

/** Discord duyuru mesajı → duyuru belgesi. Bot/webhook mesajları da (embed) kabul edilir. */
export const toAnnouncement = (m, channelId, ctx) => {
  if (![0, 19, 20].includes(m.type)) return null;
  const embed = (m.embeds || []).find((e) => e.title || e.description);
  const text = stripMd(cleanContent(m, ctx));
  const embedText = embed ? stripMd([embed.title, embed.description, ...(embed.fields || []).map((f) => `${f.name}: ${f.value}`)].filter(Boolean).join('\n')) : '';
  const full = [text, embedText].filter(Boolean).join('\n\n').trim();
  if (!full && !messageImages(m).length) return null;
  const lines = full.split('\n').map((l) => l.trim());
  const firstIdx = lines.findIndex(Boolean);
  let title = (embed?.title && stripMd(embed.title)) || (firstIdx >= 0 ? lines[firstIdx] : '');
  let body = embed?.title ? full.replace(stripMd(embed.title), '').trim() : lines.slice(firstIdx + 1).join('\n').trim();
  if (title.length > 110) {
    body = full;
    title = title.slice(0, 100).replace(/\s+\S*$/, '') + '…';
  }
  return {
    ...base(m, channelId),
    source: 'discord',
    title: title || 'Duyuru',
    body: body.slice(0, 4000),
    type: guessType(full),
    message_url: m.guild_id ? `https://discord.com/channels/${m.guild_id}/${channelId}/${m.id}` : null,
  };
};

const bigger = (a, b) => (!a ? b : !b ? a : BigInt(a) > BigInt(b) ? a : b);

const KINDS = {
  vouches: { cfgKey: 'vouch_channel_id', stateDoc: 'discord_sync', collection: 'vouches', map: toVouch, label: 'Vouch' },
  announcements: { cfgKey: 'announce_channel_id', stateDoc: 'discord_sync_ann', collection: 'announcements', map: toAnnouncement, label: 'Duyuru' },
};

/**
 * Bir Discord kanalını Firestore'a eşitler.
 * full=false: son kayıttan sonraki yeni mesajlar; full=true: kanalı baştan tarar (en fazla 2000 mesaj)
 * ve kanalda artık olmayan (silinmiş) kayıtları da kaldırır.
 */
const syncChannel = async (db, kindName, cfg, { full = false } = {}) => {
  const kind = KINDS[kindName];
  const channelId = cfg[kind.cfgKey];
  if (!channelId) return { skipped: 'no-channel', added: 0 };

  const stateRef = db.collection('private').doc(kind.stateDoc);
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

  // Kanal adları: mesajlardaki #kanal bağlantılarını okunur hale getirmek için
  const ctx = { channelNames: {} };
  try {
    const info = await discord(`/channels/${channelId}`);
    const all = await discord(`/guilds/${info.guild_id}/channels`);
    for (const c of all) ctx.channelNames[c.id] = c.name;
  } catch {
    /* adlar alınamazsa '#kanal' yazılır */
  }

  const col = db.collection(kind.collection);
  const seen = new Set();
  let writes = [];
  let added = 0;
  for (const m of messages) {
    const v = kind.map(m, channelId, ctx);
    if (!v) continue;
    seen.add(m.id);
    writes.push([col.doc(m.id), v]);
    added++;
  }

  let removed = 0;
  if (complete) {
    // Sadece Discord'dan gelen kayıtlar silinir (panelden yazılan duyurulara dokunulmaz)
    const existing = kindName === 'announcements' ? await col.where('source', '==', 'discord').select().get() : await col.select().get();
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

  await stateRef.set({ channel_id: channelId, last_message_id: lastId || null, last_run: FieldValue.serverTimestamp(), last_added: added }, { merge: true });
  return { scanned: messages.length, added, removed };
};

/** Vouch ve duyuru kanallarını eşitler, Discord üye sayısını günceller. */
export const syncDiscord = async (db, { full = false } = {}) => {
  const cfg = (await db.collection('settings').doc('discord').get()).data() || {};
  if (!cfg.vouch_channel_id && !cfg.announce_channel_id) {
    throw Object.assign(new Error('Vouch ya da duyuru kanalı seçilmemiş (Admin → Ayarlar → Discord).'), { status: 400 });
  }
  const vouches = await syncChannel(db, 'vouches', cfg, { full });
  const announcements = await syncChannel(db, 'announcements', cfg, { full });

  let memberCount = null;
  if (cfg.invite_url) {
    try {
      const inv = await discord(`/invites/${inviteCode(cfg.invite_url)}?with_counts=true`, { auth: false });
      memberCount = inv.approximate_member_count || null;
      if (memberCount) {
        await db.collection('settings').doc('discord').set({ member_count: memberCount, online_count: inv.approximate_presence_count || 0 }, { merge: true });
      }
    } catch {
      /* davet linki geçersiz olabilir */
    }
  }
  return {
    added: (vouches.added || 0) + (announcements.added || 0),
    removed: (vouches.removed || 0) + (announcements.removed || 0),
    vouches,
    announcements,
    member_count: memberCount,
  };
};

export const hasAnyChannel = (cfg) => !!(cfg.vouch_channel_id || cfg.announce_channel_id);