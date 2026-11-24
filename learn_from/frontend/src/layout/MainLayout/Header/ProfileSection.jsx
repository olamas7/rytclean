import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

// material-ui
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Chip,
  ClickAwayListener,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Popper,
  Stack,
  Typography
} from '@mui/material';

// third-party
import PerfectScrollbar from 'react-perfect-scrollbar';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import Transitions from 'ui-component/extended/Transitions';
import profileMenuItems from 'menu-items/profile_menu';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

// assets

import localforage from 'localforage';

// ==============================|| PROFILE MENU ||============================== //

const ProfileSection = () => {
  const theme = useTheme();
  const customization = useSelector((state) => state.customization);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  /**
   * anchorRef is used on different componets and specifying one type leads to other components throwing an error
   * */
  const anchorRef = useRef(null);

  const handleLogout = async () => {
    localStorage.clear();
    localforage.clear();
    window.location.href = '/login';
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === true && open === false) {
      anchorRef.current.focus();
    }
    prevOpen.current = open;
  }, [open]);

  return (
    <>
      <Chip
        sx={{
          height: '48px',
          alignItems: 'center',
          borderRadius: '16px',
          transition: 'all .2s ease-in-out',
          px: 0.5,
          borderColor: open ? theme.palette.primary.main : theme.palette.divider,
          backgroundColor: open ? theme.palette.primary.light : theme.palette.background.paper,
          boxShadow: open ? theme.shadows[2] : 'none',
          '&[aria-controls="menu-list-grow"], &:hover': {
            borderColor: theme.palette.primary.main,
            background: `${theme.palette.primary.light}!important`,
            color: theme.palette.primary.main
          },
          '& .MuiChip-label': {
            lineHeight: 1,
            pr: 1.25
          }
        }}
        icon={
          <Box
            sx={{
              width: 34,
              height: 34,
              ml: '6px !important',
              mr: '8px !important',
              borderRadius: '12px',
              display: 'grid',
              placeItems: 'center',
              color: theme.palette.primary.main,
              backgroundColor: theme.palette.primary.light
            }}
          >
            <AccountCircleOutlinedIcon fontSize="small" />
          </Box>
        }
        label={
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left' }}>
              <Typography variant="subtitle2" sx={{ lineHeight: 1.1, maxWidth: 140 }} noWrap>
                {localStorage.getItem('fullname') || 'Account'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }} noWrap>
                Account menu
              </Typography>
            </Box>
            <KeyboardArrowDownIcon sx={{ fontSize: 18, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }} />
          </Stack>
        }
        variant="outlined"
        ref={anchorRef}
        aria-controls={open ? 'menu-list-grow' : undefined}
        aria-haspopup="true"
        onClick={handleToggle}
        color="primary"
      />
      <Popper
        placement="bottom-end"
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        popperOptions={{
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 14]
              }
            }
          ]
        }}
      >
        {({ TransitionProps }) => (
          <Transitions in={open} {...TransitionProps}>
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MainCard border={false} elevation={16} content={false} boxShadow shadow={theme.shadows[16]}>
                  <Box sx={{ p: 2, pb: 0 }}>
                    <Stack>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="h4">{localStorage.getItem('fullname')},</Typography>
                        <Typography component="span" variant="h4" sx={{ fontWeight: 400 }}>
                          {localStorage.getItem('userId')}
                        </Typography>
                      </Stack>
                      <Typography variant="subtitle2">Current Plan: {localStorage.getItem('job')}</Typography>
                    </Stack>
                    <Divider />
                  </Box>
                  <PerfectScrollbar style={{ height: '100%', maxHeight: 'calc(100vh - 250px)', overflowX: 'hidden' }}>
                    <Box sx={{ p: 2, pt: 0 }}>
                      <List
                        component="nav"
                        sx={{
                          width: '100%',
                          maxWidth: 350,
                          minWidth: 300,
                          backgroundColor: theme.palette.background.paper,
                          borderRadius: '10px',
                          [theme.breakpoints.down('md')]: {
                            minWidth: '100%'
                          },
                          '& .MuiListItemButton-root': {
                            mt: 0.5
                          }
                        }}
                      >
                        {profileMenuItems.map((item) => (
                          <ListItemButton
                            key={item.id}
                            sx={{ borderRadius: `${customization.borderRadius}px` }}
                            onClick={item.id === 'logout' ? handleLogout : () => navigate(item.route)}
                          >
                            <ListItemIcon>
                              <item.icon stroke={1.5} size="1.3rem" />
                            </ListItemIcon>
                            <ListItemText primary={<Typography variant="body2">{item.title}</Typography>} />
                          </ListItemButton>
                        ))}
                      </List>
                    </Box>
                  </PerfectScrollbar>
                </MainCard>
              </ClickAwayListener>
            </Paper>
          </Transitions>
        )}
      </Popper>
    </>
  );
};

export default ProfileSection;
