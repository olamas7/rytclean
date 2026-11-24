import React from 'react';
import { Grid, Button, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { RHFTextField, RHFAutocomplete } from 'utils/controls/ReactHookForms';
import axios from 'axios';

import { SnackSuccess, SnackError } from 'utils/Snackbars';

const EditClient = ({ client, onClose }) => {
  const { control, handleSubmit, setValue } = useForm({
    defaultValues: {
      ...client,
      gender: client.gender ? { id: client.gender, label: client.gender } : null,
      hostel: client.hostel ? { id: client.hostel, label: client.hostel } : null
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

          const currentHostel = client.hostel ? { id: client.hostel, label: client.hostel } : null;
          const selectedHostel = transformed.find((h) => h.label === client.hostel || String(h.id) === String(client.hostel));

          setHostels(selectedHostel || !currentHostel ? transformed : [currentHostel, ...transformed]);
          setValue('hostel', selectedHostel || currentHostel);
        }
      } catch (err) {
        console.error('Error fetching hostels:', err);
      }
    };
    fetchHostels();
  }, [client.hostel, setValue]);

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
      const response = await axios.put(`/api/api/agents/update-client/${client.username}`, payload);
      setSuccess(response.data.message);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update client.');
    }
  };

  return (
    <Grid container spacing={2} sx={{ p: 2 }}>
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <Grid item xs={12}>
        <Typography variant="h4">Edit Client</Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFTextField name="username" control={control} label="Current Phone Number" rules={{ required: 'Phone number is required' }} disabled />
      </Grid>
      <Grid item xs={12} sm={6}>
        <RHFTextField
          name="value"
          control={control}
          label="Password"
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
          Update Client
        </Button>
      </Grid>
    </Grid>
  );
};

export default EditClient;
