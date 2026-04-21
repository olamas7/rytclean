import React, { createContext, useContext, useState, useEffect } from 'react';
import { getPermissions } from 'routes/checkAuth/getPermissions';
import { jwtDecode } from 'jwt-decode';

const MainContext = createContext();

export const MainProvider = ({ children }) => {
  const [permissions, setPermissions] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decoded = jwtDecode(token);
          setUserId(decoded.user_id || decoded.id || null);

          if (decoded.roles) {
            if (typeof decoded.roles === 'string') {
              const rolesArray = decoded.roles.split(',').map((role) => role.trim());
              setPermissions(rolesArray);
            } else if (Array.isArray(decoded.roles)) {
              setPermissions(decoded.roles);
            }
          } else {
            // Fallback for other user types if not in token
            const perms = await getPermissions();
            if (perms && perms.permissions) {
              const rolesArray = String(perms.permissions)
                .split(',')
                .map((role) => role.trim());
              setPermissions(rolesArray);
            } else {
              setPermissions([]);
            }
          }
        } catch (error) {
          console.error('Error processing token or fetching permissions:', error);
          setPermissions([]);
          setUserId(null);
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, []);

  return <MainContext.Provider value={{ permissions, userId, loading }}>{children}</MainContext.Provider>;
};

export const useMainContext = () => useContext(MainContext);
