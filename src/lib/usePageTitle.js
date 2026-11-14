import { useEffect } from 'react';

/** Sekme başlığı: "Valorant | RGX Software" */
export const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} | RGX Software` : 'RGX Software | Private Yazılımlar';
  }, [title]);
};
