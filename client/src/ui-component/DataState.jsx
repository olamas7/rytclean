import PropTypes from 'prop-types';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { LdButton } from 'utils/myButtons';

const DataState = ({ error, title = 'No records yet', description, onRetry, action }) => (
  <Box sx={{ p: { xs: 2, sm: 4 }, textAlign: 'center' }}>
    {error ? (
      <Alert severity="error" sx={{ textAlign: 'left' }}>
        <Stack spacing={1} alignItems="flex-start">
          <Typography variant="body2">{error}</Typography>
          {onRetry && (
            <LdButton variant="outlined" color="error" onClick={onRetry}>
              Try again
            </LdButton>
          )}
        </Stack>
      </Alert>
    ) : (
      <Stack spacing={1} alignItems="center" role="status">
        <Typography variant="h4">{title}</Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
        {action}
      </Stack>
    )}
  </Box>
);

DataState.propTypes = {
  error: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
  onRetry: PropTypes.func,
  action: PropTypes.node
};

export default DataState;
