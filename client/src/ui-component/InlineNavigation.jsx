import PropTypes from 'prop-types';
import { ArrowBack } from '@mui/icons-material';
import { Box } from '@mui/material';
import { LdButton } from 'utils/myButtons';

export default function InlineNavigation({ active = false, onBack, parentLabel = '', disabled = false }) {
    if (!active || !onBack) return null;
    const label = parentLabel ? `Back to ${parentLabel}` : 'Back';
    return <Box component="nav" aria-label="Inline section navigation" sx={{ mb: 2 }}>
        <LdButton variant="outlined" startIcon={<ArrowBack />} onClick={onBack} disabled={disabled} tooltip={disabled ? 'Please wait for the current save to finish' : ''}>{label}</LdButton>
    </Box>;
}
InlineNavigation.propTypes = { active: PropTypes.bool, onBack: PropTypes.func, parentLabel: PropTypes.string, disabled: PropTypes.bool };
