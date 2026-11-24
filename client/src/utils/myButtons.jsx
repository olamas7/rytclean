// components/controls/LoadingActionButton.jsx
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Tooltip, Box } from '@mui/material';
import { LoadingButton } from '@mui/lab';

const LdButton = forwardRef(function LdButton(
  {
    loading = false,
    children,
    tooltip = '',
    startIcon = null,
    endIcon = null,
    fullWidth = false,
    size = 'small',
    variant = 'contained',
    color = 'primary',
    disabled = false,
    type = 'button',
    ...props
  },
  ref
) {
  const button = (
    <LoadingButton
      {...props}
      ref={ref}
      type={type}
      loading={loading}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      startIcon={startIcon}
      endIcon={endIcon}
      fullWidth={fullWidth}
      size={size}
      variant={variant}
      color={color}
    >
      {children}
    </LoadingButton>
  );

  return tooltip ? (
    <Tooltip title={tooltip} arrow>
      <Box component="span" sx={{ display: 'inline-flex', ...(fullWidth ? { width: '100%' } : {}) }}>
        {button}
      </Box>
    </Tooltip>
  ) : (
    button
  );
});

LdButton.propTypes = {
  loading: PropTypes.bool,
  children: PropTypes.node,
  tooltip: PropTypes.string,
  startIcon: PropTypes.node,
  endIcon: PropTypes.node,
  fullWidth: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  variant: PropTypes.oneOf(['text', 'outlined', 'contained']),
  color: PropTypes.string,
  disabled: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset'])
};

export { LdButton };
