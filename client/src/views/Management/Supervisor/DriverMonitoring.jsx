import { useEffect, useMemo, useState } from 'react';
import { Box, Grid, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { getDrivers } from 'services/api/driversService';
import { getPickups } from 'services/api/pickupsService';
import StatusBadge from 'ui-component/StatusBadge';

const DriverMonitoring = () => {
    const [drivers, setDrivers] = useState([]);
    const [pickups, setPickups] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        const loadData = async () => {
            const [driversRes, pickupsRes] = await Promise.all([getDrivers(), getPickups()]);

            if (driversRes.code === 1) {
                setDrivers(driversRes.data);
            }

            if (pickupsRes.code === 1) {
                setPickups(pickupsRes.data);
            }
        };

        loadData();
    }, []);

    const lateCountsByDriver = useMemo(() => {
        const map = new Map();
        pickups.forEach((pickup) => {
            if (!pickup.driverId) {
                return;
            }

            const isLateLike = pickup.status !== 'completed' && pickup.pickupDate < new Date().toISOString().slice(0, 10);
            if (isLateLike) {
                map.set(pickup.driverId, (map.get(pickup.driverId) || 0) + 1);
            }
        });
        return map;
    }, [pickups]);

    const filteredDrivers = useMemo(
        () => drivers.filter((driver) => (statusFilter === 'all' ? true : driver.status === statusFilter)),
        [drivers, statusFilter]
    );

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Driver Monitoring
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Driver list, performance metrics, and route adherence placeholder.
            </Typography>

            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={4}>
                        <TextField
                            select
                            fullWidth
                            label="Driver Status"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="available">Available</MenuItem>
                            <MenuItem value="on-route">On Route</MenuItem>
                            <MenuItem value="off-duty">Off Duty</MenuItem>
                        </TextField>
                    </Grid>
                </Grid>

                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Driver</TableCell>
                            <TableCell>Vehicle</TableCell>
                            <TableCell>Completion %</TableCell>
                            <TableCell>Late Pickups</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Route Adherence</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredDrivers.map((driver) => (
                            <TableRow key={driver.id}>
                                <TableCell>
                                    <Typography variant="subtitle2">{driver.fullName}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {driver.id}
                                    </Typography>
                                </TableCell>
                                <TableCell>{driver.vehicleNumber}</TableCell>
                                <TableCell>{driver.completionRate}%</TableCell>
                                <TableCell>{lateCountsByDriver.get(driver.id) || 0}</TableCell>
                                <TableCell>
                                    <StatusBadge label={driver.status} size="small" />
                                </TableCell>
                                <TableCell>Placeholder</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default DriverMonitoring;
