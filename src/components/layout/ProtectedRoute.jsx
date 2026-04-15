import React from 'react';
import { Navigate } from 'react-router-dom';
import { hasPermission } from '@/lib/utils/roles';

export default function ProtectedRoute({ user, featureKey, children }) {
  const role = user?.role || 'inactive';
  if (!hasPermission(role, featureKey)) {
    return <Navigate to="/" replace />;
  }
  return children;
}