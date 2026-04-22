import { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    CircularProgress,
    Grid,
    Paper,
    Stack,
    Step,
    StepLabel,
    Stepper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography
} from '@mui/material';
import { getDrivers, getPickupRequests } from 'services/mockApi';
import StatusBadge from 'ui-component/StatusBadge';

const CUSTOMER_ID = 'CUST-001';
const statusSteps = ['scheduled', 'assigned', 'on the way', 'completed'];

const PickupTracking = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activePickup, setActivePickup] = useState(null);
    const [driver, setDriver] = useState(null);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError('');

            try {
                const [pickupsRes, driversRes] = await Promise.all([getPickupRequests(), getDrivers()]);
                if (pickupsRes.code !== 1 || driversRes.code !== 1) {
                    setError('Unable to load pickup tracking data.');
                    return;
                }

                const customerPickups = pickupsRes.data.filter((pickup) => pickup.customerId === CUSTOMER_ID);
                const latest = customerPickups[0] || null;

                setHistory(customerPickups);
                setActivePickup(latest);
                setDriver(driversRes.data.find((item) => item.id === latest?.driverId) || null);
            } catch {
                setError('Unable to load pickup tracking data.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    if (loading) {
        return (
            <Box sx={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    const activeStep = statusSteps.findIndex((step) => step === activePickup?.status);

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Pickup Tracking
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Track current pickup progress and review history.
            </Typography>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            ) : null}

            <Grid container spacing={2.5}>
                <Grid item xs={12}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 2 }}>
                            Current Pickup Status
                        </Typography>
                        <Stepper activeStep={activeStep < 0 ? 0 : activeStep} alternativeLabel>
                            {statusSteps.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Driver Info
                        </Typography>
                        {driver ? (
                            <Stack spacing={0.75}>
                                <Typography variant="body2">Name: {driver.fullName}</Typography>
                                <Typography variant="body2">Phone: {driver.phone}</Typography>
                                <Typography variant="body2">Vehicle: {driver.vehicleNumber}</Typography>
                                <StatusBadge label={driver.status} size="small" />
                            </Stack>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                Driver details unavailable.
                            </Typography>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Pickup History
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Pickup ID</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Waste Type</TableCell>
                                    <TableCell>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {history.map((pickup) => (
                                    <TableRow key={pickup.id}>
                                        <TableCell>{pickup.id}</TableCell>
                                        <TableCell>{pickup.pickupDate}</TableCell>
                                        <TableCell>{pickup.wasteType}</TableCell>
                                        <TableCell>
                                            <StatusBadge label={pickup.status} size="small" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default PickupTracking;
