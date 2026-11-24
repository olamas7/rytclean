import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Grid, Paper, Stack, Typography } from '@mui/material';
import { fleetGet, fleetPhoto } from 'services/api/fleetService';
import { AppTable, TableActionButton, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { PhotoCamera, Payments, Undo } from '@mui/icons-material';
import { LdButton } from 'utils/myButtons';
import { MediumDialog } from 'utils/dialogs';
import { formatCurrency, formatDate } from 'utils/formatters';
import StatusBadge from 'ui-component/StatusBadge';
import FleetMap from './FleetMap';
import useForegroundTracking from './useForegroundTracking';
import { Link } from 'react-router-dom';
import { appRoutes } from 'constants/appRoutes';

const timestamp = (value) => value ? new Date(value).toLocaleString('en-GH', { timeZone: 'Africa/Accra' }) : 'Not recorded';
export default function RunDetail({ runId, onOpen, readOnly = false }) {
    const [run, setRun] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [photo, setPhoto] = useState(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [photoOpen, setPhotoOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const sequence = useRef(0);
    const role = localStorage.getItem('admin_role');
    const manager = ['Admin', 'Super Admin', 'Manager'].includes(role);
    const finance = ['Admin', 'Super Admin', 'Accountant'].includes(role);
    const driver = ['Driver', 'Supervisor'].includes(role);
    const load = useCallback(async () => {
        const request = ++sequence.current;
        setRefreshing(true);
        try { const data = await fleetGet(`/runs/${runId}`); if (request === sequence.current) { setRun(data); setError(''); } }
        catch (err) { if (request === sequence.current) setError(err.response?.data?.message || err.message); }
        finally { if (request === sequence.current) { setLoading(false); setRefreshing(false); } }
    }, [runId]);
    useEffect(() => {
        load();
        const timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
        return () => { sequence.current += 1; clearInterval(timer); };
    }, [load]);
    useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
    const gps = useForegroundTracking(runId, driver && !readOnly && run?.status === 'started', load);
    const viewPhoto = async (stop) => {
        setPhotoOpen(true); setPhotoLoading(true); setPhoto(null);
        try { setPhoto(URL.createObjectURL(await fleetPhoto(runId, stop.id))); }
        catch (err) { setError(err.response?.data?.message || 'Evidence photo is unavailable.'); }
        finally { setPhotoLoading(false); }
    };
    if (loading) return <Typography role="status">Loading assigned route…</Typography>;
    if (!run) return <Alert severity="error" action={<LdButton onClick={load}>Retry</LdButton>}>{error || 'Route assignment not found.'}</Alert>;
    const stopped = !gps.active && gps.pending === 0;
    const columns = [
        { id: 'stop_order', label: 'Stop' },
        { id: 'customer_name', label: 'Customer', render: (stop) => <TablePrimaryText primary={stop.customer_name} secondary={`${stop.customer_code} · ${stop.address}`} /> },
        { id: 'status', label: 'Collection', render: (stop) => <StatusBadge label={stop.status.replaceAll('_', ' ')} /> },
        { id: 'complaint', label: 'Attention / Evidence', render: (stop) => <TablePrimaryText primary={stop.complaint ? 'OPEN COMPLAINT · Photo required' : stop.photo_required ? 'Photo required for this assignment' : 'Photo optional'} secondary={stop.complaint_note || stop.note || (stop.visited_at ? `Visited ${timestamp(stop.visited_at)}` : '')} /> },
        { id: 'actions', label: 'Actions', render: (stop) => <Stack direction="row" spacing={1}>
            {driver && !readOnly && run.status === 'started' && ['pending', 'visited'].includes(stop.status) && <LdButton variant="outlined" onClick={() => { gps.stop(); onOpen('confirm', { run: runId, stop: stop.id }); }}>Confirm Visit</LdButton>}
            {stop.hasPhoto && <TableActionButton label={`View evidence for ${stop.customer_name}`} icon={<PhotoCamera />} onClick={() => viewPhoto(stop)} />}
        </Stack> }
    ];
    return <Stack spacing={2}>
        {error && <Alert severity="error" action={<LdButton onClick={load}>Retry</LdButton>}>{error}</Alert>}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack spacing={1}>
            <Typography variant="h3">{run.route_name} · Assignment #{run.id}</Typography>
            <Typography>{run.driver_name} · {run.registration} · Driver and monitoring duties are combined.</Typography>
            <Typography variant="body2">Service: {formatDate(run.service_date)} · Started: {timestamp(run.started_at)} · Ended: {timestamp(run.ended_at)}</Typography>
            <Typography variant="body2">Status: {run.status} · Tracking: <strong>{run.tracking}</strong> · Movement: {run.movement} · GPS speed: {run.latest_speed_kmh ?? '—'} km/h · Last GPS: {timestamp(run.latest_at)} · Accuracy: {run.latest_accuracy || '—'} m · Deviation: {run.latest_deviation_m ?? '—'} m</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <LdButton variant="outlined" onClick={load} loading={refreshing}>Refresh Details</LdButton>
                {!readOnly && (driver || manager) && run.status === 'assigned' && <LdButton onClick={() => onOpen('state', { run: runId, operation: 'start' })}>Start Route</LdButton>}
                {driver && !readOnly && run.status === 'started' && <>
                    <LdButton onClick={gps.active ? gps.stop : gps.start} variant={gps.active ? 'outlined' : 'contained'}>{gps.active ? 'Stop GPS Capture' : 'Start GPS Tracking'}</LdButton>
                    <LdButton variant="outlined" onClick={gps.flush} disabled={!gps.pending}>Upload Buffered GPS ({gps.pending})</LdButton>
                </>}
                {!readOnly && (driver || manager) && run.status === 'started' && <LdButton disabled={!stopped} tooltip={!stopped ? 'Stop GPS capture and upload buffered positions before finishing' : ''} onClick={() => onOpen('state', { run: runId, operation: 'finish' })}>Finish Route</LdButton>}
                {!readOnly && manager && ['assigned', 'started'].includes(run.status) && <LdButton variant="outlined" onClick={() => { gps.stop(); onOpen('state', { run: runId, operation: 'cancel' }); }}>Cancel Assignment</LdButton>}
                {finance && <LdButton startIcon={<Payments />} component={Link} to={`${appRoutes.management.accountant.fuel}?view=new&vehicle=${run.vehicle_id}&driver=${run.driver_id}${run.status !== 'cancelled' ? `&run=${runId}` : ''}`}>Open Fuel &amp; Cheques</LdButton>}
            </Stack>
        </Stack></Paper>
        {driver && run.status === 'started' && <Alert severity={gps.active ? 'info' : 'warning'}>{gps.message} Buffered: {gps.pending}. Tracking can pause when this page is left, hidden or screen-locked. Reliable background tracking requires the Android app/tracker.</Alert>}
        <Grid container spacing={2}>{[
            ['Recorded GPS distance', `${run.distanceKm.toFixed(2)} km`], ['Odometer distance', run.odometerKm === null ? 'Not recorded' : `${run.odometerKm.toFixed(1)} km`],
            ['Collected / Total stops', `${run.stops.filter((stop) => stop.status === 'collected').length} / ${run.stops.length}`], ['GPS gaps (>2 minutes)', run.tracking_gaps],
            ['Fuel issued (net)', `${run.fuelLitres.toFixed(3)} L`], ['Issued fuel / 100 km', run.issuedLitresPer100Km === null ? 'Insufficient distance' : `${run.issuedLitresPer100Km.toFixed(2)} L`]
        ].map(([label, value]) => <Grid item xs={12} sm={6} md={4} key={label}><Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h4">{value}</Typography></Paper></Grid>)}</Grid>
        <Alert severity="info">GPS distance is an estimate; inaccurate points, implausible jumps and gaps are excluded. Fuel issued is not fuel consumed: tank balances, idling, traffic and receipts need review. Expected fuel for the {run.odometerKm === null ? 'recorded GPS' : 'odometer'} distance: {run.expectedLitres === null ? 'no vehicle baseline set' : `${run.expectedLitres.toFixed(2)} L`}. This is not a misuse/fraud verdict.</Alert>
        <FleetMap run={run} />
        <AppTable ariaLabel="Assigned customer stops" columns={columns} rows={run.stops} emptyTitle="No assigned stops" toolbar={<TableToolbar title="Customer Stops" count={run.stops.length} />} />
        {!driver && <AppTable ariaLabel="Route fuel and cheque register" rows={run.fuel} columns={[
            { id: 'id', label: 'Entry', render: (entry) => <TablePrimaryText primary={`FUEL-${entry.id} · ${entry.entry_type}`} secondary={entry.issued_by} /> },
            { id: 'litres_milli', label: 'Litres', render: (entry) => `${entry.entry_type === 'reversal' ? '−' : ''}${(Number(entry.litres_milli) / 1000).toFixed(3)}` },
            { id: 'amount_cents', label: 'Amount', render: (entry) => `${entry.entry_type === 'reversal' ? '−' : ''}${formatCurrency(Number(entry.amount_cents) / 100)}` },
            { id: 'reference', label: 'Method / Reference', render: (entry) => <TablePrimaryText primary={entry.method} secondary={entry.reference || 'Cash issue'} /> },
            { id: 'note', label: 'Reason / Status', render: (entry) => <TablePrimaryText primary={entry.note} secondary={entry.reversed ? 'Reversed' : entry.entry_type === 'issue' ? 'Recorded issue · clearance not confirmed' : `Reverses FUEL-${entry.reverses_id}`} /> },
            { id: 'actions', label: 'Actions', render: (entry) => finance && entry.entry_type === 'issue' && !entry.reversed ? <LdButton component={Link} to={`${appRoutes.management.accountant.fuel}?view=reverse&entry=${entry.id}`} variant="outlined" startIcon={<Undo />}>Reverse in Fuel Register</LdButton> : null }
        ]} emptyTitle="No fuel issues recorded" toolbar={<TableToolbar title="Fuel / Cheque Register" count={run.fuel.length} />} />}
        <MediumDialog open={photoOpen} onClose={() => { setPhotoOpen(false); setPhoto(null); }} title="Private Pickup Evidence">
            {photoLoading ? <Typography role="status">Loading evidence…</Typography> : photo ? <Box component="img" src={photo} alt="Driver-submitted pickup evidence" sx={{ display: 'block', maxWidth: '100%', maxHeight: '75vh', mx: 'auto', objectFit: 'contain' }} /> : <Alert severity="warning">Evidence could not be loaded.</Alert>}
        </MediumDialog>
    </Stack>;
}
RunDetail.propTypes = { runId: PropTypes.string.isRequired, onOpen: PropTypes.func.isRequired, readOnly: PropTypes.bool };
