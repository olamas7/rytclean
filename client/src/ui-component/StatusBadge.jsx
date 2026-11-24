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
    'off-duty': 'neutral',
    'needs review': 'warning',
    paused: 'neutral',
    unpaid: 'warning',
    'partially paid': 'warning',
    overdue: 'error',
    voided: 'neutral',
    reversed: 'neutral'
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
            icon={<span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'currentColor' }} />}
            size={size}
            sx={{
                textTransform: 'capitalize',
                fontWeight: 600,
                height: size === 'small' ? 23 : 28,
                fontSize: size === 'small' ? '0.625rem' : '0.75rem',
                borderRadius: '999px',
                backgroundColor: palette.bg,
                color: palette.color,
                border: 0,
                '& .MuiChip-icon': { color: 'inherit', ml: 1, mr: 0 },
                '& .MuiChip-label': { pl: 0.75, pr: 1 }
            }}
        />
    );
};

StatusBadge.propTypes = {
    label: PropTypes.string,
    size: PropTypes.oneOf(['small', 'medium'])
};

export default StatusBadge;
