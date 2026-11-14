// Ürün tespit durumu ve geçmişi.
// product.status: 'undetected' | 'testing' | 'updating' | 'detected'
// product.status_log: [{ from, to, at: ISO }] — admin durumu her değiştirdiğinde eklenir.
import { toDate } from './db';

export const STATUSES = ['undetected', 'testing', 'updating', 'detected'];
export const STATUS_TONE = { undetected: 'ok', testing: 'info', updating: 'warn', detected: 'bad', nodata: 'none' };
const RANK = { undetected: 0, testing: 1, updating: 2, detected: 3 };
const DAY = 24 * 60 * 60 * 1000;

export const statusOf = (p) => (STATUSES.includes(p?.status) ? p.status : 'undetected');
/** Satışa uygun mu (undetected veya test) */
export const isUp = (s) => s === 'undetected' || s === 'testing';

const sortedLog = (p) =>
  (Array.isArray(p?.status_log) ? p.status_log : [])
    .map((e) => ({ ...e, t: new Date(e.at).getTime() }))
    .filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t);

/** t anındaki durum */
const statusAt = (log, current, t) => {
  if (!log.length) return current;
  let s = log[0].from && STATUSES.includes(log[0].from) ? log[0].from : 'undetected';
  for (const e of log) {
    if (e.t <= t) s = e.to;
    else break;
  }
  return s;
};

/**
 * Son `days` günün günlük durumu (her gün o gün görülen en kötü durum) ve çalışma oranı.
 * Ürün eklenmeden önceki günler 'nodata'.
 */
export const statusHistory = (p, days = 30, now = Date.now()) => {
  const current = statusOf(p);
  const log = sortedLog(p);
  const created = toDate(p?.created_at)?.getTime() || now - days * DAY;
  const start = now - days * DAY;
  const bars = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayEnd = now - i * DAY;
    const dayStart = dayEnd - DAY;
    if (dayEnd < created) {
      bars.push({ date: new Date(dayStart), status: 'nodata' });
      continue;
    }
    let worst = statusAt(log, current, Math.max(dayStart, created));
    for (const e of log) if (e.t > dayStart && e.t <= dayEnd && RANK[e.to] > RANK[worst]) worst = e.to;
    bars.push({ date: new Date(dayStart), status: worst });
  }

  // Çalışma oranı: penceredeki (ürün varken) süre içinde undetected/test olunan oran
  const from = Math.max(start, created);
  const total = now - from;
  let up = 0;
  if (total > 0) {
    const points = [from, ...log.filter((e) => e.t > from && e.t < now).map((e) => e.t), now];
    for (let i = 0; i < points.length - 1; i++) {
      if (isUp(statusAt(log, current, points[i]))) up += points[i + 1] - points[i];
    }
  }
  const uptime = total > 0 ? (up / total) * 100 : 100;
  const lastChange = log.length ? new Date(log[log.length - 1].t) : null;
  return { bars, uptime, lastChange };
};

export const fmtUptime = (u) => `${u >= 99.995 ? '100' : u.toFixed(2).replace(/\.?0+$/, '')}%`;

/** Ürün detay metninden madde işaretli özellikler (en fazla n) */
export const featureBullets = (text = '', n = 4) =>
  String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-•*✓✔]\s*/.test(l))
    .map((l) => l.replace(/^[-•*✓✔]\s*/, ''))
    .filter(Boolean)
    .slice(0, n);
