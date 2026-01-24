import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleRoute({ roles, children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!roles.includes(user?.role)) {
    const map = { admin:'/admin', manager:'/manager', staff:'/staff', customer:'/customer' };
    return <Navigate to={map[user?.role] || '/trucks'} replace />;
  }
  return children;
}