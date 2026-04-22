import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Grid, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { getCustomers, getPickupRequests } from 'services/mockApi';
import StatusBadge from 'ui-component/StatusBadge';

const PickupOversight = () => {
    const [pickups, setPickups] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        const loadData = async () => {
            const [pickupsRes, customersRes] = await Promise.all([getPickupRequests(), getCustomers()]);

            if (pickupsRes.code === 1) {
                setPickups(pickupsRes.data);
            }

            if (customersRes.code === 1) {
                setCustomers(customersRes.data);
            }
        };

        loadData();
    }, []);

    const customerMap = useMemo(() => {
        const map = new Map();
        customers.forEach((customer) => map.set(customer.id, customer));
        return map;
    }, [customers]);

    const filtered = useMemo(
        () => pickups.filter((pickup) => (statusFilter === 'all' ? true : pickup.status === statusFilter)),
        [pickups, statusFilter]
    );

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Pickup Oversight
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Review pickups, flag misses, and approve or reject proof submissions.
            </Typography>

            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={4}>
                        <TextField
                            select
                            fullWidth
                            label="Pickup Status"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="scheduled">Scheduled</MenuItem>
                            <MenuItem value="assigned">Assigned</MenuItem>
                            <MenuItem value="on the way">On The Way</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                        </TextField>
                    </Grid>
                </Grid>

                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Pickup ID</TableCell>
                            <TableCell>Customer</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Supervisor Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.map((pickup) => {
                            const isMissedLike = pickup.status !== 'completed' && pickup.pickupDate < '2026-04-22';

                            return (
                                <TableRow key={pickup.id}>
                                    <TableCell>{pickup.id}</TableCell>
                                    <TableCell>{customerMap.get(pickup.customerId)?.fullName || pickup.customerId}</TableCell>
                                    <TableCell>{pickup.pickupDate}</TableCell>
                                    <TableCell>
                                        <StatusBadge label={isMissedLike ? 'missed' : pickup.status} size="small" />
                                    </TableCell>
                                    <TableCell>
                                        <Grid container spacing={0.75}>
                                            <Grid item>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    color={isMissedLike ? 'warning' : 'primary'}
                                                    sx={{ textTransform: 'none' }}
                                                >
                                                    {isMissedLike ? 'Flagged Missed' : 'Flag Missed'}
                                                </Button>
                                            </Grid>
                                            <Grid item>
                                                <Button variant="contained" size="small" color="success" sx={{ textTransform: 'none' }}>
                                                    Approve Proof
                                                </Button>
                                            </Grid>
                                            <Grid item>
                                                <Button variant="text" size="small" color="error" sx={{ textTransform: 'none' }}>
                                                    Reject Proof
                                                </Button>
                                            </Grid>
                                        </Grid>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default PickupOversight;
