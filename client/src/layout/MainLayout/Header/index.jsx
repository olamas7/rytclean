import PropTypes from 'prop-types';

// material-ui
import { useTheme } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { Chip, Grid, Typography } from '@mui/material';
import { Logout } from '@mui/icons-material';

// project imports
import LogoSection from '../LogoSection';

// assets
import { IconMenu2 } from '@tabler/icons-react';
// ==============================|| MAIN NAVBAR / HEADER ||============================== //

const Header = ({ handleLeftDrawerToggle }) => {
  const theme = useTheme();

  const handleLogout = async () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <>
      {/* logo & toggler button */}
      <Box
        sx={{
          width: 228,
          display: 'flex',
          alignItems: 'center',
          [theme.breakpoints.down('md')]: {
            width: 'auto'
          }
        }}
      >
        <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, flexGrow: 1 }}>
          <LogoSection />
        </Box>
        <ButtonBase sx={{ borderRadius: '8px', overflow: 'hidden' }}>
          <Avatar
            variant="rounded"
            sx={{
              ...theme.typography.commonAvatar,
              ...theme.typography.mediumAvatar,
              transition: 'all .2s ease-in-out',
              background: theme.palette.secondary.light,
              color: theme.palette.secondary.dark,
              '&:hover': {
                background: theme.palette.secondary.dark,
                color: theme.palette.secondary.light
              }
            }}
            onClick={handleLeftDrawerToggle}
            color="inherit"
          >
            <IconMenu2 stroke={1.5} size="1.3rem" />
          </Avatar>
        </ButtonBase>
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Grid
        container
        direction="column"
        alignItems="flex-end" // Aligns all items to the right
        mr={2}
        sx={{ width: 'auto' }}
      >
        <Typography variant="h4" color="#6B5218">
          {localStorage.getItem('userMName') || 'User'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '10px' }}>
          {localStorage.getItem('admin_role') || 'Member'}
        </Typography>
      </Grid>

      <Chip
        label="Logout"
        icon={<Logout sx={{ color: 'white !important' }} />}
        onClick={handleLogout}
        sx={{
          backgroundColor: 'primary.main',
          color: 'white',
          '&:hover': {
            backgroundColor: 'darkred' // Change background to red on hover
          }
        }}
      />
    </>
  );
};

Header.propTypes = {
  handleLeftDrawerToggle: PropTypes.func
};

export default Header;
