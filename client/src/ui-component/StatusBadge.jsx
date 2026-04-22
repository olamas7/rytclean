import PropTypes from 'prop-types';
import { Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

const STATUS_TONE_MAP = {
    active: 'success',
    paid: 'success',
    completed: 'success',
    resolved: 'success',
    available: 'secondary',
    assigned: 'warning',
    pending: 'warning',
    'in progress': 'warning',
    scheduled: 'info',
    'on the way': 'info',
    'on-route': 'info',
    open: 'info',
    failed: 'error',
    rejected: 'error',
    missed: 'error',
    inactive: 'neutral',
    'off-duty': 'neutral'
};

const StatusBadge = ({ label, size = 'small' }) => {
    const theme = useTheme();
    const normalized = String(label || '').toLowerCase();
    const tone = STATUS_TONE_MAP[normalized] || 'neutral';
    const palette =
        tone === 'neutral'
            ? {
                  bg: theme.palette.grey[200],
                  color: theme.palette.grey[700],
                  border: alpha(theme.palette.grey[700], 0.2)
              }
            : {
                  bg: alpha(theme.palette[tone].main, 0.12),
                  color: theme.palette[tone].dark,
                  border: alpha(theme.palette[tone].main, 0.25)
              };

    return (
        <Chip
            label={label}
            size={size}
            sx={{
                textTransform: 'capitalize',
                fontWeight: 600,
                backgroundColor: palette.bg,
                color: palette.color,
                border: '1px solid',
                borderColor: palette.border
            }}
        />
    );
};

StatusBadge.propTypes = {
    label: PropTypes.string,
    size: PropTypes.oneOf(['small', 'medium'])
};

export default StatusBadge;
