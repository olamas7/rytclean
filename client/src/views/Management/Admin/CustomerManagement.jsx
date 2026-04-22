import { useEffect, useMemo, useState } from 'react';
import { Box, Grid, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { getCustomers } from 'services/mockApi';
import StatusBadge from 'ui-component/StatusBadge';

const CustomerManagement = () => {
    const [customers, setCustomers] = useState([]);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');

    useEffect(() => {
        const loadCustomers = async () => {
            const response = await getCustomers();
            if (response.code === 1) {
                setCustomers(response.data);
            }
        };

        loadCustomers();
    }, []);

    const filtered = useMemo(
        () =>
            customers.filter((customer) => {
                const matchesStatus = status === 'all' ? true : customer.status === status;
                const value = query.trim().toLowerCase();
                const matchesQuery =
                    !value ||
                    customer.fullName.toLowerCase().includes(value) ||
                    customer.email.toLowerCase().includes(value) ||
                    customer.id.toLowerCase().includes(value);
                return matchesStatus && matchesQuery;
            }),
        [customers, query, status]
    );

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Customer Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Search and filter customer records by status.
            </Typography>

            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={8}>
                        <TextField
                            fullWidth
                            label="Search by name, email, or customer ID"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField select fullWidth label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                        </TextField>
                    </Grid>
                </Grid>

                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Customer</TableCell>
                            <TableCell>Contact</TableCell>
                            <TableCell>Zone</TableCell>
                            <TableCell>Plan</TableCell>
                            <TableCell>Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.map((customer) => (
                            <TableRow key={customer.id}>
                                <TableCell>
                                    <Typography variant="subtitle2">{customer.fullName}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {customer.id}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{customer.phone}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {customer.email}
                                    </Typography>
                                </TableCell>
                                <TableCell>{customer.zoneId}</TableCell>
                                <TableCell>{customer.planId}</TableCell>
                                <TableCell>
                                    <StatusBadge label={customer.status} size="small" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default CustomerManagement;
