import React from 'react';
import { Navigate } from 'react-router-dom';
import { useMainContext } from 'utils/context/MainContextMenu';
import Loader from 'ui-component/Loader';

const PermissionGuard = ({ children, permissionId }) => {
  const { permissions, loading } = useMainContext();

  if (loading) {
    return <Loader />;
  }

  // If a route does not have a permissionId, it's considered public within the protected layout.
  if (!permissionId) {
    return children;
  }

  // The permissions from the context are expected to be an array of strings.
  // If the user has 'admin' role, they get access to everything.
  if (permissions.includes('Admin') || permissions.includes('admin')) {
    return children;
  }

  if (permissions.includes(permissionId)) {
    return children; // User has the required role/permission.
  }

  // User does not have permission, redirect to Unauthorized page.
  return <Navigate to="/unauthorized" replace />;
};

export default PermissionGuard;
