import React, { Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Lazy load heavy menu manager component
const MenuManager = React.lazy(() => import('../components/menu/MenuManager'));

export default function MenuManage(){
  const { id: truckId } = useParams();
  const { token, user } = useAuth();
  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (!['admin','manager'].includes(user?.role)) return <p style={{ padding:20 }}>Forbidden: admin/manager only</p>;
  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading menu manager...</div>}>
        <MenuManager truckId={truckId} />
      </Suspense>
    </div>
  );
}
