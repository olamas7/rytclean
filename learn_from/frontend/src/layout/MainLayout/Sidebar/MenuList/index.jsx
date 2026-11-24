import { Typography } from '@mui/material';
import { useState, useEffect } from 'react';

// project imports
import NavGroup from './NavGroup';
import getMenuItems from 'menu-items';

// ==============================|| SIDEBAR MENU LIST ||============================== //

const MenuList = () => {
    const [normalizedPermissions, setNormalizedPermissions] = useState([]);

    useEffect(() => {
        const updatePermissions = () => {
            const userPermissionsRaw = localStorage.getItem('userPermissions') || '';
            const userPermissions = userPermissionsRaw
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item !== '');
            const newNormalizedPermissions = userPermissions.map((perm) => parseInt(perm, 10)).filter((perm) => !isNaN(perm));
            setNormalizedPermissions(newNormalizedPermissions);
        };

        // Initial load
        updatePermissions();

        // Listen for changes in session storage from auth updates.
        window.addEventListener('storage', updatePermissions);

        return () => {
            window.removeEventListener('storage', updatePermissions);
        };
    }, []);

    const menuItems = getMenuItems(normalizedPermissions);

    const navItems = menuItems.items.map((item) => {
        switch (item.type) {
            case 'group':
                return <NavGroup key={item.id} item={item} />;
            default:
                return (
                    <Typography key={item.id} variant="h6" color="error" align="center">
                        Menu Items Error
                    </Typography>
                );
        }
    });

    return <>{navItems}</>;
};

export default MenuList;
