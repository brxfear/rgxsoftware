// Firebase Storage Spark planında kapalı olduğu için görseller tarayıcıda küçültülüp
// WebP data URL olarak Firestore belgesine yazılır (belge sınırı 1 MB).
// Blaze plana geçilirse burası Storage yüklemesiyle değiştirilebilir.
export const MAX_DATA_URL_BYTES = 450 * 1024;

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Görsel okunamadı.'));
    };
    img.src = url;
  });

export const fileToCompressedDataUrl = async (file, maxSide = 1280) => {
  if (!file.type.startsWith('image/')) throw new Error('Sadece görsel dosyası yüklenebilir.');
  const img = await loadImage(file);
  let side = maxSide;
  let quality = 0.82;

  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/webp', quality);
    if (dataUrl.length <= MAX_DATA_URL_BYTES) return dataUrl;
    side = Math.round(side * 0.8);
    quality = Math.max(0.55, quality - 0.08);
  }
  throw new Error('Görsel çok büyük; daha küçük bir görsel dene veya URL kullan.');
};
