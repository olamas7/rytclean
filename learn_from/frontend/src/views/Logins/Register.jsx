import React, { useState, useEffect } from 'react';
import {
  Grid,
  Button,
  Typography,
  Box,
  useTheme,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { useForm, FormProvider } from 'react-hook-form';
import { RHFTextField, RHFAutocomplete } from 'utils/controls/ReactHookForms';
import axios from 'axios';

import { SnackError } from 'utils/Snackbars';
import SubCard from 'ui-component/cards/SubCard';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const theme = useTheme();
  const defaultHostel = { id: 'None', label: 'None' };
  const methods = useForm({
    defaultValues: {
      hostel: defaultHostel
    }
  });
  const { control, handleSubmit, watch, setValue } = methods;
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // State for hostels
  const [hostels, setHostels] = useState([]);

  // State for CAPTCHA
  const [captchaDialogOpen, setCaptchaDialogOpen] = useState(false);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [formData, setFormData] = useState(null);

  // State for Success Dialog
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);

  useEffect(() => {
    const fetchHostels = async () => {
      try {
        const response = await axios.get('/api/login/hostels');
        if (response.data.code === 1) {
          const transformed = response.data.data.map((h) => ({
            id: h.id,
            label: h.name
          }));
          const hasNone = transformed.some((h) => h.label.toLowerCase() === 'none');
          const hostelOptions = hasNone ? transformed : [defaultHostel, ...transformed];
          setHostels(hostelOptions);

          const noneHostel = hostelOptions.find((h) => h.label.toLowerCase() === 'none');
          setValue('hostel', noneHostel || defaultHostel);
        }
      } catch (err) {
        console.error('Error fetching hostels:', err);
      }
    };
    fetchHostels();
  }, [setValue]);

  const password = watch('password');

  const genderOptions = [
    { id: 'Male', label: 'Male' },
    { id: 'Female', label: 'Female' }
  ];

  const handlePrimarySubmit = (data) => {
    setFormData(data);
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setCaptchaCode(code);
    setCaptchaError('');
    setCaptchaInput('');
    setCaptchaDialogOpen(true);
  };

  const submitRegistration = async (data) => {
    try {
      const payload = {
        ...data,
        username: data.phone,
        gender: data.gender.id,
        hostel: data.hostel.label
      };
      const response = await axios.post(`/api/login/register`, payload);
      if (response.data.code === 1) {
        setSuccessDialogOpen(true);
      } else {
        setError(response.data.message || 'An unknown error occurred.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register.');
    }
  };

  const handleCaptchaVerify = () => {
    if (captchaInput === captchaCode) {
      setCaptchaDialogOpen(false);
      submitRegistration(formData);
    } else {
      setCaptchaError('Incorrect code. Please try again.');
    }
  };

  return (
    <>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <Box
        sx={{
          backgroundColor: theme.palette.grey[100],
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: { xs: 2, sm: 3 }
        }}
      >
        <SubCard sx={{ maxWidth: 900, width: '100%', p: 3, m: 2, borderRadius: 2, boxShadow: theme.shadows[5] }}>
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(handlePrimarySubmit)}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h4">Register New Account On KayFi</Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <RHFTextField name="fullname" control={control} label="Full Name *" rules={{ required: 'Full name is required' }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <RHFAutocomplete
                    name="gender"
                    control={control}
                    options={genderOptions}
                    label="Gender *"
                    rules={{ required: 'Gender is required' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <RHFTextField
                    name="phone"
                    control={control}
                    label="Phone Number *"
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
                  <RHFTextField name="email" control={control} label="Email *" rules={{ required: 'Email is required' }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <RHFAutocomplete
                    name="hostel"
                    control={control}
                    options={hostels}
                    label="Hostel *"
                    rules={{ required: 'Hostel is required' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <RHFTextField name="room" control={control} label="Room" />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <RHFTextField
                    name="password"
                    control={control}
                    label="Password *"
                    type="password"
                    rules={{
                      required: 'Password is required',
                      validate: (value) => !/\s/.test(value) || 'Password cannot contain spaces'
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <RHFTextField
                    name="confirmPassword"
                    control={control}
                    label="Confirm Password *"
                    type="password"
                    rules={{
                      required: 'Please confirm password',
                      validate: (value) => value === password || 'Passwords do not match'
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button variant="contained" color="primary" type="submit">
                    Register
                  </Button>
                  <Button variant="text" color="primary" onClick={() => navigate('/login')} sx={{ ml: 2 }}>
                    Back to Login
                  </Button>
                </Grid>
              </Grid>
            </form>
          </FormProvider>
        </SubCard>
      </Box>

      {/* CAPTCHA Dialog */}
      <Dialog open={captchaDialogOpen} onClose={() => setCaptchaDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Human Verification</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} justifyContent="center">
            <Grid item xs={12}>
              <Typography variant="body1" align="center">
                Please enter the 4-digit code below to proceed.
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="h2"
                align="center"
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.grey[200],
                  borderRadius: 1,
                  letterSpacing: '0.5em',
                  userSelect: 'none'
                }}
              >
                {captchaCode}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                variant="outlined"
                label="Verification Code"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                error={!!captchaError}
                helperText={captchaError}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCaptchaVerify();
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCaptchaDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCaptchaVerify}>
            Verify & Register
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onClose={() => navigate('/login')} maxWidth="xs" fullWidth>
        <DialogTitle>Registration Successful</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: theme.palette.success.main }}>
            Your registration was successful. Click on the button below to login.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => navigate('/login')}>
            Login
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Register;
