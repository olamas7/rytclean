import React from 'react';
import { Grid, Button, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import axios from 'axios';

import { SnackSuccess, SnackError } from 'utils/Snackbars';

const ChangePassword = ({ username, onClose }) => {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm();
  const [success, setSuccess] = React.useState(null);
  const [error, setError] = React.useState(null);

  const newPassword = watch('newPassword');

  const onSubmit = async (data) => {
    try {
      const payload = {
        username: username,
        currentPassword: data.oldPassword, // Map oldPassword form field to currentPassword API field
        newPassword: data.newPassword
      };
      const response = await axios.post(`/api/api/wifi/change-password`, payload);
      
      if (response.data.code === 1) {
        setSuccess(response.data.message);
        setTimeout(() => {
           onClose();
        }, 1500);
      } else {
        setError(response.data.message || 'Failed to change password.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password.');
    }
  };

  return (
    <Grid container spacing={2} sx={{ p: 2 }}>
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <Grid item xs={12}>
        <Typography variant="h4">Change Password</Typography>
      </Grid>
      <Grid item xs={12}>
        <RHFTextField
          name="oldPassword"
          control={control}
          label="Previous Password"
          type="password"
          rules={{ required: 'Previous password is required' }}
        />
      </Grid>
      <Grid item xs={12}>
        <RHFTextField
          name="newPassword"
          control={control}
          label="New Password"
          type="password"
          rules={{
            required: 'New password is required',
            validate: (value) => !/\s/.test(value) || 'New password cannot contain spaces'
          }}
        />
      </Grid>
      <Grid item xs={12}>
        <RHFTextField
          name="confirmNewPassword"
          control={control}
          label="Confirm New Password"
          type="password"
          rules={{
            required: 'Confirm new password is required',
            validate: (value) => value === newPassword || 'New passwords do not match'
          }}
        />
      </Grid>
      <Grid item xs={12}>
        <Button variant="contained" color="primary" onClick={handleSubmit(onSubmit)}>
          Change Password
        </Button>
      </Grid>
    </Grid>
  );
};

export default ChangePassword;
