import React from 'react';
import { Chip } from '@mui/material';

// Base themes for different statuses
const baseThemes = {
  success: { backgroundColor: '#E8F7EF', color: '#34A853' },
  warning: { backgroundColor: '#FEF8E8', color: '#F57C00' },
  error: { backgroundColor: '#FDEDED', color: '#EA4335' },
  info: { backgroundColor: '#E8F0FE', color: '#4285F4' },
  purple: { backgroundColor: '#DFCEE9', color: '#70249E' },
  critical: { backgroundColor: '#FCC6C7', color: '#F70406' },
  neutral: { backgroundColor: '#EDEDED', color: '#9E9E9E' },
  open: { backgroundColor: '#34A853', color: '#f6e9bfff' },
  free: { backgroundColor: '#EDEDED', color: 'black' },
  whites: { backgroundColor: '#ffffff', color: 'navy' }
};

// Mapping from status labels to base themes
const statusToThemeMap = {
  // Success
  paid: 'success',
  approved: 'success',
  active: 'success',
  yes: 'success',
  enough: 'success',
  mild: 'success',
  normal: 'success',

  // Warning
  pending: 'warning',
  reoder: 'warning',

  // Error
  unpaid: 'error',
  disabled: 'error',
  close: 'error',
  declined: 'error',
  rejected: 'error',
  no: 'error',
  urgent: 'error',

  // Info
  served: 'info',
  dispensed: 'info',
  reviewed: 'info',

  // Purple
  refunded: 'purple',
  issued: 'purple',
  available: 'purple',
  moderate: 'purple',
  unserved: 'purple',
  draft: 'purple',

  // Critical
  critical: 'critical',
  closed: 'critical',
  severe: 'critical',
  returned: 'critical',

  // Neutral
  nil: 'neutral',

  // Special
  open: 'open',
  reviewing: 'open',

  free: 'free',
   completed: 'whites'
};

// Define sizes for the chip
const chipSizes = {
  extraSmall: {
    fontSize: '10px',
    padding: '1px 5px',
    height: '18px',
    fontWeight: 'bold'
  },
  tiny: {
    fontSize: '11px',
    padding: '2px 6px',
    minWidth: '100px',
    height: '23px'
  },
  small: {
    fontSize: '13px',
    padding: '4px 8px',
    minWidth: '100px',
    height: '30px',
    fontWeight: 'normal'
  },
  large: {
    fontSize: '14px',
    padding: '6px 12px',
    minWidth: '100px'
  }
};

// Create a reusable Chip component
export const StatusChip = ({ label, size = 'small' }) => {
  const labelLower = label.toLowerCase();
  const themeName = statusToThemeMap[labelLower] || 'neutral';
  const theme = baseThemes[themeName];

  const sizeStyle = chipSizes[size.toLowerCase()] || chipSizes['small'];

  return (
    <Chip
      sx={{
        borderRadius: 1,
        cursor: 'pointer',
        ...sizeStyle,
        '&:hover': {
          opacity: 0.6
        }
      }}
      style={theme}
      variant="outlined"
      label={label.charAt(0).toUpperCase() + label.slice(1)} // Capitalize the label
    />
  );
};

// Create an extra small version of the chip
export const SmallStatusChip = ({ label }) => {
  const labelLower = label.toLowerCase();
  const themeName = statusToThemeMap[labelLower] || 'neutral';
  const theme = baseThemes[themeName];

  const sizeStyle = chipSizes['extraSmall'];

  return (
    <Chip
      sx={{
        borderRadius: 1,
        cursor: 'pointer',
        ...sizeStyle,
        '&:hover': {
          opacity: 0.6
        }
      }}
      style={theme}
      variant="outlined"
      label={label.charAt(0).toUpperCase() + label.slice(1)} // Capitalize the label
    />
  );
};
