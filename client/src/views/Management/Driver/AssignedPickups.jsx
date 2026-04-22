import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Grid, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { getCustomers, getPickupRequests } from 'services/mockApi';
import StatusBadge from 'ui-component/StatusBadge';

const DRIVER_ID = 'DRV-001';

const AssignedPickups = () => {
    const [pickups, setPickups] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        const loadData = async () => {
            const [pickupsRes, customersRes] = await Promise.all([getPickupRequests(), getCustomers()]);
            if (pickupsRes.code === 1) {
                setPickups(pickupsRes.data.filter((pickup) => pickup.driverId === DRIVER_ID));
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

    const filteredPickups = useMemo(
        () => pickups.filter((pickup) => (statusFilter === 'all' ? true : pickup.status === statusFilter)),
        [pickups, statusFilter]
    );

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Assigned Pickups
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                View assigned jobs and update completion workflow.
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
                            <TableCell>Customer</TableCell>
                            <TableCell>Address</TableCell>
                            <TableCell>Waste Type</TableCell>
                            <TableCell>Pickup Time</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredPickups.map((pickup) => (
                            <TableRow key={pickup.id}>
                                <TableCell>{customerMap.get(pickup.customerId)?.fullName || pickup.customerId}</TableCell>
                                <TableCell>{pickup.address}</TableCell>
                                <TableCell>{pickup.wasteType}</TableCell>
                                <TableCell>{pickup.pickupTime}</TableCell>
                                <TableCell>
                                    <StatusBadge label={pickup.status} size="small" />
                                </TableCell>
                                <TableCell>
                                    <Grid container spacing={0.75}>
                                        <Grid item>
                                            <Button size="small" variant="outlined" sx={{ textTransform: 'none' }}>
                                                View Details
                                            </Button>
                                        </Grid>
                                        <Grid item>
                                            <Button size="small" variant="contained" sx={{ textTransform: 'none' }}>
                                                Mark Completed
                                            </Button>
                                        </Grid>
                                        <Grid item>
                                            <Button size="small" variant="text" sx={{ textTransform: 'none' }}>
                                                Upload Proof
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default AssignedPickups;
