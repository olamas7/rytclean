import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import { Edit, Visibility } from '@mui/icons-material';
import { createRoute, createZone, getZones } from 'services/api/zonesRoutesService';
import { fleetGet, fleetPut, fleetPatch } from 'services/api/fleetService';
import { PageHeader } from 'ui-component/PageLayout';
import StatusBadge from 'ui-component/StatusBadge';
import { AppTable, TableActionButton, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { LdButton } from 'utils/myButtons';
import useInlineNavigation from 'utils/useInlineNavigation';
import ZoneForm from './components/ZoneForm';
import RouteForm from './components/RouteForm';
import ZonesCoverageMap from './components/ZonesCoverageMap';
import FleetMap from 'views/Management/Fleet/FleetMap';
import FleetForm from 'views/Management/Fleet/FleetForm';

const sections = { 'new-zone': { label: 'New Zone' }, 'new-route': { label: 'New Route' }, 'edit-zone': { label: 'Edit Zone' }, 'edit-route': { label: 'Edit Route' }, route: { label: 'Route Details', contextKeys: ['route'] }, stops: { label: 'Configure Customer Stops', parent: 'route' } };
export default function ZonesRoutes() {
    const [zones, setZones] = useState([]);
    const [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [query, setQuery] = useState('');
    const lock = useRef(false);
    const inline = useInlineNavigation({ sections, rootLabel: 'Zones & Routes', contextKeys: ['zone', 'route'], blocked: saving });
    const canManage = ['Admin', 'Super Admin', 'Manager'].includes(localStorage.getItem('admin_role'));
    const route = options?.routes.find((item) => String(item.id) === inline.params.get('route'));
    const zone = zones.find((item) => String(item.id) === inline.params.get('zone'));
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try { const [zoneResponse, metadata] = await Promise.all([getZones(), fleetGet('/options')]); if (zoneResponse.code !== 1) throw new Error(zoneResponse.message); setZones(zoneResponse.data); setOptions(metadata); }
        catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { if (canManage) load(); else setLoading(false); }, [canManage, load]);
    const open = (view, values) => { setError(''); setFeedback(''); inline.open(view, values); };
    const save = async (work) => {
        if (lock.current) return;
        lock.current = true; setSaving(true); setError('');
        try { await work(); inline.close(); setFeedback('Zone/route configuration saved. Existing route assignments retain their snapshots.'); await load(); }
        catch (err) { setError(err.response?.data?.message || err.message); }
        finally { lock.current = false; setSaving(false); }
    };
    const create = async (work) => { const response = await work(); if (response.code !== 1) throw new Error(response.message); };
    if (!canManage) return <Alert severity="info">Manager or administrator access is required to configure zones and routes.</Alert>;
    if (inline.view) {
        const needsRoute = ['edit-route', 'route', 'stops'].includes(inline.view);
        const needsZone = inline.view === 'edit-zone';
        const previewStops = (options?.routeStops || []).filter((stop) => stop.route_id === route?.id).map((stop) => { const customer = options.customers.find((item) => item.id === stop.customer_id); return customer && { id: customer.id, customer_name: customer.name, customer_code: customer.customer_code, latitude: customer.latitude, longitude: customer.longitude, stop_order: stop.stop_order, complaint: customer.complaint, status: 'pending' }; }).filter(Boolean);
        return <Box sx={{ p: { xs: 1, md: 2 } }}><Stack spacing={2}>
            <PageHeader title={sections[inline.view].label} inlineNavigation={inline.navigation} />
            {error && <Alert severity="error">{error}</Alert>}{feedback && <Alert severity="success">{feedback}</Alert>}
            {loading ? <Typography role="status">Loading zone/route data…</Typography> : (needsRoute && !route) || (needsZone && !zone) ? <Alert severity="warning">Record not found. Go back and select a valid zone or route.</Alert> : !options ? <LdButton onClick={load} loading={loading}>Retry</LdButton> : inline.view === 'route' ? <>
                <Typography variant="h3">{route.route_name} · {route.route_code}</Typography>
                <Typography>{route.zone_name} · {route.start_point} → {route.end_point} · Estimated {route.estimated_duration_mins} minutes · {previewStops.length} customer stops</Typography>
                <Alert severity="info">Planning preview only. The drawn route is the adherence reference, not calculated road directions. Include the actual collection streets and configure customer stop order before assigning a vehicle.</Alert>
                <Box><LdButton onClick={() => open('stops', { route: route.id })}>Configure Customer Stops</LdButton></Box>
                <FleetMap run={{ route_geojson: typeof route.route_geojson === 'string' ? JSON.parse(route.route_geojson) : route.route_geojson, stops: previewStops }} />
            </> : <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, maxWidth: 1100, mx: 'auto', width: '100%' }}>
                {inline.view === 'stops' ? <FleetForm view="stops" params={inline.params} options={options} saving={saving} error={error} onCancel={inline.back} onSave={(path, payload) => save(() => fleetPut(path, payload))} /> : ['new-zone', 'edit-zone'].includes(inline.view) ? <ZoneForm key={zone?.id || 'new'} open initialValues={needsZone ? zone : null} loading={saving} onCancel={inline.back} onSubmit={(values) => save(() => needsZone ? fleetPatch(`/zones/${zone.id}`, values) : create(() => createZone(values)))} /> : <RouteForm key={route?.id || 'new'} open zones={zones} initialValues={inline.view === 'edit-route' ? route : null} loading={saving} onCancel={inline.back} onSubmit={(values) => save(() => inline.view === 'edit-route' ? fleetPatch(`/routes/${route.id}`, values) : create(() => createRoute(values)))} />}
            </Paper>}
        </Stack></Box>;
    }
    return <Box sx={{ p: { xs: 1, md: 2 } }}><Stack spacing={2}>
        <PageHeader title="Zones & Routes" description="Draw/edit service areas and routes, configure customer stops, then assign a driver and vehicle." actions={<><LdButton variant="outlined" loading={loading} onClick={load}>Refresh</LdButton><LdButton onClick={() => open('new-zone')}>Add Zone</LdButton><LdButton variant="outlined" disabled={!zones.length} onClick={() => open('new-route')}>Add Route</LdButton></>} />
        {feedback && <Alert severity="success">{feedback}</Alert>}
        <ZonesCoverageMap zones={zones} />
        <AppTable ariaLabel="Service zones" rows={zones} loading={loading} error={error} onRetry={load} columns={[
            { id: 'name', label: 'Zone', render: (item) => <TablePrimaryText primary={item.name} secondary={item.zone_code} /> }, { id: 'city', label: 'City' }, { id: 'coverage_area', label: 'Coverage Area' },
            { id: 'status', label: 'Status', render: (item) => <StatusBadge label={item.status} /> },
            { id: 'actions', label: 'Actions', render: (item) => <TableActionButton label={`Edit ${item.name}`} icon={<Edit />} onClick={() => open('edit-zone', { zone: item.id })} /> }
        ]} emptyTitle="No service zones" toolbar={<TableToolbar title="Zones" count={zones.length} />} />
        <AppTable ariaLabel="Collection routes" rows={(options?.routes || []).filter((item) => `${item.route_name} ${item.route_code} ${item.zone_name}`.toLowerCase().includes(query.toLowerCase()))} loading={loading} error={error} onRetry={load} columns={[
            { id: 'route_name', label: 'Route', render: (item) => <TablePrimaryText primary={item.route_name} secondary={item.route_code} /> }, { id: 'zone_name', label: 'Zone' },
            { id: 'stops', label: 'Customer Stops', render: (item) => options.routeStops.filter((stop) => stop.route_id === item.id).length },
            { id: 'status', label: 'Status', render: (item) => <StatusBadge label={item.status} /> },
            { id: 'actions', label: 'Actions', render: (item) => <Stack direction="row" spacing={1}><TableActionButton label={`View ${item.route_name} and configure stops`} icon={<Visibility />} onClick={() => open('route', { route: item.id })} /><TableActionButton label={`Edit ${item.route_name}`} icon={<Edit />} onClick={() => open('edit-route', { route: item.id })} /></Stack> }
        ]} emptyTitle="No collection routes" toolbar={<TableToolbar title="Routes" count={options?.routes.length} searchValue={query} onSearchChange={setQuery} searchLabel="Search route or zone" />} />
    </Stack></Box>;
}
