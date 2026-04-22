import { useEffect, useMemo, useState } from 'react';
import { Box, Grid, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { getPickups } from 'services/api/pickupsService';
import StatusBadge from 'ui-component/StatusBadge';

const PickupManagement = () => {
    const [pickups, setPickups] = useState([]);
    const [status, setStatus] = useState('all');

    useEffect(() => {
        const loadPickups = async () => {
            const response = await getPickups();
            if (response.code === 1) {
                setPickups(response.data);
            }
        };

        loadPickups();
    }, []);

    const filtered = useMemo(() => pickups.filter((pickup) => (status === 'all' ? true : pickup.status === status)), [pickups, status]);

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Pickup Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                View pickup jobs and filter by current status.
            </Typography>

            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={4}>
                        <TextField select fullWidth label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
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
                            <TableCell>Date</TableCell>
                            <TableCell>Zone</TableCell>
                            <TableCell>Driver</TableCell>
                            <TableCell>Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.map((pickup) => (
                            <TableRow key={pickup.id}>
                                <TableCell>{pickup.id}</TableCell>
                                <TableCell>{pickup.pickupDate}</TableCell>
                                <TableCell>{pickup.zoneId}</TableCell>
                                <TableCell>{pickup.driverId || '-'}</TableCell>
                                <TableCell>
                                    <StatusBadge label={pickup.status} size="small" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default PickupManagement;
