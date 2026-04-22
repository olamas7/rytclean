import { useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { getPickupRequests, getRoutes } from 'services/mockApi';

const DRIVER_ID = 'DRV-001';

const cardStyle = {
    p: 2.25,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    height: '100%'
};

const DriverDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [pickups, setPickups] = useState([]);
    const [route, setRoute] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);

            const [pickupsRes, routesRes] = await Promise.all([getPickupRequests(), getRoutes()]);

            if (pickupsRes.code === 1) {
                setPickups(pickupsRes.data.filter((pickup) => pickup.driverId === DRIVER_ID));
            }

            if (routesRes.code === 1) {
                setRoute(routesRes.data.find((item) => item.driverId === DRIVER_ID) || null);
            }

            setLoading(false);
        };

        loadData();
    }, []);

    const stats = useMemo(() => {
        const completed = pickups.filter((pickup) => pickup.status === 'completed').length;
        const pending = pickups.filter((pickup) => pickup.status !== 'completed').length;

        return [
            { label: 'Today Assigned Pickups', value: pickups.length },
            { label: 'Completed Pickups', value: completed },
            { label: 'Pending Pickups', value: pending },
            { label: 'Route Summary', value: route ? `${route.id} (${route.stops.length} stops)` : 'No route assigned' }
        ];
    }, [pickups, route]);

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
                Driver Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Daily pickup workload and route snapshot.
            </Typography>

            <Grid container spacing={2.5}>
                {stats.map((item) => (
                    <Grid item xs={12} sm={6} key={item.label}>
                        <Paper sx={cardStyle}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                {item.label}
                            </Typography>
                            <Typography variant="h4">{item.value}</Typography>
                        </Paper>
                    </Grid>
                ))}

                <Grid item xs={12}>
                    <Paper sx={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body1">Start your assigned route and begin pickup updates.</Typography>
                        <Button variant="contained">Start Route</Button>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default DriverDashboard;
