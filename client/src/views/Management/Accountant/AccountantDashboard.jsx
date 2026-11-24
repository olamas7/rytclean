import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Grid, Paper, Skeleton, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { getBillingAccounts, getBillingInvoices, getBillingPayments } from 'services/api/billingService';
import { appRoutes } from 'constants/appRoutes';
import { PageHeader } from 'ui-component/PageLayout';
import { formatCurrency } from 'utils/formatters';
import { LdButton } from 'utils/myButtons';

const AccountantDashboard = () => {
    const [data, setData] = useState({ accounts: [], invoices: [], payments: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const responses = await Promise.all([getBillingAccounts(), getBillingInvoices(), getBillingPayments()]);
            const failed = responses.find((response) => response.code !== 1);
            if (failed) throw new Error(failed.message || 'Unable to load billing summary.');
            setData({ accounts: responses[0].data, invoices: responses[1].data, payments: responses[2].data });
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);
    const money = (cents) => formatCurrency(cents / 100);
    const month = new Date().toISOString().slice(0, 7);
    const paid = data.payments.filter((payment) => !payment.reversed);
    const stats = [
        ['Total Payments', money(paid.reduce((sum, row) => sum + row.amountCents, 0))],
        ['This Month’s Payments', money(paid.filter((row) => row.date.startsWith(month)).reduce((sum, row) => sum + row.amountCents, 0))],
        ['Client Amount Owing', money(data.accounts.reduce((sum, row) => sum + Math.max(0, row.balanceCents), 0))],
        ['Client Credit', money(data.accounts.reduce((sum, row) => sum + Math.max(0, -row.balanceCents), 0))],
        ['Overdue', money(data.accounts.reduce((sum, row) => sum + row.overdueCents, 0))],
        ['Settled Bills', data.invoices.filter((invoice) => invoice.status === 'paid').length]
    ];
    return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title="Accountant Dashboard" description="Live subscription billing and recorded payments." actions={<><LdButton variant="outlined" loading={loading} onClick={load}>Refresh</LdButton><LdButton component={Link} to={appRoutes.management.admin.billing}>Client Accounts</LdButton></>} />
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? <Skeleton variant="rounded" height={300} /> : !error && <Grid container spacing={2}>{stats.map(([label, value]) => <Grid item xs={12} sm={6} md={4} key={label}><Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h3" sx={{ mt: 1 }}>{value}</Typography></Paper></Grid>)}</Grid>}
    </Box>;
};
export default AccountantDashboard;
