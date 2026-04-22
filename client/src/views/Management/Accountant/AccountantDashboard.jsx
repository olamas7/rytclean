import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { getPayments, getRevenueSummary } from 'services/mockApi';

const cardStyle = {
    p: 2.25,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    height: '100%'
};

const AccountantDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);

            const [paymentsRes, summaryRes] = await Promise.all([getPayments(), getRevenueSummary()]);

            if (paymentsRes.code === 1) {
                setPayments(paymentsRes.data);
            }

            if (summaryRes.code === 1) {
                setSummary(summaryRes.data);
            }

            setLoading(false);
        };

        loadData();
    }, []);

    const stats = useMemo(() => {
        const pendingPayments = payments.filter((payment) => payment.status === 'pending').length;
        const paidInvoices = payments.filter((payment) => payment.status === 'paid').length;

        return [
            { label: 'Total Revenue', value: `GHS ${summary?.totalRevenue || 0}` },
            { label: 'Pending Payments', value: pendingPayments },
            { label: 'Paid Invoices', value: paidInvoices },
            { label: 'Monthly Collection', value: `GHS ${summary?.monthlyCollection?.[3]?.amount || 0}` }
        ];
    }, [payments, summary]);

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
                Accountant Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Revenue and collection overview with payment performance snapshot.
            </Typography>

            <Grid container spacing={2.5}>
                {stats.map((stat) => (
                    <Grid item xs={12} sm={6} key={stat.label}>
                        <Paper sx={cardStyle}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                {stat.label}
                            </Typography>
                            <Typography variant="h4">{stat.value}</Typography>
                        </Paper>
                    </Grid>
                ))}

                <Grid item xs={12}>
                    <Paper sx={{ ...cardStyle, p: 2.5 }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Revenue Chart Placeholder
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Monthly revenue chart will be connected here when chart library integration is enabled.
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default AccountantDashboard;
