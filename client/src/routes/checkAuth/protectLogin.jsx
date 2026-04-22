// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

import isAuthenticated from './isAuthenticated';
import { defaultRoute } from 'constants/appRoutes';

const ProtectedRoute = ({ element }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = await isAuthenticated();
      setAuthenticated(isAuth);
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return <div>Loading...</div>; // Show loading state while checking auth
  }

  return !authenticated ? element : <Navigate to={defaultRoute} />;
};

export default ProtectedRoute;
