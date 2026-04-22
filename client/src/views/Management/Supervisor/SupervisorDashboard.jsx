import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { getDrivers, getPickupRequests } from 'services/mockApi';

const cardStyle = {
    p: 2.25,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    height: '100%'
};

const SupervisorDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [drivers, setDrivers] = useState([]);
    const [pickups, setPickups] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);

            const [driversRes, pickupsRes] = await Promise.all([getDrivers(), getPickupRequests()]);

            if (driversRes.code === 1) {
                setDrivers(driversRes.data);
            }

            if (pickupsRes.code === 1) {
                setPickups(pickupsRes.data);
            }

            setLoading(false);
        };

        loadData();
    }, []);

    const stats = useMemo(() => {
        const completedPickups = pickups.filter((pickup) => pickup.status === 'completed').length;
        const missedPickups = pickups.filter((pickup) => pickup.status !== 'completed' && pickup.pickupDate < '2026-04-22').length;
        const avgCompletion =
            drivers.length > 0 ? Math.round(drivers.reduce((sum, driver) => sum + driver.completionRate, 0) / drivers.length) : 0;

        return [
            { label: 'Driver Performance Summary', value: `${avgCompletion}% Avg Completion` },
            { label: 'Missed Pickups', value: missedPickups },
            { label: 'Completed Pickups', value: completedPickups },
            { label: 'Daily Operations Overview', value: `${pickups.length} pickups tracked` }
        ];
    }, [drivers, pickups]);

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
                Supervisor Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Monitor field operations and driver performance in one place.
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
            </Grid>
        </Box>
    );
};

export default SupervisorDashboard;
