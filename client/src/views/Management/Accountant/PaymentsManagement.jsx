import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Grid, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { getCustomers, getPayments } from 'services/mockApi';
import StatusBadge from 'ui-component/StatusBadge';

const PaymentsManagement = () => {
    const [payments, setPayments] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const [paymentsRes, customersRes] = await Promise.all([getPayments(), getCustomers()]);

            if (paymentsRes.code === 1) {
                setPayments(paymentsRes.data);
            }

            if (customersRes.code === 1) {
                setCustomers(customersRes.data);
            }
        };

        loadData();
    }, []);

    const customerMap = useMemo(() => {
        const map = new Map();
        customers.forEach((customer) => {
            map.set(customer.id, customer);
        });
        return map;
    }, [customers]);

    const filtered = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return payments.filter((payment) => {
            const customer = customerMap.get(payment.customerId);
            const matchesStatus = statusFilter === 'all' ? true : payment.status === statusFilter;
            const matchesQuery =
                !query ||
                customer?.fullName?.toLowerCase().includes(query) ||
                customer?.email?.toLowerCase().includes(query) ||
                payment.reference.toLowerCase().includes(query);

            return matchesStatus && matchesQuery;
        });
    }, [customerMap, payments, searchQuery, statusFilter]);

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Payments Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Filter payment transactions and inspect customer payment records.
            </Typography>

            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={4}>
                        <TextField
                            select
                            fullWidth
                            label="Status"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="paid">Paid</MenuItem>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="failed">Failed</MenuItem>
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={8}>
                        <TextField
                            fullWidth
                            label="Search customer or reference"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </Grid>
                </Grid>

                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Reference</TableCell>
                            <TableCell>Customer</TableCell>
                            <TableCell>Method</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell>{payment.reference}</TableCell>
                                <TableCell>{customerMap.get(payment.customerId)?.fullName || payment.customerId}</TableCell>
                                <TableCell>{payment.method}</TableCell>
                                <TableCell>
                                    {payment.currency} {payment.amount}
                                </TableCell>
                                <TableCell>
                                    <StatusBadge label={payment.status} size="small" />
                                </TableCell>
                                <TableCell>
                                    <Button variant="outlined" size="small" sx={{ textTransform: 'none' }}>
                                        View Details
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default PaymentsManagement;
