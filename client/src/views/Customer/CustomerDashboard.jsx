import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Grid, Paper, Stack, Typography } from '@mui/material';
import { appRoutes } from 'constants/appRoutes';
import { getCustomerById, getCustomerComplaints, getCustomerPayments, getCustomerPlans, getPickupRequests } from 'services/mockApi';
import StatusBadge from 'ui-component/StatusBadge';

const CUSTOMER_ID = 'CUST-001';

const statCardStyle = {
    p: 2.25,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    height: '100%'
};

const CustomerDashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dashboard, setDashboard] = useState({
        customer: null,
        plan: null,
        pickup: null,
        complaintsCount: 0,
        paymentStatus: 'pending'
    });

    useEffect(() => {
        const loadDashboard = async () => {
            setLoading(true);
            setError('');

            try {
                const [customerRes, plansRes, pickupsRes, complaintsRes, paymentsRes] = await Promise.all([
                    getCustomerById(CUSTOMER_ID),
                    getCustomerPlans(),
                    getPickupRequests(),
                    getCustomerComplaints(CUSTOMER_ID),
                    getCustomerPayments(CUSTOMER_ID)
                ]);

                if (
                    customerRes.code !== 1 ||
                    plansRes.code !== 1 ||
                    pickupsRes.code !== 1 ||
                    complaintsRes.code !== 1 ||
                    paymentsRes.code !== 1
                ) {
                    setError('Unable to load customer dashboard data.');
                    return;
                }

                const customer = customerRes.data;
                const currentPlan = plansRes.data.find((plan) => plan.id === customer?.planId) || null;
                const customerPickups = pickupsRes.data.filter((pickup) => pickup.customerId === CUSTOMER_ID);
                const latestPickup = customerPickups[0] || null;
                const lastPayment = paymentsRes.data[0] || null;

                setDashboard({
                    customer,
                    plan: currentPlan,
                    pickup: latestPickup,
                    complaintsCount: complaintsRes.data.length,
                    paymentStatus: lastPayment?.status || 'pending'
                });
            } catch {
                setError('Unable to load customer dashboard data.');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    const summaryCards = useMemo(
        () => [
            { label: 'Active Plan', value: dashboard.plan?.name || 'No plan selected' },
            { label: 'Payment Status', value: dashboard.paymentStatus },
            { label: 'Upcoming Pickup', value: dashboard.customer?.nextPickupDate || 'Not scheduled' },
            { label: 'Complaints Count', value: dashboard.complaintsCount }
        ],
        [dashboard]
    );

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
                Customer Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Welcome, {dashboard.customer?.fullName || 'Customer'}
            </Typography>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            ) : null}

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={8}>
                    <Paper sx={statCardStyle}>
                        <Typography variant="h4" sx={{ mb: 1.25 }}>
                            Current Subscription Plan
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            {dashboard.plan?.name || 'No active plan'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Next Pickup: {dashboard.customer?.nextPickupDate || 'Not scheduled'}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper sx={statCardStyle}>
                        <Typography variant="h4" sx={{ mb: 1.25 }}>
                            Pickup Status
                        </Typography>
                        <Box sx={{ mb: 1 }}>
                            <StatusBadge label={dashboard.pickup?.status || 'Not scheduled'} size="small" />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            {dashboard.pickup?.pickupDate || 'No upcoming pickup date'}
                        </Typography>
                    </Paper>
                </Grid>

                <Grid item xs={12}>
                    <Paper sx={{ ...statCardStyle, p: 2 }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Quick Actions
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                            <Button variant="contained" onClick={() => navigate(appRoutes.customer.bookPickup)}>
                                Book Pickup
                            </Button>
                            <Button variant="contained" onClick={() => navigate(appRoutes.customer.payments)}>
                                Make Payment
                            </Button>
                            <Button variant="outlined" onClick={() => navigate(appRoutes.customer.complaints)}>
                                Report Complaint
                            </Button>
                            <Button variant="outlined" onClick={() => navigate(appRoutes.customer.tracking)}>
                                View History
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>

                {summaryCards.map((card) => (
                    <Grid item xs={12} sm={6} lg={3} key={card.label}>
                        <Paper sx={statCardStyle}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                {card.label}
                            </Typography>
                            <Typography variant="h4" sx={{ textTransform: 'capitalize' }}>
                                {card.value}
                            </Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default CustomerDashboard;
