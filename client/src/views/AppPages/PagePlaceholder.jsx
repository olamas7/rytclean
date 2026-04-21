import PropTypes from 'prop-types';
import { Box, Grid, Paper, Typography } from '@mui/material';

const PagePlaceholder = ({ title, section }) => {
  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        {section} screen scaffold is ready. Build out widgets and data views using mock services.
      </Typography>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h4" sx={{ mb: 1 }}>
              UI Scaffold
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Route and menu wiring complete for this page.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h4" sx={{ mb: 1 }}>
              Mock Ready
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use `src/services/mockApi` and `src/mocks/data` for local-first implementation.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h4" sx={{ mb: 1 }}>
              Next Build
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add stats, filters, forms, and tables based on `info.txt` acceptance items.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

PagePlaceholder.propTypes = {
  title: PropTypes.string.isRequired,
  section: PropTypes.string.isRequired
};

export default PagePlaceholder;
