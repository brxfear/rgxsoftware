import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

/** Tüm ürünlerin "available" key sayıları: { [productId]: { [planId]: n, _total: n } } */
export const useKeyCounts = () => {
  const [counts, setCounts] = useState({});
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'license_keys'), where('status', '==', 'available')),
        (snap) => {
          const c = {};
          snap.docs.forEach((d) => {
            const { product_id: p, plan_id: pl } = d.data();
            c[p] = c[p] || { _total: 0 };
            c[p][pl] = (c[p][pl] || 0) + 1;
            c[p]._total++;
          });
          setCounts(c);
        },
        (err) => console.error('license_keys', err)
      ),
    []
  );
  return counts;
};

