// GET /api/shopier-orders?limit=50  — (sadece yönetici) Shopier mağazasındaki son siparişler.
import { requireAdmin, sendError } from './_lib/adminAuth.js';
import { shopierRest, simplifyOrder } from './_lib/shopierRest.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const limit = Math.max(1, Math.min(100, parseInt(req.query?.limit, 10) || 50));
    const orders = await shopierRest('GET', `/orders?limit=${limit}`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ orders: (orders || []).map(simplifyOrder) });
  } catch (err) {
    if (err.status && !err.message?.startsWith('Shopier')) return sendError(res, err);
    console.error(err);
    return res.status(502).json({ error: err.message || 'Shopier siparişleri alınamadı.' });
  }
}
