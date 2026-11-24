import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, CircularProgress, Container, Grid, Stack, Typography } from '@mui/material';
import {
  CheckCircleOutline as CheckCircleOutlineIcon,
  DataUsageOutlined as DataUsageOutlinedIcon,
  SpeedOutlined as SpeedOutlinedIcon,
  WifiRounded as WifiRoundedIcon
} from '@mui/icons-material';

const FairUsePolicy = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await axios.get('/api/api/wifi/subscription-plans');
        if (response.data.code === 1) {
          setPlans(response.data.data.filter((plan) => Number(plan.fair_use_limit_gb) > 0));
        } else {
          setLoadError(true);
        }
      } catch (error) {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 3, sm: 6 },
        background:
          'radial-gradient(circle at top left, #c4b5fd 0%, transparent 32%), radial-gradient(circle at top right, #f9a8d4 0%, transparent 28%), #f8f7ff'
      }}
    >
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ color: '#312e81' }}>
            <WifiRoundedIcon color="secondary" />
            <Typography variant="h4" fontWeight={900}>
              KayFi
            </Typography>
          </Stack>
          <Typography variant="h2" sx={{ mt: 2, fontWeight: 900, color: '#1e1b4b' }}>
            Fair Use Policy
          </Typography>
          <Typography sx={{ mt: 1, color: '#5b21b6' }}>Clear, reliable WiFi for every KayFi client.</Typography>
        </Box>

        <Card sx={{ borderRadius: 4, boxShadow: '0 20px 45px rgba(55, 48, 163, 0.14)' }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 5 } }}>
            <Box
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                color: '#fff',
                background: 'linear-gradient(125deg, #312e81 0%, #6d28d9 55%, #be185d 100%)'
              }}
            >
              <Typography variant="h4" fontWeight={900} color={'white'}>
                Unlimited WiFi, used fairly
              </Typography>
              <Typography sx={{ mt: 1, color: '#fff' }}>
                To maintain reliable service and fair access for all clients, KayFi has updated its fair-use policy.
                Your WiFi remains unlimited throughout your active package, with a few changes to how speed is managed after fair-use data
                is used.
              </Typography>
            </Box>

            <Grid container spacing={2} sx={{ my: 2 }}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ height: '100%', p: 2, borderRadius: 3, bgcolor: '#f5f3ff' }}>
                  <WifiRoundedIcon sx={{ color: '#6d28d9' }} />
                  <Typography fontWeight={900} sx={{ mt: 1, color: '#1e1b4b' }}>
                    Unlimited WiFi Access
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: '#5b21b6' }}>
                    Stay connected for the full duration of your active package.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ height: '100%', p: 2, borderRadius: 3, bgcolor: '#fff7ed' }}>
                  <DataUsageOutlinedIcon sx={{ color: '#c2410c' }} />
                  <Typography fontWeight={900} sx={{ mt: 1, color: '#431407' }}>
                    Clear fair-use data
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: '#9a3412' }}>
                    Every package has a clearly stated fair-use allowance.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ height: '100%', p: 2, borderRadius: 3, bgcolor: '#ecfdf5' }}>
                  <CheckCircleOutlineIcon sx={{ color: '#047857' }} />
                  <Typography fontWeight={900} sx={{ mt: 1, color: '#064e3b' }}>
                    Fair for everyone
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: '#047857' }}>
                    This helps us keep service dependable for all clients.
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <PolicySection title="1. How fair use works">
              Your package includes unlimited WiFi access for its validity period. Each package also has a fair-use data allowance. The
              allowance is shown before you pay, and it is stored with your subscription when your purchase is activated.
            </PolicySection>

            <PolicySection title="2. After fair-use data is used">
              You will remain connected and can continue using the internet. Your connection speed will be managed to one-fifth of your
              normal service speed for the rest of that package period. This helps protect a consistent experience for all KayFi clients.
            </PolicySection>

            <PolicySection title="3. Buying another package">
              When you buy another package before your current one expires, it starts immediately. Any unused fair-use data and remaining
              validity from your active package are added to the new package, so you do not lose what you have already paid for. If your
              speed had been reduced after using your fair-use data, your connection returns to normal speed when the combined package
              starts.
            </PolicySection>

            <PolicySection title="4. Custom purchase amounts">
              You can purchase a custom amount from the minimum displayed at checkout. Its validity period and fair-use allowance are
              calculated from the current package rates and shown before payment.
            </PolicySection>

            <PolicySection title="5. Responsible use">
              Please use your KayFi connection responsibly. Do not resell access, share it outside your approved residence, run abusive
              activity, or use it in a way that disrupts service for other clients.
            </PolicySection>

            <Box sx={{ mt: 4, p: 2.5, borderRadius: 3, border: '1px solid #ddd6fe', bgcolor: '#faf5ff' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <SpeedOutlinedIcon color="secondary" />
                <Typography variant="h5" fontWeight={900} sx={{ color: '#3b0764' }}>
                  Package fair-use data
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.75, color: '#6b21a8' }}>
                Current package allowances are shown below and may change when package settings are updated.
              </Typography>
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              )}
              {loadError && (
                <Typography sx={{ mt: 2, color: 'error.main' }}>
                  Package information is temporarily unavailable. Please check again later.
                </Typography>
              )}
              {!loading && !loadError && (
                <Grid container spacing={1.5} sx={{ mt: 1 }}>
                  {plans.map((plan) => (
                    <Grid item xs={12} sm={6} key={plan.id}>
                      <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: '#fff', border: '1px solid #e9d5ff' }}>
                        <Typography fontWeight={900} sx={{ color: '#1e1b4b' }}>
                          GHS {Number(plan.amount).toFixed(2)}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ color: '#1e1b4b', fontWeight: 900, mt: 0.5 }}>
                          Unlimited WiFi Access
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6b21a8' }}>
                          Fair-use data: {Number(plan.fair_use_limit_gb).toFixed(2)} GB
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', color: '#6b21a8', mt: 0.5, fontSize: '0.68rem', whiteSpace: 'nowrap' }}
                        >
                          After {(Number(plan.fair_use_limit_gb) * 2).toFixed(2)} GB: Stay Connected at 1/10th Speed
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>

            <Typography variant="caption" display="block" sx={{ mt: 3, color: 'text.secondary' }}>
              Effective from 20 September 2026. KayFi may update this policy when service requirements change.
            </Typography>
            <Button
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, py: 1.4, borderRadius: 3, fontWeight: 900 }}
              onClick={() => navigate('/quick-purchase')}
            >
              Buy WiFi
            </Button>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

const PolicySection = ({ title, children }) => (
  <Box sx={{ py: 2, borderBottom: '1px solid #ede9fe' }}>
    <Typography variant="h5" fontWeight={900} sx={{ color: '#1e1b4b' }}>
      {title}
    </Typography>
    <Typography sx={{ mt: 0.75, color: '#4c1d95' }}>{children}</Typography>
  </Box>
);

export default FairUsePolicy;
