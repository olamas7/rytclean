import React from 'react';
import { Grid, Button, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { RHFTextField, RHFAutocomplete } from 'utils/controls/ReactHookForms';
import axios from 'axios';

import { SnackSuccess, SnackError } from 'utils/Snackbars';

const UpdateProfile = ({ userData, onClose }) => {
  const { control, handleSubmit, setValue } = useForm({
    defaultValues: {
      username: userData.username,
      fullname: userData.fullname,
      gender: userData.gender ? { id: userData.gender, label: userData.gender } : null,
      phone: userData.phone,
      email: userData.email,
      hostel: userData.hostel ? { id: userData.hostel, label: userData.hostel } : null,
      room: userData.room
    }
  });
  const [success, setSuccess] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [hostels, setHostels] = React.useState([]);

  React.useEffect(() => {
    const fetchHostels = async () => {
      try {
        const response = await axios.get('/api/login/hostels');
        if (response.data.code === 1) {
          const transformed = response.data.data.map((h) => ({
            id: h.id,
            label: h.name
          }));

          const currentHostel = userData.hostel ? { id: userData.hostel, label: userData.hostel } : null;
          const selectedHostel = transformed.find((h) => h.label === userData.hostel || String(h.id) === String(userData.hostel));

          setHostels(selectedHostel || !currentHostel ? transformed : [currentHostel, ...transformed]);
          setValue('hostel', selectedHostel || currentHostel);
        }
      } catch (err) {
        console.error('Error fetching hostels:', err);
      }
    };
    fetchHostels();
  }, [setValue, userData.hostel]);

  const genderOptions = [
    { id: 'Male', label: 'Male' },
    { id: 'Female', label: 'Female' }
  ];

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        gender: data.gender.id || data.gender,
        hostel: data.hostel.label || data.hostel
      };
      const response = await axios.put(`/api/login/update-profile/${userData.username}`, payload);
      if (response.data.username) {
        localStorage.setItem('userId', response.data.username);
      }
      setSuccess(response.data.message);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    }
  };

  return (
    <Grid container spacing={2} sx={{ p: 2 }}>
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <Grid item xs={12}>
        <Typography variant="h4">Update Profile</Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFTextField name="username" control={control} label="Phone Number" disabled />
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFTextField name="fullname" control={control} label="Full Name" rules={{ required: 'Full name is required' }} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFAutocomplete
          name="gender"
          control={control}
          options={genderOptions}
          label="Gender"
          rules={{ required: 'Gender is required' }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFTextField name="phone" control={control} label="Phone Number" disabled />
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFTextField name="email" control={control} label="Email" rules={{ required: 'Email is required' }} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFAutocomplete
          name="hostel"
          control={control}
          options={hostels}
          label="Hostel"
          rules={{ required: 'Hostel is required' }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFTextField name="room" control={control} label="Room" />
      </Grid>
      <Grid item xs={12}>
        <Button variant="contained" color="primary" onClick={handleSubmit(onSubmit)}>
          Update Info
        </Button>
      </Grid>
    </Grid>
  );
};

export default UpdateProfile;
