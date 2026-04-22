import { useEffect, useState } from 'react';
import { Box, Button, Grid, Paper, Stack, Typography } from '@mui/material';
import { getCustomers, getDrivers, getPickupRequests } from 'services/mockApi';

const PICKUP_ID = 'PK-2026-001';

const PickupDetail = () => {
    const [pickup, setPickup] = useState(null);
    const [customer, setCustomer] = useState(null);
    const [driver, setDriver] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            const [pickupsRes, customersRes, driversRes] = await Promise.all([getPickupRequests(), getCustomers(), getDrivers()]);

            if (pickupsRes.code !== 1 || customersRes.code !== 1 || driversRes.code !== 1) {
                return;
            }

            const selectedPickup = pickupsRes.data.find((item) => item.id === PICKUP_ID) || pickupsRes.data[0] || null;
            const selectedCustomer = customersRes.data.find((item) => item.id === selectedPickup?.customerId) || null;
            const selectedDriver = driversRes.data.find((item) => item.id === selectedPickup?.driverId) || null;

            setPickup(selectedPickup);
            setCustomer(selectedCustomer);
            setDriver(selectedDriver);
        };

        loadData();
    }, []);

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Pickup Detail
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Job details, customer information, and completion actions.
            </Typography>

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Stack spacing={1}>
                            <Typography variant="h4">Pickup Information</Typography>
                            <Typography variant="body2">Pickup ID: {pickup?.id || '-'}</Typography>
                            <Typography variant="body2">Customer: {customer?.fullName || '-'}</Typography>
                            <Typography variant="body2">Contact: {customer?.phone || '-'}</Typography>
                            <Typography variant="body2">Address: {pickup?.address || '-'}</Typography>
                            <Typography variant="body2">Waste Type: {pickup?.wasteType || '-'}</Typography>
                            <Typography variant="body2">
                                Notes: {pickup?.emergency ? 'Emergency pickup requested' : 'No additional notes'}
                            </Typography>
                        </Stack>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={5}>
                    <Stack spacing={2.5}>
                        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="h4" sx={{ mb: 1 }}>
                                Map Placeholder
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Route map will appear here once map integration is enabled.
                            </Typography>
                        </Paper>

                        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="h4" sx={{ mb: 1.5 }}>
                                Driver Workflow
                            </Typography>
                            <Stack spacing={1.25}>
                                <Typography variant="body2">Assigned Driver: {driver?.fullName || '-'}</Typography>
                                <Button variant="contained">Mark as Completed</Button>
                                <Button variant="outlined">Upload Proof Photo</Button>
                                <Button variant="text">QR Scan Placeholder</Button>
                            </Stack>
                        </Paper>
                    </Stack>
                </Grid>
            </Grid>
        </Box>
    );
};

export default PickupDetail;
