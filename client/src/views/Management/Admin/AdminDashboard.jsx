import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { getComplaints, getCustomers, getPickupRequests, getRevenueSummary } from 'services/mockApi';

const cardStyle = {
    p: 2.25,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    height: '100%'
};

const AdminDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState({ customers: [], pickups: [], complaints: [], revenue: null });

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError('');

            try {
                const [customersRes, pickupsRes, complaintsRes, revenueRes] = await Promise.all([
                    getCustomers(),
                    getPickupRequests(),
                    getComplaints(),
                    getRevenueSummary()
                ]);

                if (customersRes.code !== 1 || pickupsRes.code !== 1 || complaintsRes.code !== 1 || revenueRes.code !== 1) {
                    setError('Unable to load admin dashboard data.');
                    return;
                }

                setData({
                    customers: customersRes.data,
                    pickups: pickupsRes.data,
                    complaints: complaintsRes.data,
                    revenue: revenueRes.data
                });
            } catch {
                setError('Unable to load admin dashboard data.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const summary = useMemo(() => {
        const activeSubscriptions = data.customers.filter((customer) => customer.status === 'active').length;
        const todaysPickups = data.pickups.filter((pickup) => pickup.pickupDate === '2026-04-24').length;
        const pendingComplaints = data.complaints.filter((complaint) => complaint.status !== 'resolved').length;

        return [
            { label: 'Total Customers', value: data.customers.length },
            { label: 'Active Subscriptions', value: activeSubscriptions },
            { label: 'Today Pickups', value: todaysPickups },
            { label: 'Pending Complaints', value: pendingComplaints },
            { label: 'Revenue Snapshot', value: `GHS ${data.revenue?.totalRevenue || 0}` }
        ];
    }, [data]);

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
                Admin Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Operations overview with customers, pickups, complaints, and revenue metrics.
            </Typography>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            ) : null}

            <Grid container spacing={2.5}>
                {summary.map((item) => (
                    <Grid item xs={12} sm={6} lg={4} key={item.label}>
                        <Paper sx={cardStyle}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                {item.label}
                            </Typography>
                            <Typography variant="h4">{item.value}</Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default AdminDashboard;
