import React, { useState, useEffect } from 'react';
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
  useTheme,
  Divider
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Lock as LockIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import MainCard from 'ui-component/cards/MainCard';
import MtnMomoLogo from 'assets/images/allnetwork.jpg';
import { SnackError } from 'utils/Snackbars';

const planColors = [
  { bg: '#e3f2fd', text: '#1a237e' },
  { bg: '#e8f5e9', text: '#1b5e20' },
  { bg: '#fff3e0', text: '#e65100' },
  { bg: '#fbe9e7', text: '#bf360c' },
  { bg: '#ede7f6', text: '#311b92' }
];

const steps = ['Select Plan', 'Find Friend', 'Confirm & Pay'];

const BuyForFriend = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Selection State
  const [selectedPlan, setSelectedPlan] = useState(null);
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
  }, []);

  // Polling Effect
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
              setActiveStep(3); // Success! Server has activated.
            } else if (status === 'failed') {
              clearInterval(interval);
              setPolling(false);
              setError('Payment failed or was declined.');
              setTransactionRef(null);
            } 
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [polling, transactionRef]);

  // Handlers
  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
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
        // Note: For "Buy for Friend", we probably want the PAYER'S phone (logged in user) by default, 
        // OR let them enter it. The API returns the FRIEND'S phone masked.
        // Let's check if we can get the logged-in user's phone for payment convenience.
        const payerUser = localStorage.getItem('userId');
        if (payerUser) {
             // Try to pre-fill with payer's phone if possible, else leave empty for them to fill
             try {
                 const payerRes = await axios.post(`/api/api/wifi/dashboard`, { username: payerUser });
                 if(payerRes.data.phone) setPaymentPhone(payerRes.data.phone);
             } catch(e) {}
        }
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

    setPaymentVerifying(true);
    setError(null);
    setTransactionRef(null);
    
    try {
      const payload = {
        username: username, // The friend's phone number, sent as username for the API contract
        plan_id: selectedPlan.id,
        amount: selectedPlan.amount,
        phone: paymentPhone, // The PAYER's phone
        provider: provider,
        email: `${username.replace(/\s+/g, '')}@kayfigh.com` // Friend's email placeholder
      };

      const res = await axios.post('/api/api/wifi/paystack/charge', payload);
      
      if (res.data.code === 1) {
        const { reference, status, display_text } = res.data.data;
        setTransactionRef(reference);

        if (status === 'send_otp') {
          setShowOtpInput(true);
          setPollMessage(display_text || 'Please enter the OTP sent to your phone.');
          setPaymentVerifying(false); 
        } else if (status === 'pending' || status === 'send_pin' || status === 'pay_offline') {
          setPolling(true);
          setPollMessage(display_text || 'Please check your phone to approve the payment.');
        } else if (status === 'success') {
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
        setShowOtpInput(false);
        
        if (status === 'success') {
           setActiveStep(3);
        } else {
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
    setSelectedPlan(null);
    setUsername('');
    setUserInfo(null);
    setTransactionRef(null);
    setPolling(false);
    setShowOtpInput(false);
    setOtp('');
  };

  // --- Render Steps ---

  const renderPlanSelection = () => (
    <Grid container spacing={3}>
      {plans.map((plan, index) => (
        <Grid item xs={12} sm={6} md={4} key={plan.id}>
          <Card
            onClick={() => handlePlanSelect(plan)}
            sx={{
              backgroundColor: planColors[index % planColors.length].bg,
              color: planColors[index % planColors.length].text,
              cursor: 'pointer',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'scale(1.02)', boxShadow: 3 }
            }}
          >
            <CardContent>
              <Typography variant="h5" gutterBottom>
                {plan.plan_name}
              </Typography>
              <Typography variant="h2" sx={{ my: 2 }}>
                GH₵{plan.amount}
              </Typography>
              <Typography>Unlimited WiFi</Typography>
              <Typography>Expires: {plan.expires_display}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderUserEntry = () => (
    <Box sx={{ maxWidth: 400, mx: 'auto', textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>
        Who are you buying for?
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        Enter the phone number of your friend or family member.
      </Typography>
      <TextField
        fullWidth
        label="Friend's Phone Number"
        variant="outlined"
        value={username}
        onChange={(e) => setUsername(e.target.value.replace(/[^0-9]/g, ''))}
        inputProps={{ maxLength: 10 }}
        sx={{ my: 3 }}
      />
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button onClick={() => setActiveStep(0)}>Back</Button>
        <Button variant="contained" onClick={handleUserCheck} disabled={checkingUser || !username}>
          {checkingUser ? <CircularProgress size={24} /> : 'Verify Friend'}
        </Button>
      </Box>
    </Box>
  );

  const renderConfirmation = () => (
    <Card sx={{ maxWidth: 500, mx: 'auto', p: 2 }}>
      <CardContent sx={{ textAlign: 'center' }}>
        <img src={MtnMomoLogo} alt="Momo" style={{ maxWidth: '100px', marginBottom: '16px' }} />
        <Typography variant="h4" color="primary" gutterBottom>
          Secure Payment
        </Typography>

        <Box sx={{ my: 3, textAlign: 'left', bgcolor: theme.palette.grey[50], p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" color="textSecondary">Beneficiary (Friend)</Typography>
          <Typography variant="body1"><strong>Phone Number:</strong> {username}</Typography>
          <Typography variant="body1"><strong>Name:</strong> {userInfo?.fullname}</Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="textSecondary">Package</Typography>
          <Typography variant="body1"><strong>Plan:</strong> {selectedPlan?.plan_name}</Typography>
          <Typography variant="h5" color="primary" sx={{ mt: 1 }}>
            <strong>Total: GH₵{selectedPlan?.amount}</strong>
          </Typography>
        </Box>

        {/* Payment Form */}
        <Box sx={{ textAlign: 'left', mb: 2 }}>
           <TextField
             fullWidth
             label="Your Mobile Money Number"
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
             <Typography variant="subtitle2" gutterBottom>Enter One-Time Password (OTP)</Typography>
             <TextField
               fullWidth
               label="OTP"
               value={otp}
               onChange={(e) => setOtp(e.target.value)}
               margin="dense"
             />
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
               {pollMessage || "Processing payment..."}
            </Typography>
            {polling && (
              <Typography variant="caption" color="textSecondary">
                Please approve the transaction on your phone.
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
            <Button onClick={() => setActiveStep(1)} disabled={paymentVerifying || polling}>
              Back
            </Button>
            
            {!showOtpInput && !polling && (
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<LockIcon />} 
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
    <Box sx={{ textAlign: 'center', py: 5 }}>
      <CheckCircleIcon color="success" sx={{ fontSize: 80, mb: 2 }} />
      <Typography variant="h3" gutterBottom>
        Top-up Successful!
      </Typography>
      <Typography variant="body1" sx={{ mb: 4 }}>
        The subscription for <strong>{username}</strong> has been activated successfully.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/dashboard/default')}>
        Back to Dashboard
      </Button>
      <Button variant="text" onClick={handleReset} sx={{ ml: 2 }}>
        Buy for Another Friend
      </Button>
    </Box>
  );

  return (
    <MainCard title="Buy for a Friend">
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/default')} sx={{ mb: 2 }}>
          Back to Dashboard
        </Button>
        
        {activeStep < 3 && (
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
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
      </Box>
    </MainCard>
  );
};

export default BuyForFriend;
