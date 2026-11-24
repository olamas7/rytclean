import React, { useState } from 'react';
import {
  Grid,
  Button,
  Typography,
  Box,
  useTheme,
  TextField,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import { useForm, FormProvider } from 'react-hook-form';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import axios from 'axios';
import { SnackError, SnackSuccess } from 'utils/Snackbars';
import SubCard from 'ui-component/cards/SubCard';
import { useNavigate } from 'react-router-dom';
import { Person as PersonIcon, VpnKey as OtpIcon, LockOutlined as PasswordIcon } from '@mui/icons-material';

const ForgotPassword = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const methods = useForm();
  const { control, handleSubmit, watch } = methods;

  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: New Password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const username = watch('username');
  const otp = watch('otp');

  const onRequestOtp = async (data) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/login/forgot-password', { username: data.username });
      if (res.data.code === 1) {
        setSuccess(res.data.message);
        setStep(2);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request OTP.');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (data) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/login/verify-otp', { username, otp: data.otp });
      if (res.data.code === 1) {
        setSuccess(res.data.message);
        setStep(3);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async (data) => {
    if (data.newPassword !== data.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/login/reset-password', {
        username,
        otp,
        newPassword: data.newPassword
      });
      if (res.data.code === 1) {
        setSuccess(res.data.message);
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />
      
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
        <SubCard sx={{ maxWidth: 450, width: '100%', p: 3, borderRadius: 2, boxShadow: theme.shadows[5] }}>
          <Typography variant="h3" align="center" gutterBottom sx={{ mb: 3 }}>
            Reset Password
          </Typography>

          <FormProvider {...methods}>
            {step === 1 && (
              <form onSubmit={handleSubmit(onRequestOtp)}>
                <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 3 }}>
                  Enter your phone number and we'll send an OTP to it.
                </Typography>
                <RHFTextField
                  name="username"
                  control={control}
                  label="Phone Number"
                  rules={{
                    required: 'Phone number is required',
                    pattern: { value: /^0\d{9}$/, message: 'Phone number must start with 0 and be exactly 10 digits' }
                  }}
                  inputProps={{ maxLength: 10 }}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon color="primary" />
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={loading}
                  sx={{ mt: 3 }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Send OTP'}
                </Button>
                <Button fullWidth variant="text" sx={{ mt: 1 }} onClick={() => navigate('/login')}>
                  Back to Login
                </Button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit(onVerifyOtp)}>
                <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 3 }}>
                  Please enter the 6-digit OTP sent to your phone.
                </Typography>
                <RHFTextField
                  name="otp"
                  control={control}
                  label="OTP Code"
                  rules={{ required: 'OTP is required', pattern: { value: /^\d{6}$/, message: 'OTP must be 6 digits' } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <OtpIcon color="primary" />
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={loading}
                  sx={{ mt: 3 }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify OTP'}
                </Button>
                <Button fullWidth variant="text" sx={{ mt: 1 }} onClick={() => setStep(1)}>
                  Resend OTP / Change Phone Number
                </Button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleSubmit(onResetPassword)}>
                <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 3 }}>
                  OTP Verified. Please set your new password.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <RHFTextField
                      name="newPassword"
                      control={control}
                      label="New Password"
                      type="password"
                      rules={{ required: 'New password is required' }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PasswordIcon color="primary" />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <RHFTextField
                      name="confirmPassword"
                      control={control}
                      label="Confirm New Password"
                      type="password"
                      rules={{ required: 'Please confirm your password' }}
                    />
                  </Grid>
                </Grid>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={loading}
                  sx={{ mt: 3 }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Reset Password'}
                </Button>
              </form>
            )}
          </FormProvider>
        </SubCard>
      </Box>
    </>
  );
};

export default ForgotPassword;
