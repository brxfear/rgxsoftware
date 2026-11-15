/** Adminden seçilebilen hazır tanıtım renkleri */
export const PROMO_COLORS = [
  ['#e0262f', 'Kırmızı'],
  ['#a8ff60', 'Yeşil'],
  ['#9b5cff', 'Mor'],
  ['#2f8cff', 'Mavi'],
  ['#ff8a1f', 'Turuncu'],
  ['#20e3d2', 'Turkuaz'],
  ['#ff3fa4', 'Pembe'],
  ['#e8e8ec', 'Gümüş'],
];

/** Ürün kartında / sayfasında hareketli tanıtım gösterilsin mi (varsayılan: evet) */
export const hasPromo = (product) => !!product && product.media_mode !== 'image';

export const promoColor = (product) => (/^#[0-9a-f]{6}$/i.test(product?.promo_color || '') ? product.promo_color : '#e0262f');
