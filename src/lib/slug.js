// URL dostu kısa ad: "RGX External Slotted" → "rgx-external-slotted", "Oyun Ürünü" → "oyun-urunu"
const MAP = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };

export const slugify = (s = '') =>
  String(s)
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => MAP[c])
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export const categorySlug = (c) => (c ? c.slug || slugify(c.name) || c.id : '');
export const productSlug = (p) => (p ? p.slug || slugify(p.name) || p.id : '');

/** /products/valorant/rgx-external */
export const productPath = (p, categories) => {
  const cat = categories.find((c) => c.id === p.category_id);
  return `/products/${cat ? categorySlug(cat) : 'diger'}/${productSlug(p)}`;
};
export const categoryPath = (c) => `/products/${categorySlug(c)}`;
