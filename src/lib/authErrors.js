// Firebase Auth hata kodlarını Türkçe mesaja çevirir.
const MESSAGES = {
  'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  'auth/wrong-password': 'E-posta veya şifre hatalı.',
  'auth/user-not-found': 'Bu e-postayla kayıtlı hesap yok.',
  'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı.',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  'auth/invalid-email': 'Geçersiz e-posta adresi.',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı, biraz sonra tekrar dene.',
  'auth/configuration-not-found': 'Firebase Authentication henüz etkinleştirilmemiş.',
  'auth/operation-not-allowed': 'E-posta/şifre girişi Firebase konsolunda kapalı.',
};

export const authErrorMessage = (err) => MESSAGES[err?.code] || err?.message || 'Bir hata oluştu.';
