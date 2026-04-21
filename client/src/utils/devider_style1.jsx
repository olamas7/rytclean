import React from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types'; // Import PropTypes
// material-ui
import { useTheme } from '@mui/material/styles';
import { Box, Button, Divider, Grid } from '@mui/material';

const DividerStyle1 = ({ titles }) => {
  const theme = useTheme();
  const customization = useSelector((state) => state.customization);

  return (
    <Grid item xs={12}>
      <Box sx={{ alignItems: 'center', display: 'flex' }}>
        <Divider sx={{ flexGrow: 1 }} orientation="horizontal" />
        <Button
          variant="outlined"
          sx={{
            cursor: 'unset',
            m: 2,
            py: 0.5,
            px: 7,
            borderColor: `${theme.palette.grey[100]} !important`,
            color: `${theme.palette.grey[900]}!important`,
            fontWeight: 500,
            borderRadius: `${customization.borderRadius}px`
          }}
          disableRipple
          disabled
        >
          {titles}
        </Button>
        <Divider sx={{ flexGrow: 1 }} orientation="horizontal" />
      </Box>
    </Grid>
  );
};

// Define PropTypes
DividerStyle1.propTypes = {
  titles: PropTypes.string.isRequired // Specify the type and make it required
};

export default DividerStyle1;
