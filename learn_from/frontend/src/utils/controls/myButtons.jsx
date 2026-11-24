// components/controls/LoadingActionButton.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip, Box } from '@mui/material';
import { LoadingButton } from '@mui/lab';

const LdButton = ({
    loading = false,
    children,
    tooltip = '',
    startIcon = null,
    endIcon = null,
    fullWidth = false,
    size = 'small',
    variant = 'contained',
    color = 'primary',
    ...props
}) => {
    const button = (
        <LoadingButton
            loading={loading}
            //loadingPosition="start"
            //loadingIndicator="Please wait..."
            startIcon={startIcon}
            endIcon={endIcon}
            fullWidth={fullWidth}
            size={size}
            variant={variant}
            color={color}
            {...props}
        >
            {children}
        </LoadingButton>
    );

    return tooltip ? (
        <Tooltip title={tooltip} arrow>
            <Box display="inline-block">{button}</Box>
        </Tooltip>
    ) : (
        button
    );
};

export { LdButton };
