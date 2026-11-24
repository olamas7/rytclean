import React, { useState, useEffect } from 'react';
import { Grid, Button, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { RHFTextField, RHFAutocomplete } from 'utils/controls/ReactHookForms';
import axios from 'axios';

import { SnackSuccess, SnackError } from 'utils/Snackbars';

const AddClient = ({ onClose }) => {
  const { control, handleSubmit } = useForm();
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [hostels, setHostels] = useState([]);

  useEffect(() => {
    const fetchHostels = async () => {
      try {
        const response = await axios.get('/api/login/hostels');
        if (response.data.code === 1) {
          const transformed = response.data.data.map((h) => ({
            id: h.id,
            label: h.name
          }));
          setHostels(transformed);
        }
      } catch (err) {
        console.error('Error fetching hostels:', err);
      }
    };
    fetchHostels();
  }, []);

  const genderOptions = [
    { id: 'Male', label: 'Male' },
    { id: 'Female', label: 'Female' }
  ];

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        username: data.phone,
        gender: data.gender.id,
        hostel: data.hostel.label
      };
      const response = await axios.post(`/api/api/agents/add-client`, payload);
      setSuccess(response.data.message);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add client.');
    }
  };

  return (
    <Grid container spacing={2} sx={{ p: 2 }}>
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <Grid item xs={12}>
        <Typography variant="h4">Add New Client</Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFTextField
          name="value"
          control={control}
          label="Password"
          type="password"
          rules={{
            required: 'Password is required',
            validate: (value) => !/\s/.test(value) || 'Password cannot contain spaces'
          }}
        />
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
        <RHFTextField
          name="phone"
          control={control}
          label="Phone Number"
          inputProps={{ maxLength: 10 }}
          onInput={(e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
          }}
          rules={{
            required: 'Phone number is required',
            pattern: {
              value: /^0\d{9}$/,
              message: 'Phone number must start with 0 and be exactly 10 digits'
            }
          }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFTextField name="email" control={control} label="Email" rules={{ required: 'Email is required' }} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFAutocomplete name="hostel" control={control} options={hostels} label="Hostel" rules={{ required: 'Hostel is required' }} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFTextField name="room" control={control} label="Room" />
      </Grid>
      <Grid item xs={12}>
        <Button variant="contained" color="primary" onClick={handleSubmit(onSubmit)}>
          Save Client
        </Button>
      </Grid>
    </Grid>
  );
};

export default AddClient;
