// Okunmamış duyuru takibi (tarayıcıda): en son görülen duyurunun zamanı.
import { toDate } from './db';

const KEY = 'rgx_ann_seen';

export const lastSeenAt = () => {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
};

export const markAnnouncementsSeen = (latest) => {
  const t = toDate(latest?.created_at)?.getTime();
  if (!t) return;
  try {
    localStorage.setItem(KEY, String(t));
  } catch {
    /* yoksay */
  }
};

export const hasUnread = (list) => {
  const t = toDate(list?.[0]?.created_at)?.getTime();
  return !!t && t > lastSeenAt();
};
