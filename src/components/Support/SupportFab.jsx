// Sağ altta sabit destek düğmesi: giriş yaptıysa Destek sekmesine, yapmadıysa girişe götürür.
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { MessageSquareText } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useShopStore } from '../../store/useShopStore';
import { useT } from '../../i18n';
import './tickets.css';

const SupportFab = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useShopStore((s) => s.user);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    return onSnapshot(
      query(collection(db, 'tickets'), where('uid', '==', user.uid), where('unread_user', '==', true), limit(1)),
      (s) => setUnread(!s.empty),
      () => setUnread(false),
    );
  }, [user]);

  if (pathname.startsWith('/account/support') || pathname.startsWith('/reseller')) return null;

  return (
    <button
      className="support-fab"
      aria-label={t('support.fab')}
      title={t('support.fab')}
      onClick={() => (user ? navigate('/account/support') : useShopStore.getState().openAuth())}
    >
      <MessageSquareText size={22} />
      {user && unread && <i />}
    </button>
  );
};

export default SupportFab;
