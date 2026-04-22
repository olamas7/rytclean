import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography
} from '@mui/material';
import { getCustomerPayments } from 'services/mockApi';
import StatusBadge from 'ui-component/StatusBadge';

const CUSTOMER_ID = 'CUST-001';

const CustomerPayments = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [payments, setPayments] = useState([]);

    useEffect(() => {
        const loadPayments = async () => {
            setLoading(true);
            setError('');

            try {
                const response = await getCustomerPayments(CUSTOMER_ID);
                if (response.code !== 1) {
                    setError('Unable to load payment details.');
                    return;
                }
                setPayments(response.data);
            } catch {
                setError('Unable to load payment details.');
            } finally {
                setLoading(false);
            }
        };

        loadPayments();
    }, []);

    const outstandingBalance = useMemo(
        () => payments.filter((payment) => payment.status !== 'paid').reduce((total, payment) => total + payment.amount, 0),
        [payments]
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
                Payments
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Manage balances, methods, and transaction history.
            </Typography>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            ) : null}

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1 }}>
                            Outstanding Balance
                        </Typography>
                        <Typography variant="h3">GHS {outstandingBalance}</Typography>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Payment Methods
                        </Typography>
                        <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={4}>
                                <Paper sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>Mobile Money</Paper>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Paper sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>Card</Paper>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Paper sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>Bank Transfer</Paper>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                <Grid item xs={12}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Payment History
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Reference</TableCell>
                                    <TableCell>Amount</TableCell>
                                    <TableCell>Method</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Date</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {payments.map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell>{payment.reference}</TableCell>
                                        <TableCell>
                                            {payment.currency} {payment.amount}
                                        </TableCell>
                                        <TableCell>{payment.method}</TableCell>
                                        <TableCell>
                                            <StatusBadge label={payment.status} size="small" />
                                        </TableCell>
                                        <TableCell>{payment.paidAt ? payment.paidAt.slice(0, 10) : '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>

                <Grid item xs={12}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1 }}>
                            Subscription Renewal
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Next cycle renewal is ready. Complete payment to keep active service.
                        </Typography>
                        <Button variant="contained">Pay Now</Button>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CustomerPayments;
