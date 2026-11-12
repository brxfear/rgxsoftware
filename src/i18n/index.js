// Dil altyapısı: TR / EN. Seçim localStorage'da tutulur; ilk ziyarette tarayıcı diline bakılır.
import { create } from 'zustand';
import tr from './tr';
import en from './en';

const DICTS = { tr, en };
const KEY = 'rgx_lang';

const initialLang = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'tr' || saved === 'en') return saved;
  } catch {
    /* yoksay */
  }
  return (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
};

export const useLangStore = create((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* yoksay */
    }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

document.documentElement.lang = useLangStore.getState().lang;

const lookup = (dict, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);

const format = (str, vars) =>
  vars ? String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`)) : str;

/** React dışında kullanım (toast vb.) */
export const translate = (key, vars, lang = useLangStore.getState().lang) => {
  const val = lookup(DICTS[lang], key) ?? lookup(DICTS.tr, key) ?? key;
  return typeof val === 'string' ? format(val, vars) : val;
};

/** Bileşenlerde: const { t, lang, setLang } = useT(); */
export const useT = () => {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const t = (key, vars) => translate(key, vars, lang);
  return { t, lang, setLang };
};

/** Admin'de Türkçe girilen plan adını EN'de çevirir: "1 Gün" → "1 Day", "Sınırsız" → "Lifetime". */
export const planLabel = (label, lang) => {
  if (lang !== 'en' || !label) return label;
  const map = en.plans;
  const lower = label.toLocaleLowerCase('tr-TR').trim();
  if (typeof map[lower] === 'string') return map[lower];
  const m = lower.match(/^(\d+)\s*(.+)$/);
  if (m && Array.isArray(map[m[2]])) {
    const n = Number(m[1]);
    return `${n} ${map[m[2]][n === 1 ? 0 : 1]}`;
  }
  return label;
};

/** Ürün metni: EN'de *_en alanı varsa onu kullanır. */
export const localized = (obj, field, lang) => (lang === 'en' && obj?.[`${field}_en`]) || obj?.[field] || '';
