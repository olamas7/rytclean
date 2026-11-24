import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { Add, Edit, Visibility } from '@mui/icons-material';
import { fleetGet, fleetPost, fleetPut, fleetPatch } from 'services/api/fleetService';
import { PageHeader } from 'ui-component/PageLayout';
import { AppTable, TableActionButton, TableFilter, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { LdButton } from 'utils/myButtons';
import useInlineNavigation from 'utils/useInlineNavigation';
import { formatDate } from 'utils/formatters';
import StatusBadge from 'ui-component/StatusBadge';
import RunDetail from './RunDetail';
import FleetForm from './FleetForm';
import FleetMap, { FleetOverviewMap } from './FleetMap';

const sections = {
    run: { label: 'Route Assignment', contextKeys: ['run'] }, assignment: { label: 'Assign Collection Route' },
    vehicle: { label: 'Vehicle Details' }, stops: { label: 'Configure Route Stops' },
    fuel: { label: 'Route Fuel / Cheque', parent: 'run' }, state: { label: 'Route State', parent: 'run' }, confirm: { label: 'Pickup Evidence', parent: 'run' }
};
export default function FleetWorkspace({ title = 'Route Assignments & Vehicles', purpose = 'operations' }) {
    const role = localStorage.getItem('admin_role');
    const manager = ['Admin', 'Super Admin', 'Manager'].includes(role);
    const [runs, setRuns] = useState([]);
    const [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [tab, setTab] = useState('runs');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const lock = useRef(false);
    const inline = useInlineNavigation({ sections, rootLabel: title, parameter: 'fleetView', contextKeys: ['run', 'stop', 'vehicle', 'route', 'entry', 'operation'], blocked: saving });
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [jobs, metadata] = await Promise.all([fleetGet('/runs'), manager ? fleetGet('/options') : Promise.resolve(null)]);
            setRuns(jobs); setOptions(metadata);
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setLoading(false); }
    }, [manager]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (inline.view) return undefined;
        const timer = setInterval(() => { if (!document.hidden) load(); }, 30000);
        return () => clearInterval(timer);
    }, [inline.view, load]);
    const open = (view, values) => { setSaveError(''); setFeedback(''); inline.open(view, values); };
    const save = async (path, payload, method = 'post') => {
        if (lock.current) return;
        lock.current = true; setSaving(true); setSaveError('');
        try {
            await ({ post: fleetPost, put: fleetPut, patch: fleetPatch }[method])(path, payload);
            inline.close(); setFeedback('Fleet record saved successfully.'); await load();
        } catch (err) { setSaveError(err.response?.data?.message || err.message); }
        finally { lock.current = false; setSaving(false); }
    };
    if (inline.view) return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title={sections[inline.view].label} inlineNavigation={inline.navigation} />
        {feedback && <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert>}
        {inline.view === 'run' ? inline.params.get('run') ? <RunDetail key={inline.params.get('run')} runId={inline.params.get('run')} onOpen={open} /> : <Alert severity="warning">Choose a valid assignment from the list.</Alert> : loading ? <Typography role="status">Loading fleet data…</Typography> : error ? <Alert severity="error" action={<LdButton onClick={load} loading={loading}>Retry</LdButton>}>{error}</Alert> : <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, maxWidth: 1100, mx: 'auto' }}>
            <FleetForm key={`${inline.view}:${inline.params.get('run')}:${inline.params.get('entry')}:${inline.params.get('vehicle')}:${inline.params.get('stop')}:${inline.params.get('operation')}`} view={inline.view} params={inline.params} options={options} saving={saving} error={saveError} onCancel={inline.back} onSave={save} />
        </Paper>}
    </Box>;
    const active = runs.find((run) => ['assigned', 'started'].includes(run.status));
    const rows = runs.filter((run) => (status === 'all' || run.status === status) && `${run.route_name} ${run.driver_name} ${run.registration}`.toLowerCase().includes(search.toLowerCase()));
    const columns = [
        { id: 'route_name', label: 'Assigned Route', render: (run) => <TablePrimaryText primary={run.route_name} secondary={`#${run.id} · ${formatDate(run.service_date)}`} /> },
        { id: 'driver_name', label: 'Driver / Vehicle', render: (run) => <TablePrimaryText primary={run.driver_name} secondary={run.registration} /> },
        { id: 'status', label: 'Status / Tracking', render: (run) => <Stack spacing={0.5} alignItems="flex-start"><StatusBadge label={run.status} /><Typography variant="caption">{run.tracking} · {run.movement}</Typography></Stack> },
        { id: 'distanceKm', label: 'Distance / Stops', render: (run) => <TablePrimaryText primary={`${run.distanceKm.toFixed(2)} km GPS`} secondary={`${run.collected_stops}/${run.total_stops} collected`} /> },
        { id: 'actions', label: 'Actions', render: (run) => <TableActionButton label={`Open ${run.route_name} assignment ${run.id}`} icon={<Visibility />} onClick={() => open('run', { run: run.id })} /> }
    ];
    return <Box sx={{ p: { xs: 1, md: 2 } }}><Stack spacing={2}>
        <PageHeader title={title} description={purpose === 'driver' ? 'Your assigned vehicle, route, monitoring and customer stops.' : purpose === 'finance' ? 'Route-linked fuel issues, cheque references and distance comparisons.' : 'Assign routes and monitor real driver GPS, visits, collection evidence and vehicle use.'} actions={<>
            <LdButton variant="outlined" onClick={load} loading={loading}>Refresh</LdButton>
            {manager && purpose === 'operations' && <><LdButton startIcon={<Add />} onClick={() => open('assignment')} disabled={loading || Boolean(error)}>Assign Route</LdButton><LdButton variant="outlined" onClick={() => open('vehicle')} disabled={loading || Boolean(error)}>Add Vehicle</LdButton><LdButton variant="outlined" onClick={() => open('stops')} disabled={loading || Boolean(error)}>Configure Route Stops</LdButton></>}
        </>} />
        {feedback && <Alert severity="success">{feedback}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <Alert severity="info">No GPS is assumed. Locations become stale after 2 minutes. GPS proximity marks visited only; drivers must confirm collection. Lists refresh every 30 seconds, detail views every 15 seconds while visible.</Alert>
        {(purpose === 'monitor' || (manager && purpose === 'operations' && tab === 'runs')) && <FleetOverviewMap runs={runs} />}
        {purpose === 'driver' && active && <>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography variant="h3">Current assignment: {active.route_name}</Typography><Typography>{active.registration} · {active.driver_name} · {active.tracking}</Typography><Typography variant="body2">Last accepted GPS: {active.latest_at ? new Date(active.latest_at).toLocaleString('en-GH') : 'No position transmitted yet'}</Typography><LdButton onClick={() => open('run', { run: active.id })}>Open Route &amp; Tracking</LdButton></Paper>
            <FleetMap run={active} />
        </>}
        {manager && purpose === 'operations' && <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Fleet sections"><Tab value="runs" label="Route Assignments" /><Tab value="vehicles" label="Vehicles" /></Tabs>}
        {tab === 'vehicles' && manager ? <AppTable ariaLabel="Fleet vehicles" loading={loading} error={error} onRetry={load} rows={options?.vehicles || []} columns={[
            { id: 'registration', label: 'Vehicle', render: (vehicle) => <TablePrimaryText primary={vehicle.registration} secondary={vehicle.description} /> },
            { id: 'status', label: 'Availability', render: (vehicle) => <StatusBadge label={vehicle.open_run_id ? 'assigned' : vehicle.status} /> },
            { id: 'expected_l_per_100km', label: 'Expected L / 100 km', render: (vehicle) => vehicle.expected_l_per_100km || 'Not set' },
            { id: 'actions', label: 'Actions', render: (vehicle) => <TableActionButton label={`Edit ${vehicle.registration}`} icon={<Edit />} disabled={Boolean(vehicle.open_run_id)} tooltip={vehicle.open_run_id ? 'Finish/cancel the open assignment before editing' : 'Edit vehicle'} onClick={() => open('vehicle', { vehicle: vehicle.id })} /> }
        ]} emptyTitle="No vehicles registered" toolbar={<TableToolbar title="Vehicles" count={options?.vehicles.length} />} /> : <AppTable ariaLabel="Collection route assignments" columns={columns} rows={rows} loading={loading} error={error} onRetry={load} emptyTitle="No matching route assignments" emptyDescription={purpose === 'driver' ? 'Your manager must assign a route to your linked driver profile.' : 'Configure customer stops, an available vehicle and driver, then assign a route.'} toolbar={<TableToolbar title="Latest 200 Route Assignments" count={rows.length} searchValue={search} onSearchChange={setSearch} searchLabel="Search route, driver or vehicle" filters={<TableFilter label="Status" value={status} onChange={setStatus} options={['assigned', 'started', 'completed', 'cancelled'].map((value) => ({ value, label: value }))} />} />} />}
    </Stack></Box>;
}
FleetWorkspace.propTypes = { title: PropTypes.string, purpose: PropTypes.oneOf(['operations', 'driver', 'monitor', 'finance']) };
