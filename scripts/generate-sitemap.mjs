// public/sitemap.xml üretir: sabit sayfalar + Firestore'daki kategori ve ürün sayfaları.
// Çalıştırma: node scripts/generate-sitemap.mjs   (ürün/kategori ekleyince tekrar çalıştır)
import fs from 'node:fs';

const SITE = 'https://www.rgx.wtf';
const API = 'https://firestore.googleapis.com/v1/projects/rgxsoftware/databases/(default)/documents';

const slugify = (s = '') =>
  String(s)
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' })[c])
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const list = async (col, fields) => {
  const mask = fields.map((f) => `mask.fieldPaths=${f}`).join('&');
  const r = await fetch(`${API}/${col}?pageSize=300&${mask}`);
  const j = await r.json();
  return (j.documents || []).map((d) => {
    const o = { id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(d.fields || {})) o[k] = v.stringValue ?? v.booleanValue ?? v.integerValue;
    return o;
  });
};

const cats = await list('categories', ['name', 'slug']);
const prods = (await list('products', ['name', 'slug', 'category_id', 'is_available', 'test_only'])).filter((p) => p.is_available !== false && !p.test_only);
const catSlug = Object.fromEntries(cats.map((c) => [c.id, c.slug || slugify(c.name)]));

const today = new Date().toISOString().slice(0, 10);
const urls = [
  ['/', '1.0', 'daily'],
  ['/products', '0.9', 'daily'],
  ...cats.map((c) => [`/products/${catSlug[c.id]}`, '0.9', 'daily']),
  ...prods.filter((p) => catSlug[p.category_id]).map((p) => [`/products/${catSlug[p.category_id]}/${p.slug || slugify(p.name)}`, '0.8', 'weekly']),
  ['/reviews', '0.7', 'daily'],
  ['/status', '0.6', 'daily'],
  ['/announcements', '0.6', 'daily'],
  ['/reseller', '0.4', 'monthly'],
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, pr, cf]) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync('public/sitemap.xml', xml);
console.log(`sitemap.xml: ${urls.length} adres`);
