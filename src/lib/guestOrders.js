// Misafir siparişlerini bu tarayıcıda hatırlar (sipariş görüntüleme linki için).
const STORE_KEY = 'rgx_guest_orders';

export const rememberGuestOrder = (id, key) => {
  try {
    const list = JSON.parse(localStorage.getItem(STORE_KEY) || '[]').filter((o) => o.id !== id);
    list.unshift({ id, key, at: Date.now() });
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* yoksay */
  }
};

