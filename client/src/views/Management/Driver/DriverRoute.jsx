import { useEffect, useMemo, useState } from 'react';
import { Box, Grid, Paper, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { getCustomers, getRoutes } from 'services/mockApi';

const DRIVER_ID = 'DRV-001';

const DriverRoute = () => {
    const [route, setRoute] = useState(null);
    const [customers, setCustomers] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            const [routesRes, customersRes] = await Promise.all([getRoutes(), getCustomers()]);

            if (routesRes.code === 1) {
                setRoute(routesRes.data.find((item) => item.driverId === DRIVER_ID) || null);
            }

            if (customersRes.code === 1) {
                setCustomers(customersRes.data);
            }
        };

        loadData();
    }, []);

    const stopNames = useMemo(() => {
        if (!route) {
            return [];
        }

        return route.stops.map((customerId) => customers.find((customer) => customer.id === customerId)?.fullName || customerId);
    }, [customers, route]);

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Route
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Route list, map placeholder, and stop order timeline.
            </Typography>

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={5}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Route List
                        </Typography>
                        <Typography variant="body2">Route ID: {route?.id || '-'}</Typography>
                        <Typography variant="body2">Zone: {route?.zoneId || '-'}</Typography>
                        <Typography variant="body2">Estimated Duration: {route?.estimatedDurationMins || '-'} mins</Typography>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2.5 }}>
                        <Typography variant="h4" sx={{ mb: 1 }}>
                            Map Placeholder
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Map and live navigation view will be integrated here.
                        </Typography>
                    </Paper>

                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 2 }}>
                            Stop Order Timeline
                        </Typography>
                        <Stepper activeStep={0} orientation="vertical">
                            {stopNames.map((stop) => (
                                <Step key={stop}>
                                    <StepLabel>{stop}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default DriverRoute;
