import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { 
    Typography, 
    Box, 
    InputAdornment, 
    Divider, 
    IconButton,
    Stack
} from '@mui/material';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { SnackError, SnackSuccess } from 'utils/Snackbars';
import Axios from 'axios';
import { LdButton } from 'utils/myButtons';
import { 
    PersonOutline, 
    LockOutlined, 
    Visibility,
    VisibilityOff,
    Login
} from '@mui/icons-material';

export default function SimpleLogin() {
  const methods = useForm();
  const { handleSubmit, control } = methods;
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Snackbars
  const [snackMessage, setSnackMessage] = useState('');
  const [openError, setOpenError] = useState(false);
  const [openSuccess, setOpenSuccess] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await Axios.post('/api/login', { 
          username: data.username, 
          password: data.password 
      });

      if (res.data.code === 1) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('userMID', res.data.user.id);
        localStorage.setItem('admin_user', res.data.user.username);
        localStorage.setItem('userMName', res.data.user.fullname);
        localStorage.setItem('admin_role', res.data.user.role);
        setSnackMessage('Login successful. Redirecting...');
        setOpenSuccess(true);
        setTimeout(() => {
          window.location.href = '/dashboard/home';
        }, 700);
      } else {
        setSnackMessage(res.data.message || 'Invalid Credentials.');
        setOpenError(true);
        setLoading(false);
      }
    } catch (err) {
      setSnackMessage('Network error. Please try again.');
      setOpenError(true);
      setLoading(false);
    }
  };

  return (
    <Box>
      <SnackError message={snackMessage} open={openError} setOpen={setOpenError} />
      <SnackSuccess message={snackMessage} open={openSuccess} setOpen={setOpenSuccess} />

      <FormProvider {...methods}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h2" sx={{ fontWeight: 800, mb: 1, color: 'primary.main' }}>
            Welcome Back
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Sign in to continue to your application.
          </Typography>
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={3}>
            <RHFTextField
              name="username"
              label="Username"
              placeholder="Enter your username"
              fullWidth
              control={control}
              rules={{ required: 'Username is required' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutline color="primary" />
                  </InputAdornment>
                )
              }}
            />
            <RHFTextField
              name="password"
              label="Password"
              placeholder="Enter your password"
              fullWidth
              type={showPassword ? 'text' : 'password'}
              control={control}
              rules={{ required: 'Password is required' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined color="primary" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff color="primary" /> : <Visibility color="primary" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Box sx={{ mt: 1 }}>
              <LdButton
                fullWidth
                variant="contained"
                size="large"
                type="submit"
                color="primary"
                sx={{
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: 2,
                  boxShadow: '0 4px 12px rgba(222, 81, 4, 0.3)'
                }}
                loading={loading}
                startIcon={<Login />}
              >
                Sign In
              </LdButton>
            </Box>

            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1.5 }}>
                Secure Access
              </Typography>
            </Divider>
          </Stack>
        </form>
      </FormProvider>
    </Box>
  );
}
