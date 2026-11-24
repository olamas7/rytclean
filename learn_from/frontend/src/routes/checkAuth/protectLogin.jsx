// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import localforage from 'localforage';

import isAuthenticated from './isAuthenticated';

const ProtectedRoute = ({ element }) => {
    const location = useLocation();
    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const publicPaths = ['/login', '/register', '/forgot-password', '/quick-purchase', '/fair-use-policy'];
    const signOutBeforeOpenPaths = ['/login', '/register', '/forgot-password', '/quick-purchase'];

    useEffect(() => {
        const checkAuth = async () => {
            if (publicPaths.includes(location.pathname)) {
                if (signOutBeforeOpenPaths.includes(location.pathname)) {
                    localStorage.clear();
                    await localforage.clear();
                }
                setAuthenticated(false);
                setLoading(false);
                return;
            }

            const isAuth = await isAuthenticated();
            setAuthenticated(isAuth);
            setLoading(false);
        };

        checkAuth();
    }, [location.pathname]);

    if (loading) {
        return <div>Loading...</div>; // Show loading state while checking auth
    }

    return !authenticated ? element : <Navigate to="/app" />;
};

export default ProtectedRoute;
