import React from 'react';
import * as Icons from '@mui/icons-material';
import { Avatar, Box } from '@mui/material';

/**
 * DynamicIcon Component
 * Handles both "mui:IconName" strings and standard image URLs.
 */
const DynamicIcon = ({ path, name, sx = {} }) => {
  const isMuiIcon = path?.startsWith('mui:');

  if (isMuiIcon) {
    const iconName = path.split(':')[1];
    const IconComponent = Icons[iconName] || Icons.Inventory;
    return (
      <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.main', ...sx }}>
        <IconComponent fontSize="medium" />
      </Avatar>
    );
  }

  return (
    <Avatar 
      variant="rounded" 
      src={path ? `/api/uploads/${path}` : ''} 
      sx={{ bgcolor: 'primary.light', color: 'primary.main', ...sx }}
    >
      {!path && <Icons.Inventory />}
    </Avatar>
  );
};

export default DynamicIcon;
