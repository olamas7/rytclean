import React from 'react';
import { Chip } from '@mui/material';
import { fontWeight, height } from '@mui/system';

// Define themes for each label
const chipThemes = {
    pending: {
        backgroundColor: '#FEF8E8',
        color: '#F57C00',
        border: 'black'
    },
    paid: {
        backgroundColor: '#E8F7EF',
        color: '#34A853',
        border: 'none'
    },
    approved: {
        backgroundColor: '#E8F7EF',
        color: '#34A853',
        border: 'none'
    },
    unpaid: {
        backgroundColor: '#FDEDED',
        color: '#EA4335',
        border: 'none'
    },
    disabled: {
        backgroundColor: '#FDEDED',
        color: '#EA4335',
        border: 'none'
    },
    served: {
        backgroundColor: '#E8F0FE',
        color: '#4285F4',
        border: 'none'
    },
    dispensed: {
        backgroundColor: '#E8F0FE',
        color: '#4285F4',
        border: 'none'
    },
    refunded: {
        backgroundColor: '#DFCEE9',
        color: '#70249E',
        border: 'none'
    },
    issued: {
        backgroundColor: '#DFCEE9',
        color: '#70249E',
        border: 'none'
    },
    available: {
        backgroundColor: '#DFCEE9',
        color: '#70249E',
        border: 'none'
    },
    unserved: {
        backgroundColor: '#70249E',
        color: '#70249E',
        border: 'none'
    },

    mild: {
        backgroundColor: '#E8F7EF',
        color: '#F70406',
        border: 'none'
    },
    moderate: {
        backgroundColor: '#DFCEE9',
        color: '#F70406',
        border: 'none'
    },
    severe: {
        backgroundColor: '#FDEDED',
        color: '#F70406',
        border: 'none'
    },
    critical: {
        backgroundColor: '#FCC6C7',
        color: '#F70406',
        border: 'none'
    },

    nil: {
        backgroundColor: '#EDEDED',
        color: '#9E9E9E',
        border: 'none'
    },
    free: {
        backgroundColor: '#EDEDED',
        color: 'black',
        border: 'none'
    },

    active: {
        backgroundColor: '#E8F7EF',
        color: '#34A853',
        border: 'none'
    },

    yes: {
        backgroundColor: '#E8F7EF',
        color: '#34A853',
        border: 'none'
    },

    close: {
        backgroundColor: '#FDEDED',
        color: '#EA4335',
        border: 'none'
    },

    declined: {
        backgroundColor: '#FDEDED',
        color: '#EA4335',
        border: 'none'
    },

    no: {
        backgroundColor: '#FDEDED',
        color: '#EA4335',
        border: 'none'
    },

    enough: {
        backgroundColor: '#E8F7EF',
        color: '#34A853',
        border: 'none'
    },
    reoder: {
        backgroundColor: '#FEF8E8',
        color: '#F57C00',
        border: 'black'
    },
    minimum: {
        backgroundColor: '#FCC6C7',
        color: '#F70406',
        border: 'none'
    },
    outprescrib: {
        backgroundColor: '#FEF8E8',
        color: '#34A853',
        border: 'none'
    }
};

// Define sizes for the chip
const chipSizes = {
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
const StatusChip = ({ label, size = 'small' }) => {
    // Get the theme for the label, default to nil
    const theme = chipThemes[label.toLowerCase()] || chipThemes['nil'];
    // Get the size for the chip, default to small
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

export default StatusChip;
