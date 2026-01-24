import React from 'react';
import { useParams } from 'react-router-dom';
import MenuManager from '../components/menu/MenuManager';
import { useAuth } from '../context/AuthContext';

export default function MenuManage(){
  const { id: truckId } = useParams();
  const { token, user } = useAuth();
  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (!['admin','manager'].includes(user?.role)) return <p style={{ padding:20 }}>Forbidden: admin/manager only</p>;
  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <MenuManager truckId={truckId} />
    </div>
  );
}
