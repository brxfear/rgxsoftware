// Firebase Auth hata kodlarını seçili dile çevirir.
import { translate } from '../i18n';

export const authErrorMessage = (err) => {
  const map = translate('authErrors');
  return (err?.code && map[err.code]) || err?.message || map.default;
};
