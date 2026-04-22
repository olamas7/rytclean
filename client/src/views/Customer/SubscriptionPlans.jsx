import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Grid, Paper, Stack, Typography } from '@mui/material';
import { getCustomerPlans } from 'services/mockApi';

const SubscriptionPlans = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState('PLAN-WEEKLY');

    useEffect(() => {
        const loadPlans = async () => {
            setLoading(true);
            setError('');

            try {
                const response = await getCustomerPlans();
                if (response.code !== 1) {
                    setError('Unable to load subscription plans.');
                    return;
                }

                setPlans(response.data);
            } catch {
                setError('Unable to load subscription plans.');
            } finally {
                setLoading(false);
            }
        };

        loadPlans();
    }, []);

    if (loading) {
        return (
            <Box sx={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Subscription / Plans
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Choose a plan that fits your pickup frequency.
            </Typography>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            ) : null}
            {!error && plans.length === 0 ? <Alert severity="info">No plans available yet.</Alert> : null}

            <Grid container spacing={2.5}>
                {plans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;

                    return (
                        <Grid item xs={12} sm={6} lg={3} key={plan.id}>
                            <Paper
                                sx={{
                                    p: 2.25,
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: isSelected ? 'primary.main' : 'divider',
                                    boxShadow: isSelected ? '0 0 0 1px rgba(25, 118, 210, 0.35)' : 'none',
                                    height: '100%'
                                }}
                            >
                                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                                    <Typography variant="h4">{plan.name}</Typography>
                                    {isSelected ? <Chip label="Selected" color="primary" size="small" /> : null}
                                </Stack>

                                <Typography variant="h3" sx={{ mb: 0.75 }}>
                                    {plan.currency} {plan.price}
                                </Typography>

                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    {plan.frequency}
                                </Typography>

                                <Stack spacing={0.75} sx={{ mb: 2 }}>
                                    {plan.features.map((feature) => (
                                        <Typography variant="body2" key={feature}>
                                            - {feature}
                                        </Typography>
                                    ))}
                                </Stack>

                                <Button
                                    variant={isSelected ? 'outlined' : 'contained'}
                                    fullWidth
                                    onClick={() => setSelectedPlanId(plan.id)}
                                >
                                    {isSelected ? 'Selected' : 'Select Plan'}
                                </Button>
                            </Paper>
                        </Grid>
                    );
                })}
            </Grid>
        </Box>
    );
};

export default SubscriptionPlans;
