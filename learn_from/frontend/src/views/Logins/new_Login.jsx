import React, { useState } from 'react';
import { Box, Button, Card, Divider, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import PhoneIphoneOutlinedIcon from '@mui/icons-material/PhoneIphoneOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WifiRoundedIcon from '@mui/icons-material/WifiRounded';
import kayFiLogo from 'assets/images/kaylogo.png';
import { SnackError, SnackSuccess } from 'utils/Snackbars';
import Axios from 'axios';
import { LdButton } from 'utils/controls/myButtons';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [openSnackError, setOpenSnackError] = useState(false);
  const [openSnackSuccess, setOpenSnackSuccess] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event?.preventDefault();
    const loginPhone = username.trim();
    if (!username || !password) return;
    if (!/^0\d{9}$/.test(loginPhone)) {
      setSnackMessage('Phone number must start with 0 and be exactly 10 digits.');
      setOpenSnackError(true);
      return;
    }

    setLoading(true);
    try {
      const res = await Axios.post(`/api/login/auth`, { username: loginPhone, password });
      if (res.data.code === 1) {
        setSnackMessage('Login successful.');
        setOpenSnackSuccess(true);

        const loggedInUsername = res.data.username || loginPhone;
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('userPermissions', res.data.access);
        localStorage.setItem('userId', loggedInUsername);
        localStorage.setItem('loginExpiresAt', String(Date.now() + (res.data.expiresInMs || 7 * 24 * 60 * 60 * 1000)));

        navigate('/app');
      } else {
        setSnackMessage(res.data.message || 'Invalid credentials.');
        setOpenSnackError(true);
      }
    } catch (error) {
      setSnackMessage(error.response?.data?.message || 'Network error. Try again.');
      setOpenSnackError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SnackError message={snackMessage} open={openSnackError} setOpen={setOpenSnackError} />
      <SnackSuccess message={snackMessage} open={openSnackSuccess} setOpen={setOpenSnackSuccess} />
      <Box
        sx={{
          background: {
            xs: 'linear-gradient(180deg, #06223d 0%, #0b5794 38%, #f6f9ff 38%, #f6f9ff 100%)',
            md: 'radial-gradient(circle at top left, rgba(25, 118, 210, 0.20), transparent 34%), linear-gradient(135deg, #071529 0%, #0b2f50 48%, #f7fbff 48%, #eef6ff 100%)'
          },
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: { xs: 'flex-start', md: 'center' },
          p: { xs: 0, md: 3 },
          position: 'relative',
          overflow: 'hidden',
          pb: { xs: 4, md: 3 }
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            width: 280,
            height: 280,
            borderRadius: '50%',
            right: { xs: -140, md: 80 },
            top: { xs: -120, md: 80 },
            bgcolor: 'rgba(255,255,255,0.16)',
            filter: 'blur(1px)'
          }}
        />

        <Card
          elevation={18}
          sx={{
            width: '100%',
            maxWidth: 1040,
            minHeight: { xs: '100vh', md: 'auto' },
            borderRadius: { xs: 0, md: 6 },
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 0.95fr' },
            bgcolor: { xs: 'transparent', md: 'rgba(255,255,255,0.96)' },
            backdropFilter: 'blur(18px)',
            border: { xs: 'none', md: '1px solid rgba(255,255,255,0.65)' },
            boxShadow: { xs: 'none', md: undefined }
          }}
        >
          <Box
            sx={{
              p: { xs: 3, sm: 5, md: 7 },
              color: '#fff',
              minHeight: { xs: 260, md: 560 },
              background: {
                xs: 'linear-gradient(160deg, rgba(3, 23, 45, 0.15), rgba(0, 92, 166, 0.05))',
                md: 'linear-gradient(160deg, rgba(3, 23, 45, 0.96), rgba(0, 92, 166, 0.86))'
              },
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative'
            }}
          >
            <Stack spacing={{ xs: 2, md: 3 }} sx={{ position: 'relative', zIndex: 1 }}>
              <Box component="img" src={kayFiLogo} alt="KayFi Logo" sx={{ width: { xs: 128, md: 150 }, bgcolor: '#fff', p: 1.1, borderRadius: 3 }} />
              <Box>
                <Typography variant="overline" sx={{ color: '#bde3ff', letterSpacing: 2, fontWeight: 800 }}>
                  Unlimited WiFi Access
                </Typography>
                <Typography variant="h1" sx={{ mt: 1, fontSize: { xs: '1.9rem', sm: '2.25rem', md: '3.4rem' }, lineHeight: 1.05, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>
                  Connect. Browse. Renew.
                </Typography>
                <Typography variant="body1" sx={{ mt: 1.5, color: 'rgba(255,255,255,0.86)', maxWidth: 390, lineHeight: 1.55, fontWeight: 500 }}>
                  Use your phone number to manage KayFi unlimited WiFi.
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ position: 'relative', zIndex: 1, mt: { xs: 2.5, md: 4 } }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.16)', display: 'grid', placeItems: 'center' }}>
                <WifiRoundedIcon />
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', fontWeight: 500 }}>
                Secure phone-number login.
              </Typography>
            </Stack>
          </Box>

          <Box
            sx={{
              px: { xs: 2, sm: 5, md: 7 },
              pb: { xs: 3, md: 7 },
              pt: { xs: 0, md: 7 },
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Box
              sx={{
                width: '100%',
                bgcolor: '#fff',
                borderRadius: { xs: 4, md: 0 },
                p: { xs: 3, sm: 4, md: 0 },
                mt: { xs: -4, md: 0 },
                boxShadow: { xs: '0 20px 48px rgba(10, 44, 78, 0.18)', md: 'none' },
                position: 'relative',
                zIndex: 2
              }}
            >
              <Typography variant="h2" sx={{ fontWeight: 900, color: '#10243f', fontSize: { xs: '1.75rem', md: '2.125rem' } }}>
                Welcome Back
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2.5 }}>
                Enter your phone number and password to continue.
              </Typography>

              <Box component="form" method="post" autoComplete="on" onSubmit={handleLogin} noValidate>
                <TextField
                  id="username"
                  name="username"
                  label="Phone Number"
                  type="tel"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                  autoComplete="username"
                  inputProps={{ maxLength: 10, inputMode: 'numeric' }}
                  fullWidth
                  margin="normal"
                  size="medium"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2.5,
                      bgcolor: '#f8fbff'
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIphoneOutlinedIcon color="primary" />
                      </InputAdornment>
                    )
                  }}
                />
                <TextField
                  id="password"
                  name="password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  fullWidth
                  margin="normal"
                  size="medium"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2.5,
                      bgcolor: '#f8fbff'
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon color="primary" />
                      </InputAdornment>
                    )
                  }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                  <Button variant="text" color="primary" sx={{ fontSize: '0.875rem' }} onClick={() => navigate('/forgot-password')}>
                    Forgot Password?
                  </Button>
                </Box>

                <LdButton fullWidth size="large" type="submit" variant="contained" sx={{ mt: 2, py: 1.35, borderRadius: 2.5, fontWeight: 800, boxShadow: '0 10px 24px rgba(156, 0, 105, 0.26)' }} loading={loading}>
                  Login
                </LdButton>
              </Box>

              <Divider sx={{ my: 2.5 }}>or</Divider>

              <Button fullWidth size="large" variant="outlined" color="secondary" sx={{ py: 1.25, borderRadius: 2.5, fontWeight: 800, bgcolor: '#fff' }} onClick={() => navigate('/quick-purchase')}>
                Buy Data Without Login
              </Button>

              <Typography variant="body2" align="center" sx={{ mt: 2.5 }}>
                Don&apos;t have an account?{' '}
                <Button variant="text" onClick={() => navigate('/register')}>
                  Register
                </Button>
              </Typography>
            </Box>
          </Box>
        </Card>
      </Box>

    </>
  );
}
