import React, { useState, useEffect, useRef } from 'react';
import { Grid, Typography, Button, Card, CardContent, Box, useTheme, CircularProgress, TextField, MenuItem } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Lock as LockIcon, CheckCircle as CheckCircleIcon, Home as HomeIcon } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import MtnMomoLogo from 'assets/images/allnetwork.jpg';
import { SnackError } from 'utils/Snackbars';

const PaymentPage = ({ selectedPlan, email, onBack }) => { // Remove onSuccess prop if unused, or keep for flexibility
  const theme = useTheme();
  const navigate = useNavigate(); // Initialize hook
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false); // Success state
  const [error, setError] = useState(null);
  const username = localStorage.getItem('userId');

  // Direct Payment State
  const [paymentPhone, setPaymentPhone] = useState('');
  const [provider, setProvider] = useState('mtn');
  const [transactionRef, setTransactionRef] = useState(null);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [polling, setPolling] = useState(false);
  const [pollMessage, setPollMessage] = useState('');

  // Resend OTP State
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Timer logic for resend
  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  const startResendTimer = () => setResendTimer(60);

  // Fetch user phone on mount
  useEffect(() => {
    const fetchUserPhone = async () => {
      try {
        // Using dashboard endpoint as it returns the unmasked phone now
        const response = await axios.post(`/api/api/wifi/dashboard`, { username });
        if (response.data && response.data.phone) {
          setPaymentPhone(response.data.phone);
        }
      } catch (err) {
        console.error('Error fetching phone:', err);
      }
    };
    if (username) fetchUserPhone();
  }, [username]);

  // Polling Logic
  useEffect(() => {
    let interval;
    if (polling && transactionRef) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`/api/api/wifi/paystack/status/${transactionRef}`);
          if (res.data.code === 1) {
            const status = res.data.data.status;
            if (status === 'success') {
              clearInterval(interval);
              setPolling(false);
              setSuccess(true); // Trust server activation
            } else if (status === 'failed') {
              clearInterval(interval);
              setPolling(false);
              setError('Payment failed or was declined.');
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [polling, transactionRef]);

  const handleDirectPay = async (isResend = false) => {
    if (!paymentPhone) {
      setError('Please enter a valid phone number.');
      return;
    }

    if (isResend) {
      resetPayment();
    }

    setVerifying(true);
    setError(null);
    setPollMessage('');
    
    try {
      const payload = {
        username: username,
        plan_id: selectedPlan.id,
        amount: selectedPlan.amount,
        phone: paymentPhone,
        provider: provider,
        email: email || `${username.replace(/\s+/g, '')}@kayfigh.com`
      };

      const res = await axios.post('/api/api/wifi/paystack/charge', payload);
      
      if (res.data.code === 1) {
        const { reference, status, display_text } = res.data.data;
        setTransactionRef(reference);

        if (status === 'send_otp') {
          setShowOtpInput(true);
          setPollMessage(display_text || 'Please enter the OTP sent to your phone.');
          setVerifying(false); // Allow input
          startResendTimer();
        } else if (status === 'pending' || status === 'send_pin' || status === 'pay_offline') {
          setPolling(true);
          setPollMessage(display_text || 'Please check your phone to approve the payment.');
        } else if (status === 'success') {
          setSuccess(true);
        }
      } else {
        setError(res.data.message || 'Payment initiation failed.');
        setVerifying(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate payment.');
      setVerifying(false);
    }
  };

  const handleSubmitOtp = async () => {
    if (!otp) return;
    setVerifying(true);
    try {
      const res = await axios.post('/api/api/wifi/paystack/submit-otp', {
        otp,
        reference: transactionRef
      });
      
      if (res.data.code === 1) {
        const { status, display_text } = res.data.data;
        setShowOtpInput(false);
        
        if (status === 'success') {
           setSuccess(true);
        } else {
           setPolling(true);
           setPollMessage(display_text || 'OTP accepted. Waiting for confirmation...');
        }
      } else {
        setError(res.data.message || 'OTP submission failed.');
        setVerifying(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting OTP.');
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    // For Mobile Money, resending OTP actually means re-initiating the charge
    handleDirectPay(true);
  };

  const resetPayment = () => {
    setTransactionRef(null);
    setShowOtpInput(false);
    setPolling(false);
    setVerifying(false);
    setError(null);
    setOtp('');
  };

  // Render Success Screen
  if (success) {
    return (
      <Box sx={{ textAlign: 'center', py: 5 }}>
        <CheckCircleIcon color="success" sx={{ fontSize: 80, mb: 2 }} />
        <Typography variant="h2" gutterBottom>
          Payment Successful!
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
          Your subscription for <strong>{selectedPlan?.plan_name}</strong> has been activated.
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button 
            variant="contained" 
            size="large"
            startIcon={<HomeIcon />}
            onClick={() => navigate('/app')}
          >
            Back to Home
          </Button>
          <Button 
            variant="outlined" 
            size="large"
            onClick={onBack}
          >
            Buy Another
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }} disabled={verifying || polling}>
        Back to Plans
      </Button>
      <Card sx={{ p: { xs: 2, md: 4 } }}>
        <CardContent>
          <Grid container spacing={4} justifyContent="center" textAlign="center">
            <Grid item xs={12}>
              <img src={MtnMomoLogo} alt="Payment" style={{ maxWidth: '220px' }} />
              <Typography variant="h5" sx={{ mt: 1, color: theme.palette.grey[600] }}>
                Secure Direct Payment
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="body1">
                You are paying for the <strong>{selectedPlan?.plan_name}</strong> plan.
              </Typography>
              <Typography variant="h1" sx={{ my: 2 }}>
                GH₵{selectedPlan?.amount}
              </Typography>
            </Grid>

            <Grid item xs={12} md={8} sx={{ mx: 'auto', p: 3, backgroundColor: theme.palette.grey[50], borderRadius: 2 }}>
              {(verifying || polling) && !showOtpInput ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
                  <CircularProgress size={40} sx={{ mb: 2 }} />
                  <Typography variant="h6">{pollMessage || "Processing payment..."}</Typography>
                  {polling && (
                    <Typography variant="body2" color="textSecondary">
                      Please approve the transaction on your phone.
                    </Typography>
                  )}
                </Box>
              ) : showOtpInput ? (
                <Box sx={{ textAlign: 'left' }}>
                   <Typography variant="subtitle1" gutterBottom>Enter OTP</Typography>
                   <Typography variant="body2" gutterBottom>{pollMessage}</Typography>
                   <TextField
                     fullWidth
                     label="One-Time Password"
                     value={otp}
                     onChange={(e) => setOtp(e.target.value)}
                     margin="normal"
                   />
                   <Button variant="contained" fullWidth onClick={handleSubmitOtp} sx={{ mt: 2 }} disabled={verifying}>
                      {verifying ? <CircularProgress size={24} color="inherit" /> : 'Submit OTP'}
                   </Button>
                   
                   <Box sx={{ mt: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Button 
                        size="small" 
                        onClick={handleResendOtp} 
                        disabled={resendTimer > 0 || resendLoading}
                      >
                        {resendLoading ? 'Resending...' : resendTimer > 0 ? `Resend OTP (${resendTimer}s)` : 'Resend OTP'}
                      </Button>
                      <Button 
                        size="small" 
                        color="secondary"
                        onClick={resetPayment}
                      >
                        Restart Payment
                      </Button>
                   </Box>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'left' }}>
                  <TextField
                    fullWidth
                    label="Mobile Money Number"
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                    margin="normal"
                    helperText="Enter the number to pay with"
                  />
                  <TextField
                    select
                    fullWidth
                    label="Network Provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    margin="normal"
                  >
                    <MenuItem value="mtn">MTN</MenuItem>
                    <MenuItem value="vod">Vodafone / Telecel</MenuItem>
                    <MenuItem value="tgo">AirtelTigo</MenuItem>
                  </TextField>
                  
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<LockIcon />}
                    onClick={handleDirectPay}
                    fullWidth
                    sx={{ mt: 3, py: 1.5 }}
                  >
                    Pay GH₵{selectedPlan?.amount} Now
                  </Button>
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      <SnackError open={!!error} setOpen={setError} message={error} />
    </Box>
  );
};

export default PaymentPage;
