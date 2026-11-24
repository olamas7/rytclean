import React, { useState, useEffect } from 'react';
import { Grid, Typography, Button, Card, CardContent, CircularProgress, Box } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import MainCard from 'ui-component/cards/MainCard';
import PaymentPage from './PaymentPage';

const planColors = [
  { bg: '#e3f2fd', text: '#1a237e' },
  { bg: '#e8f5e9', text: '#1b5e20' },
  { bg: '#fff3e0', text: '#e65100' },
  { bg: '#fbe9e7', text: '#bf360c' },
  { bg: '#ede7f6', text: '#311b92' }
];

const PurchasePlan = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'payment'
  const [selectedPlan, setSelectedPlan] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/api/wifi/subscription-plans`);
        if (response.data.code === 1) {
          setPlans(response.data.data);
        } else {
          setError('Failed to fetch subscription plans.');
        }
      } catch (err) {
        setError('An error occurred while fetching plans.');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setView('payment');
  };

  const handlePaymentSuccess = () => {
    navigate('/app');
  };

  if (view === 'payment') {
    return (
      <MainCard title="Complete Your Payment">
        <PaymentPage
          selectedPlan={selectedPlan}
          onBack={() => setView('list')}
          onSuccess={handlePaymentSuccess}
        />
      </MainCard>
    );
  }

  return (
    <MainCard title="Purchase a Plan">
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app')} sx={{ mb: 2 }}>
          Back to Dashboard
        </Button>
        <Typography variant="h4" gutterBottom>
          Choose a Subscription Plan
        </Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Typography color="error" align="center" sx={{ my: 4 }}>
            {error}
          </Typography>
        )}

        {!loading && !error && (
          <Grid container spacing={3}>
            {plans.map((plan, index) => (
              <Grid item xs={12} sm={6} md={4} key={plan.id}>
                <Card
                  onClick={() => handlePlanSelect(plan)}
                  sx={{
                    backgroundColor: planColors[index % planColors.length].bg,
                    color: planColors[index % planColors.length].text,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'scale(1.02)',
                      boxShadow: '0 8px 16px 0 rgba(0,0,0,0.1)'
                    }
                  }}
                >
                  <CardContent>
                    <Typography variant="h5" component="div" gutterBottom>
                      {plan.plan_name}
                    </Typography>
                    <Typography variant="h2" sx={{ my: 2 }}>
                      GH₵{plan.amount}
                    </Typography>
                    <Typography variant="body1">Unlimited WiFi</Typography>
                    <Typography variant="body1">Expires: {plan.expires_display}</Typography>
                  </CardContent>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{
                      m: 2,
                      width: 'calc(100% - 32px)',
                      borderColor: planColors[index % planColors.length].text,
                      color: planColors[index % planColors.length].text,
                      '&:hover': {
                        backgroundColor: planColors[index % planColors.length].text,
                        color: planColors[index % planColors.length].bg,
                        borderColor: planColors[index % planColors.length].text
                      }
                    }}
                  >
                    Select Plan
                  </Button>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </MainCard>
  );
};

export default PurchasePlan;
