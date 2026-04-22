import { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Grid,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { createRoute, createZone, getRoutes, getZones } from 'services/api/zonesRoutesService';
import StatusBadge from 'ui-component/StatusBadge';
import { MediumDialog } from 'utils/dialogs';
import { LdButton } from 'utils/myButtons';
import ZoneForm from './components/ZoneForm';
import RouteForm from './components/RouteForm';
import ZonesCoverageMap from './components/ZonesCoverageMap';

const ZonesRoutes = () => {
    const [zones, setZones] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [zoneLoading, setZoneLoading] = useState(false);
    const [routeLoading, setRouteLoading] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
    const [routeDialogOpen, setRouteDialogOpen] = useState(false);

    const loadData = async () => {
        const [zonesRes, routesRes] = await Promise.all([getZones(), getRoutes()]);
        if (zonesRes.code === 1) {
            setZones(zonesRes.data);
        }
        if (routesRes.code === 1) {
            setRoutes(routesRes.data);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreateZone = async (values) => {
        setZoneLoading(true);
        setFeedback(null);

        try {
            const response = await createZone(values);
            if (response.code === 1) {
                setFeedback({ type: 'success', message: response.message });
                setZoneDialogOpen(false);
                await loadData();
                return;
            }
            setFeedback({ type: 'error', message: response.message });
        } catch (error) {
            setFeedback({ type: 'error', message: 'Unable to create zone right now.' });
        } finally {
            setZoneLoading(false);
        }
    };

    const handleCreateRoute = async (values) => {
        setRouteLoading(true);
        setFeedback(null);

        try {
            const response = await createRoute(values);
            if (response.code === 1) {
                setFeedback({ type: 'success', message: response.message });
                setRouteDialogOpen(false);
                await loadData();
                return;
            }
            setFeedback({ type: 'error', message: response.message });
        } catch (error) {
            setFeedback({ type: 'error', message: 'Unable to create route right now.' });
        } finally {
            setRouteLoading(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Zones and Routes
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Create service zones first, then define routes within each zone.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2.5 }}>
                <LdButton startIcon={<Add />} onClick={() => setZoneDialogOpen(true)}>
                    Add Zone
                </LdButton>
                <LdButton startIcon={<Add />} variant="outlined" onClick={() => setRouteDialogOpen(true)}>
                    Add Route
                </LdButton>
            </Stack>

            {feedback && (
                <Alert severity={feedback.type} sx={{ mb: 2.5 }}>
                    {feedback.message}
                </Alert>
            )}

            <ZonesCoverageMap zones={zones} />

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Zones
                        </Typography>
                        <Grid container spacing={1}>
                            {zones.map((zone) => (
                                <Grid item xs={12} key={zone.id}>
                                    <Paper sx={{ p: 1.25, border: '1px solid', borderColor: 'divider' }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                            <Box>
                                                <Typography variant="subtitle2">{zone.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {zone.zone_code} - {zone.city}
                                                </Typography>
                                            </Box>
                                            <StatusBadge label={zone.status} size="small" />
                                        </Stack>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Routes Table
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Route ID</TableCell>
                                    <TableCell>Route Name</TableCell>
                                    <TableCell>Zone</TableCell>
                                    <TableCell>Path</TableCell>
                                    <TableCell>Duration</TableCell>
                                    <TableCell>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {routes.map((route) => (
                                    <TableRow key={route.id}>
                                        <TableCell>{route.route_code}</TableCell>
                                        <TableCell>{route.route_name}</TableCell>
                                        <TableCell>{route.zone_name || route.zone_code}</TableCell>
                                        <TableCell>
                                            {route.start_point} {'->'} {route.end_point}
                                        </TableCell>
                                        <TableCell>{route.estimated_duration_mins} mins</TableCell>
                                        <TableCell>
                                            <StatusBadge label={route.status} size="small" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>
            </Grid>

            <MediumDialog open={zoneDialogOpen} onClose={() => setZoneDialogOpen(false)} title="Create Zone">
                <ZoneForm open={zoneDialogOpen} onSubmit={handleCreateZone} loading={zoneLoading} onCancel={() => setZoneDialogOpen(false)} />
            </MediumDialog>

            <MediumDialog open={routeDialogOpen} onClose={() => setRouteDialogOpen(false)} title="Create Route">
                <RouteForm
                    open={routeDialogOpen}
                    zones={zones}
                    onSubmit={handleCreateRoute}
                    loading={routeLoading}
                    onCancel={() => setRouteDialogOpen(false)}
                />
            </MediumDialog>
        </Box>
    );
};

export default ZonesRoutes;
