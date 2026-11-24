import React, { useState, useEffect } from 'react';
import { Grid, Typography, Paper, CircularProgress, Box, Divider, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import MainCard from 'ui-component/cards/MainCard';
import axios from 'axios';

import { SnackError } from 'utils/Snackbars';
import MediumDialog from 'views/Hooks/dialogMedium';
import ChangePassword from './ChangePassword';
import UpdateProfile from './UpdateProfile';

const StyledLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 'bold',
  fontSize: '0.9rem'
}));

const StyledValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.secondary.dark,
  fontSize: '1.1rem',
  marginBottom: theme.spacing(1)
}));

const UserProfile = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openChangePasswordDialog, setOpenChangePasswordDialog] = useState(false);
  const [openUpdateProfileDialog, setOpenUpdateProfileDialog] = useState(false);

  const handleOpenChangePasswordDialog = () => {
    setOpenChangePasswordDialog(true);
  };

  const handleCloseChangePasswordDialog = () => {
    setOpenChangePasswordDialog(false);
  };

  const handleOpenUpdateProfileDialog = () => {
    setOpenUpdateProfileDialog(true);
  };

  const handleCloseUpdateProfileDialog = () => {
    setOpenUpdateProfileDialog(false);
    fetchUserProfile(); // Re-fetch user data after update
  };

  const fetchUserProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const username = localStorage.getItem('userId');
      if (!username) {
        setError('Phone number not found in local storage.');
        setLoading(false);
        return;
      }
      const response = await axios.get(`/api/login/user-profile/${username}`);
      setUserData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch user profile.');
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  return (
    <MainCard title={<Typography variant="h3">User Profile</Typography>}>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />

      {loading ? (
        <Grid container justifyContent="center" alignItems="center" style={{ height: '200px' }}>
          <CircularProgress />
        </Grid>
      ) : userData ? (
        <Paper elevation={3} sx={{ p: 3, maxWidth: 600, margin: 'auto', borderRadius: '12px', overflow: 'hidden' }}>
          <Box sx={{ bgcolor: '#e3f2fd', p: 2, mb: 2, borderRadius: '8px' }}>
            <Typography variant="h4" gutterBottom sx={{ color: '#1a237e' }}>
              Personal Information
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <StyledLabel>Phone Number:</StyledLabel>
              <StyledValue>{userData.username}</StyledValue>
            </Grid>
            <Grid item xs={12} sm={6}>
              <StyledLabel>Full Name:</StyledLabel>
              <StyledValue>{userData.fullname}</StyledValue>
            </Grid>
            <Grid item xs={12} sm={6}>
              <StyledLabel>Gender:</StyledLabel>
              <StyledValue>{userData.gender}</StyledValue>
            </Grid>
            <Grid item xs={12} sm={6}>
              <StyledLabel>Phone:</StyledLabel>
              <StyledValue>{userData.phone}</StyledValue>
            </Grid>
            <Grid item xs={12} sm={6}>
              <StyledLabel>Email:</StyledLabel>
              <StyledValue>{userData.email}</StyledValue>
            </Grid>
            <Grid item xs={12} sm={6}>
              <StyledLabel>Hostel:</StyledLabel>
              <StyledValue>{userData.hostel}</StyledValue>
            </Grid>
            <Grid item xs={12} sm={6}>
              <StyledLabel>Room:</StyledLabel>
              <StyledValue>{userData.room}</StyledValue>
            </Grid>
            <Grid item xs={12} sx={{ mt: 3, textAlign: 'center' }}>
              <Button variant="contained" color="secondary" onClick={handleOpenChangePasswordDialog} sx={{ mr: 2 }}>
                Change Password
              </Button>
              <Button variant="contained" color="primary" onClick={handleOpenUpdateProfileDialog}>
                Update Info
              </Button>
            </Grid>
          </Grid>
        </Paper>
      ) : (
        <Typography variant="h6" color="error" align="center">
          User data not available.
        </Typography>
      )}

      <MediumDialog open={openChangePasswordDialog} onClose={handleCloseChangePasswordDialog}>
        <ChangePassword username={userData?.username} onClose={handleCloseChangePasswordDialog} />
      </MediumDialog>

      {userData && (
        <MediumDialog open={openUpdateProfileDialog} onClose={handleCloseUpdateProfileDialog}>
          <UpdateProfile userData={userData} onClose={handleCloseUpdateProfileDialog} />
        </MediumDialog>
      )}
    </MainCard>
  );
};

export default UserProfile;
