import React, { useState, useEffect, useMemo } from 'react';
import {
  Grid,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Box,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Divider,
  InputAdornment,
  Chip,
  Link,
  Stack
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  BoltRounded as BoltRoundedIcon,
  CalendarMonthOutlined as CalendarMonthOutlinedIcon,
  CheckCircle as CheckCircleIcon,
  DataUsageOutlined as DataUsageOutlinedIcon,
  Lock as LockIcon,
  PhoneAndroidOutlined as PhoneAndroidOutlinedIcon,
  WifiRounded as WifiRoundedIcon
} from '@mui/icons-material';
import axios from 'axios';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import MainCard from 'ui-component/cards/MainCard';
import MtnMomoLogo from 'assets/images/allnetwork.jpg';
import { SnackError } from 'utils/Snackbars';

const steps = ['Amount', 'Account', 'Payment'];

const calculateEstimatedDuration = (plans, amount) => {
  const paidAmount = Number(amount);
  if (!paidAmount || paidAmount <= 0 || plans.length === 0) return null;

  const sortedPlans = [...plans].sort((a, b) => Number(a.amount) - Number(b.amount));
  const lowerPlan = [...sortedPlans].reverse().find((plan) => paidAmount >= Number(plan.amount));
  if (!lowerPlan) return null;
  const higherPlan = sortedPlans.find((plan) => Number(plan.amount) > paidAmount);
  let durationDays;
  let fairUseLimitGb;

  if (higherPlan) {
    const lowerAmount = Number(lowerPlan.amount);
    const higherAmount = Number(higherPlan.amount);
    const ratio = (paidAmount - lowerAmount) / (higherAmount - lowerAmount);
    durationDays = Number(lowerPlan.expire_days) + ratio * (Number(higherPlan.expire_days) - Number(lowerPlan.expire_days));
    fairUseLimitGb =
      Number(lowerPlan.fair_use_limit_gb || 0) +
      ratio * (Number(higherPlan.fair_use_limit_gb || 0) - Number(lowerPlan.fair_use_limit_gb || 0));
  } else {
    const multiplier = paidAmount / Number(lowerPlan.amount);
    durationDays = multiplier * Number(lowerPlan.expire_days);
    fairUseLimitGb = multiplier * Number(lowerPlan.fair_use_limit_gb || 0);
  }
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  return {
    fairUseLimitGb,
    fairUseDownKbps: Number(lowerPlan.fair_use_down_kbps || 0),
    fairUseUpKbps: Number(lowerPlan.fair_use_up_kbps || 0),
    expiresAt: expiresAt.toLocaleString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  };
};

const QuickPurchase = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Selection State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [username, setUsername] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [checkingUser, setCheckingUser] = useState(false);
  const [paymentVerifying, setPaymentVerifying] = useState(false);

  // Direct Payment State
  const [paymentPhone, setPaymentPhone] = useState('');
  const [provider, setProvider] = useState('mtn');
  const [transactionRef, setTransactionRef] = useState(null);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [polling, setPolling] = useState(false);
  const [pollMessage, setPollMessage] = useState('');

  // Error Handling
  const [error, setError] = useState(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const minimumAmount = useMemo(() => Math.max(10, plans.length > 0 ? Math.min(...plans.map((plan) => Number(plan.amount))) : 10), [plans]);
  const estimatedDuration = useMemo(() => calculateEstimatedDuration(plans, paymentAmount), [plans, paymentAmount]);

  // Load Plans on Mount
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        const response = await axios.get(`/api/api/wifi/subscription-plans`);
        if (response.data.code === 1) {
          setPlans(response.data.data);
        } else {
          setError('Failed to fetch subscription plans.');
        }
      } catch (err) {
        setError('An error occurred while fetching plans.');
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();

    // Load Paystack Script (Keep for fallback if needed, though we use direct now)
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Polling Effect
  useEffect(() => {
    let interval;
    if (polling && transactionRef) {
      // console.log("Starting poll for:", transactionRef);
      interval = setInterval(async () => {
        try {
          // console.log("Polling status for:", transactionRef);
          const res = await axios.get(`/api/api/wifi/paystack/status/${transactionRef}`);
          // console.log("Poll Response:", res.data);

          if (res.data.code !== 1) {
            console.warn('Poll returned non-success code:', res.data);
            return;
          }

          const status = res.data.data.status;
          // console.log("Payment Status:", status);

          if (status === 'success') {
            console.log('Payment Success Detected!');
            clearInterval(interval);
            setPolling(false);
            setPollMessage('Payment confirmed!');
            // Backend now handles activation on success status check.
            // Directly move to success screen.
            setActiveStep(3);
          } else if (status === 'failed') {
            console.log('Payment Failed Detected.');
            clearInterval(interval);
            setPolling(false);
            setError('Payment failed or was declined.');
            setTransactionRef(null);
          }
          // If 'pending' or 'send_pin', continue polling
        } catch (err) {
          console.error('Polling error:', err);
          // Don't stop polling on transient network errors, but maybe limit retries?
          // For now, let it continue.
        }
      }, 3000); // Check every 3 seconds
    }
    return () => clearInterval(interval);
  }, [polling, transactionRef]);

  // Handlers
  const handleCustomAmountNext = () => {
    if (!Number(paymentAmount) || Number(paymentAmount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (minimumAmount && Number(paymentAmount) < minimumAmount) {
      setError(`Minimum subscription amount is GH₵${minimumAmount}.`);
      return;
    }

    setActiveStep(1);
    setError(null);
  };

  const handleUserCheck = async () => {
    if (!username.trim()) {
      setError('Please enter a phone number.');
      return;
    }

    setCheckingUser(true);
    setError(null);
    try {
      const response = await axios.post('/api/api/wifi/public/check-user', { username });
      if (response.data.code === 1) {
        setUserInfo(response.data.data);
        setPaymentPhone(response.data.data.real_phone || ''); // Pre-fill phone
        setActiveStep(2);
      } else {
        setError(response.data.message || 'User not found.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify user.');
    } finally {
      setCheckingUser(false);
    }
  };

  const handleDirectPay = async () => {
    if (!paymentPhone) {
      setError('Please enter a valid phone number.');
      return;
    }

    if (minimumAmount && Number(paymentAmount) < minimumAmount) {
      setError(`Minimum subscription amount is GH₵${minimumAmount}.`);
      return;
    }

    setPaymentVerifying(true);
    setError(null);
    setTransactionRef(null);

    try {
      const payload = {
        username: username,
        amount: paymentAmount,
        phone: paymentPhone,
        provider: provider,
        email: `${username}@kayfigh.com`
      };

      const res = await axios.post('/api/api/wifi/paystack/charge', payload);

      if (res.data.code === 1) {
        const { reference, status, display_text } = res.data.data;
        setTransactionRef(reference);

        if (status === 'send_otp') {
          setShowOtpInput(true);
          setPollMessage(display_text || 'Please enter the OTP sent to your phone.');
          setPaymentVerifying(false); // Stop loading to let user type OTP
        } else if (status === 'pending' || status === 'send_pin' || status === 'pay_offline') {
          setPolling(true);
          setPollMessage(display_text || 'Please check your phone to approve the payment.');
        } else if (status === 'success') {
          // Immediate success
          setActiveStep(3);
        }
      } else {
        setError(res.data.message || 'Payment initiation failed.');
        setPaymentVerifying(false);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to initiate payment.');
      setPaymentVerifying(false);
    }
  };

  const handleSubmitOtp = async () => {
    if (!otp) return;
    setPaymentVerifying(true);
    try {
      const res = await axios.post('/api/api/wifi/paystack/submit-otp', {
        otp,
        reference: transactionRef
      });

      if (res.data.code === 1) {
        const { status, display_text } = res.data.data;
        setShowOtpInput(false); // Hide OTP input

        if (status === 'success') {
          setActiveStep(3);
        } else {
          // If still pending after OTP, start polling
          setPolling(true);
          setPollMessage(display_text || 'OTP accepted. Waiting for confirmation...');
        }
      } else {
        setError(res.data.message || 'OTP submission failed.');
        setPaymentVerifying(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting OTP.');
      setPaymentVerifying(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setPaymentAmount('');
    setUsername('');
    setUserInfo(null);
    setTransactionRef(null);
    setPolling(false);
    setShowOtpInput(false);
    setOtp('');
  };

  // --- Render Steps ---

  const renderPlanSelection = () => (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Chip icon={<BoltRoundedIcon />} label="FLEXIBLE WIFI TOP-UP" color="secondary" sx={{ fontWeight: 800, letterSpacing: 0.5 }} />
        <Typography variant="h2" sx={{ mt: 1.5, fontWeight: 900 }}>
          Choose your amount
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          Top up from GH₵{minimumAmount}. More credit gives you more time and more fair-use data.
        </Typography>
      </Box>
      <Card sx={{ borderRadius: 4, overflow: 'visible', boxShadow: '0 20px 45px rgba(55, 48, 163, 0.16)' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <TextField
            fullWidth
            label="How much WiFi do you need?"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            inputProps={{ min: minimumAmount, step: '0.01' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography sx={{ fontSize: 22, fontWeight: 900, color: 'primary.main' }}>GH₵</Typography>
                </InputAdornment>
              )
            }}
            helperText={`Minimum GH₵${minimumAmount}. No maximum amount.`}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, fontSize: 24, fontWeight: 800 } }}
          />
          {estimatedDuration && (
            <Box
              sx={{
                mt: 3,
                p: { xs: 2, sm: 2.5 },
                borderRadius: 3,
                background: 'linear-gradient(125deg, #312e81 0%, #6d28d9 55%, #be185d 100%)'
              }}
            >
              <Typography variant="h5" fontWeight={800} sx={{ color: '#fff' }}>
                Your WiFi at a glance
              </Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, height: '100%', borderRadius: 2, bgcolor: '#fff', color: '#1e1b4b' }}>
                    <CalendarMonthOutlinedIcon sx={{ color: '#6d28d9' }} />
                    <Typography variant="caption" display="block" sx={{ color: '#5b21b6', fontWeight: 800, mt: 0.5 }}>
                      ESTIMATED EXPIRY
                    </Typography>
                    <Typography fontWeight={800} sx={{ color: '#1e1b4b' }}>
                      {estimatedDuration.expiresAt}
                    </Typography>
                  </Box>
                </Grid>
                {estimatedDuration.fairUseLimitGb > 0 ? (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 1.5, height: '100%', borderRadius: 2, bgcolor: '#fff', color: '#1e1b4b' }}>
                        <DataUsageOutlinedIcon sx={{ color: '#6d28d9' }} />
                        <Typography variant="subtitle1" display="block" sx={{ color: '#1e1b4b', fontWeight: 900, mt: 0.5 }}>
                          Unlimited WiFi Access
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#5b21b6', mt: 0.25 }}>
                          Fair-use data: {estimatedDuration.fairUseLimitGb.toFixed(2)} GB
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', color: '#5b21b6', mt: 0.5, fontSize: '0.68rem', whiteSpace: 'nowrap' }}
                        >
                          After {(estimatedDuration.fairUseLimitGb * 2).toFixed(2)} GB: Stay Connected at 1/10th Speed
                        </Typography>
                      </Box>
                    </Grid>
                  </>
                ) : (
                  <Grid item xs={12} sm={6}>
                    <Typography sx={{ p: 1.5 }}>No fair-use throttle is configured for this package.</Typography>
                  </Grid>
                )}
              </Grid>
              {estimatedDuration.fairUseLimitGb > 0 && (
                <Typography variant="body2" sx={{ mt: 2, color: '#fff', fontWeight: 500 }}>
                  After you use the fair-use allowance, you stay connected but your speed reduces automatically.
                </Typography>
              )}
            </Box>
          )}
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Link component={RouterLink} to="/fair-use-policy" sx={{ fontWeight: 800, color: '#6d28d9' }}>
              Read our Fair Use Policy
            </Link>
          </Box>
          <Button
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 3, borderRadius: 3, py: 1.5, fontWeight: 900, fontSize: 16 }}
            onClick={handleCustomAmountNext}
            disabled={!paymentAmount || Number(paymentAmount) < minimumAmount}
          >
            Continue with GH₵{paymentAmount || '0'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );

  const renderUserEntry = () => (
    <Card sx={{ maxWidth: 480, mx: 'auto', borderRadius: 4, boxShadow: '0 20px 45px rgba(55, 48, 163, 0.16)' }}>
      <CardContent sx={{ p: { xs: 2.5, sm: 4 }, textAlign: 'center' }}>
        <PhoneAndroidOutlinedIcon color="secondary" sx={{ fontSize: 42, mb: 1 }} />
        <Typography variant="h3" fontWeight={900} gutterBottom>
          Who are you topping up?
        </Typography>
        <Typography color="text.secondary">Enter the KayFi account phone number.</Typography>
        <TextField
          fullWidth
          label="Phone Number"
          variant="outlined"
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/[^0-9]/g, ''))}
          inputProps={{ maxLength: 10 }}
          sx={{ my: 3, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
        <Stack direction="row" spacing={1.5} justifyContent="center">
          <Button startIcon={<ArrowBackIcon />} onClick={() => setActiveStep(0)}>
            Back
          </Button>
          <Button
            variant="contained"
            sx={{ borderRadius: 3, fontWeight: 800 }}
            onClick={handleUserCheck}
            disabled={checkingUser || !username}
          >
            {checkingUser ? <CircularProgress size={24} /> : 'Next'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );

  const renderConfirmation = () => (
    <Card sx={{ maxWidth: 540, mx: 'auto', borderRadius: 4, boxShadow: '0 20px 45px rgba(55, 48, 163, 0.16)' }}>
      <CardContent sx={{ p: { xs: 2.5, sm: 4 }, textAlign: 'center' }}>
        <Box
          sx={{
            width: 76,
            height: 76,
            mx: 'auto',
            mb: 2,
            p: 1,
            borderRadius: 3,
            bgcolor: '#fff7ed',
            display: 'grid',
            placeItems: 'center'
          }}
        >
          <img src={MtnMomoLogo} alt="Mobile Money" style={{ maxWidth: '58px' }} />
        </Box>
        <Chip label="SECURE MOBILE MONEY PAYMENT" color="secondary" size="small" sx={{ mb: 1, fontWeight: 800 }} />
        <Typography variant="h3" fontWeight={900} gutterBottom>
          Confirm your top-up
        </Typography>

        <Box sx={{ my: 3, textAlign: 'left', bgcolor: '#f5f3ff', border: '1px solid #ddd6fe', p: 2.5, borderRadius: 3 }}>
          <Typography variant="body1">
            <strong>Phone Number:</strong> {username}
          </Typography>
          <Typography variant="body1">
            <strong>Name:</strong> {userInfo?.fullname}
          </Typography>
          <Typography variant="body1">
            <strong>Phone:</strong> {userInfo?.phone}
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body1">
            <strong>Subscription:</strong> Flexible WiFi access
          </Typography>
          {estimatedDuration && (
            <Typography variant="body1">
              <strong>Estimated Expiry:</strong> {estimatedDuration.expiresAt}
            </Typography>
          )}
          {estimatedDuration?.fairUseLimitGb > 0 && (
            <Typography variant="body1">
              <strong>Fair-use allowance:</strong> {estimatedDuration.fairUseLimitGb.toFixed(2)} GB. Speed throttles after this limit.
            </Typography>
          )}
          <Typography variant="h5" color="primary" sx={{ mt: 1.5 }}>
            <strong>Total: GH₵{paymentAmount}</strong>
          </Typography>
        </Box>

        {/* Payment Form */}
        <Box sx={{ textAlign: 'left', mb: 2 }}>
          <TextField
            fullWidth
            label="Mobile Money Number"
            value={paymentPhone}
            onChange={(e) => setPaymentPhone(e.target.value)}
            margin="normal"
            disabled={paymentVerifying || polling}
            helperText="Enter the number to pay with"
          />

          <TextField
            select
            fullWidth
            label="Network Provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            SelectProps={{ native: true }}
            margin="normal"
            disabled={paymentVerifying || polling}
          >
            <option value="mtn">MTN</option>
            <option value="vod">Vodafone / Telecel</option>
            <option value="tgo">AirtelTigo</option>
          </TextField>
        </Box>

        {/* OTP Input */}
        {showOtpInput && (
          <Box sx={{ textAlign: 'left', mb: 2, p: 2, bgcolor: '#e3f2fd', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Enter One-Time Password (OTP)
            </Typography>
            <TextField fullWidth label="OTP" value={otp} onChange={(e) => setOtp(e.target.value)} margin="dense" />
            <Button variant="contained" fullWidth onClick={handleSubmitOtp} sx={{ mt: 1 }}>
              Submit OTP
            </Button>
          </Box>
        )}

        {/* Status Messages */}
        {(paymentVerifying || polling) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2, p: 2, bgcolor: '#f1f8e9', borderRadius: 1 }}>
            <CircularProgress size={30} sx={{ mb: 1 }} />
            <Typography variant="body1" align="center">
              {pollMessage || 'Processing payment...'}
            </Typography>
            {polling && (
              <Typography variant="caption" color="textSecondary">
                Please approve the transaction on your phone.
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => setActiveStep(1)} disabled={paymentVerifying || polling}>
            Back
          </Button>

          {!showOtpInput && !polling && (
            <Button
              variant="contained"
              size="large"
              startIcon={<LockIcon />}
              sx={{ borderRadius: 3, fontWeight: 900 }}
              onClick={handleDirectPay}
              disabled={paymentVerifying}
            >
              Pay Now
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  const renderSuccess = () => (
    <Box sx={{ maxWidth: 520, mx: 'auto', textAlign: 'center', py: 3 }}>
      <Box
        sx={{ width: 100, height: 100, mx: 'auto', mb: 2, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#dcfce7' }}
      >
        <CheckCircleIcon color="success" sx={{ fontSize: 76 }} />
      </Box>
      <Typography variant="h2" fontWeight={900} gutterBottom>
        Payment successful!
      </Typography>
      <Typography variant="body1" sx={{ mb: 4 }}>
        The subscription for <strong>{username}</strong> has been activated successfully.
      </Typography>
      <Button variant="contained" sx={{ borderRadius: 3, fontWeight: 800 }} onClick={() => navigate('/login')}>
        Back to Login
      </Button>
      <Button variant="text" onClick={handleReset} sx={{ ml: 2 }}>
        Buy Another
      </Button>
    </Box>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 1.5, sm: 3 },
        background:
          'radial-gradient(circle at top left, #c4b5fd 0%, transparent 33%), radial-gradient(circle at top right, #f9a8d4 0%, transparent 28%), #eef2ff'
      }}
    >
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Box sx={{ px: { xs: 1, sm: 2 }, py: 3, color: '#312e81', textAlign: 'center' }}>
          <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
            <WifiRoundedIcon color="secondary" />
            <Typography variant="h4" fontWeight={900}>
              KayFi
            </Typography>
          </Stack>
          <Typography variant="h2" fontWeight={900} sx={{ mt: 0.75 }}>
            Stay connected, your way.
          </Typography>
          <Typography sx={{ mt: 0.5, color: '#5b21b6' }}>Instant WiFi top-up with flexible amounts.</Typography>
        </Box>
        <MainCard>
          {activeStep < 3 && (
            <Stepper
              activeStep={activeStep}
              sx={{
                mb: 4,
                '& .MuiStepLabel-label.Mui-active': { fontWeight: 800, color: 'primary.main' },
                '& .MuiStepIcon-root.Mui-active': { color: 'secondary.main' },
                '& .MuiStepIcon-root.Mui-completed': { color: 'success.main' }
              }}
            >
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}

          {activeStep === 0 && (loadingPlans ? <CircularProgress /> : renderPlanSelection())}
          {activeStep === 1 && renderUserEntry()}
          {activeStep === 2 && renderConfirmation()}
          {activeStep === 3 && renderSuccess()}

          <SnackError open={!!error} setOpen={setError} message={error} />
        </MainCard>
      </Box>
    </Box>
  );
};

export default QuickPurchase;
