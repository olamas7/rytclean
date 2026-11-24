import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Grid, Paper, Stack, Tab, TablePagination, Tabs, TextField, Typography } from '@mui/material';
import { Undo, Visibility } from '@mui/icons-material';
import { fleetGet, fleetPost } from 'services/api/fleetService';
import { PageHeader } from 'ui-component/PageLayout';
import StatusBadge from 'ui-component/StatusBadge';
import { AppTable, TableActionButton, TableFilter, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { LdButton } from 'utils/myButtons';
import useInlineNavigation from 'utils/useInlineNavigation';
import { formatCurrency, formatDate } from 'utils/formatters';
import FuelIssueForm from './FuelIssueForm';
import RunDetail from 'views/Management/Fleet/RunDetail';

const sections = { new: { label: 'Record Fuel & Cheque' }, reverse: { label: 'Reverse Fuel Issue' }, run: { label: 'Route Taken / Distance' } };
const money = (cents) => formatCurrency(Number(cents) / 100);
const litres = (milli) => (Number(milli) / 1000).toFixed(3);
const today = () => new Date().toISOString().slice(0, 10);
export default function RouteFuel() {
    const role = localStorage.getItem('admin_role');
    const canWrite = ['Admin', 'Super Admin', 'Accountant'].includes(role);
    const canRead = canWrite || role === 'Manager';
    const [saving, setSaving] = useState(false);
    const [options, setOptions] = useState(null);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [optionsError, setOptionsError] = useState('');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [tab, setTab] = useState('register');
    const [filters, setFilters] = useState({ from: `${today().slice(0, 7)}-01`, to: today(), vehicleId: 'all', driverId: 'all', page: 0, runPage: 0, limit: 25 });
    const lock = useRef(false); const request = useRef(0);
    const inline = useInlineNavigation({ sections, rootLabel: 'Fuel & Cheques', contextKeys: ['vehicle', 'driver', 'run', 'entry'], blocked: saving });
    const requestedRun = inline.params.get('run');
    const loadOptions = useCallback(async () => {
        setOptionsLoading(true); setOptionsError('');
        try { setOptions(await fleetGet(`/fuel/options${requestedRun ? `?runId=${encodeURIComponent(requestedRun)}` : ''}`)); }
        catch (err) { setOptionsError(err.response?.data?.message || err.message); }
        finally { setOptionsLoading(false); }
    }, [requestedRun]);
    const load = useCallback(async () => {
        const sequence = ++request.current; setLoading(true); setError('');
        try { const data = await fleetGet(`/fuel?${new URLSearchParams(filters)}`); if (sequence === request.current) setReport(data); }
        catch (err) { if (sequence === request.current) setError(err.response?.data?.message || err.message); }
        finally { if (sequence === request.current) setLoading(false); }
    }, [filters]);
    useEffect(() => { if (canRead) loadOptions(); }, [canRead, loadOptions]);
    useEffect(() => {
        if (!canRead || inline.view) return undefined;
        const timer = setTimeout(load, 200);
        return () => { clearTimeout(timer); request.current += 1; };
    }, [canRead, inline.view, load]);
    const change = (patch) => { setLoading(true); setFilters((previous) => ({ ...previous, page: 0, runPage: 0, ...patch })); };
    const open = (view, values) => { setSaveError(''); setFeedback(''); inline.open(view, values); };
    const save = async (path, payload, original) => {
        if (lock.current) return;
        lock.current = true; setSaving(true); setSaveError('');
        try {
            const result = await fleetPost(path, payload);
            const issueDate = String(result.issueDate || (original ? original.issueDate : payload.issueDate)).slice(0, 10);
            change({ from: issueDate, to: issueDate, vehicleId: String(result.vehicleId || original?.vehicleId || payload.vehicleId), driverId: String(result.driverId || original?.driverId || payload.driverId) });
            inline.close(); setTab('register'); setFeedback(result.repeated ? 'This fuel request was already recorded. No duplicate was created.' : original ? 'Fuel issue reversed. Original and cheque reference retained.' : 'Fuel issue saved with its calculated total and cheque number.');
        } catch (err) { setSaveError(err.response?.data?.message || err.message); }
        finally { lock.current = false; setSaving(false); }
    };
    const exportSummary = () => {
        if (!report) return;
        const csvCell = (value) => { const content = String(value ?? ''); return `"${(/^[=+@-]/.test(content) && !/^-?\d+(\.\d+)?$/.test(content) ? `'${content}` : content).replaceAll('"', '""')}"`; };
        const lines = [
            ['Fuel issue / route-distance summary', report.from, report.to],
            ['Period comparison only: fuel issued is not fuel consumed. Route dates and fuel issue dates may differ.'],
            ['Vehicle', 'Driver', 'Net litres issued', 'Net amount GHS', 'Unlinked litres', 'Assignments', 'Recorded GPS km', 'Comparison km (odometer where recorded)', 'Issued L / 100 km'],
            ...report.groups.map((group) => [group.vehicleRegistration, group.driverName, litres(group.litresMilli), (Number(group.amountCents) / 100).toFixed(2), litres(group.unlinkedLitresMilli), group.runCount, Number(group.gpsKm).toFixed(2), Number(group.comparisonKm).toFixed(2), group.issuedLitresPer100Km?.toFixed(2) ?? 'Insufficient distance'])
        ];
        const blob = new Blob(['\uFEFF', lines.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `fuel-summary-${report.from}-${report.to}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    if (!canRead) return <Alert severity="info">Accountant or manager access is required for the fuel register.</Alert>;
    if (inline.view) return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title={sections[inline.view].label} inlineNavigation={inline.navigation} />
        {inline.view === 'run' ? inline.params.get('run') ? <RunDetail runId={inline.params.get('run')} readOnly onOpen={() => {}} /> : <Alert severity="warning">Choose a valid route assignment.</Alert> : !canWrite ? <Alert severity="info">Accountant or administrator access is required to record/reverse fuel.</Alert> : optionsLoading ? <Typography role="status">Loading vehicle and driver options…</Typography> : optionsError || !options ? <Alert severity="error" action={<LdButton onClick={loadOptions} loading={optionsLoading}>Retry</LdButton>}>{optionsError || 'Fuel options unavailable.'}</Alert> : <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, maxWidth: 1000, mx: 'auto' }}>
            <FuelIssueForm key={`${inline.view}:${inline.params.get('entry')}`} options={options} params={inline.params} reversal={inline.view === 'reverse'} saving={saving} error={saveError} onSave={save} onCancel={inline.back} />
        </Paper>}
    </Box>;
    const entryColumns = [
        { id: 'issueDate', label: 'Fuel Issue Date', render: (entry) => <TablePrimaryText primary={formatDate(entry.issueDate)} secondary={entry.legacyDate ? 'Legacy: recorded date' : `FUEL-${entry.id}`} /> },
        { id: 'vehicleRegistration', label: 'Vehicle / Driver', render: (entry) => <TablePrimaryText primary={entry.vehicleRegistration} secondary={entry.driverName} /> },
        { id: 'litres_milli', label: 'Litres', render: (entry) => `${entry.entry_type === 'reversal' ? '−' : ''}${litres(entry.litres_milli)}` },
        { id: 'unit_price_units', label: 'Price / Litre (GHS)', render: (entry) => entry.unit_price_units === null ? 'Not recorded (legacy)' : (Number(entry.unit_price_units) / 10000).toFixed(4) },
        { id: 'amount_cents', label: 'Total', render: (entry) => `${entry.entry_type === 'reversal' ? '−' : ''}${money(entry.amount_cents)}` },
        { id: 'reference', label: 'Cheque / Reference', render: (entry) => <TablePrimaryText primary={entry.reference || 'Not recorded'} secondary={entry.method} /> },
        { id: 'routeName', label: 'Route Link', render: (entry) => <TablePrimaryText primary={entry.routeName || 'Not linked'} secondary={entry.routeDate ? formatDate(entry.routeDate) : 'Included in vehicle/driver period report'} /> },
        { id: 'status', label: 'Status', render: (entry) => <StatusBadge label={entry.reversed ? 'reversed' : entry.entry_type === 'reversal' ? 'reversal' : 'issued'} /> },
        { id: 'actions', label: 'Actions', render: (entry) => <Stack direction="row" spacing={1}>{entry.run_id && <TableActionButton label={`View route for fuel ${entry.id}`} icon={<Visibility />} onClick={() => open('run', { run: entry.run_id })} />}{canWrite && entry.entry_type === 'issue' && !entry.reversed && <TableActionButton label={`Reverse FUEL-${entry.id}`} icon={<Undo />} onClick={() => open('reverse', { entry: entry.id })} />}</Stack> }
    ];
    const pagination = (isRun = false) => <TablePagination component="div" count={isRun ? report?.runTotal || 0 : report?.total || 0} page={isRun ? filters.runPage : filters.page} rowsPerPage={filters.limit} rowsPerPageOptions={[10, 25, 50, 100]} onPageChange={(_, page) => change(isRun ? { runPage: page, page: filters.page } : { page, runPage: filters.runPage })} onRowsPerPageChange={(event) => change({ limit: Number(event.target.value) })} sx={{ '& .MuiTablePagination-toolbar': { flexWrap: 'wrap' } }} />;
    return <Box sx={{ p: { xs: 1, md: 2 } }}><Stack spacing={2}>
        <PageHeader title="Fuel & Cheques" description="Record fuel by vehicle, driver, litres, unit price, cheque and date. Review route-distance reports separately." actions={<><LdButton variant="outlined" onClick={load} loading={loading}>Refresh</LdButton>{canWrite && <LdButton onClick={() => open('new')} disabled={optionsLoading || Boolean(optionsError)}>Record Fuel &amp; Cheque</LdButton>}</>} />
        {feedback && <Alert severity="success">{feedback}</Alert>}{optionsError && <Alert severity="error" action={<LdButton onClick={loadOptions} loading={optionsLoading}>Retry Options</LdButton>}>{optionsError}</Alert>}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            <TextField label="From Date" type="date" value={filters.from} onChange={(event) => change({ from: event.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="To Date" type="date" value={filters.to} onChange={(event) => change({ to: event.target.value })} InputLabelProps={{ shrink: true }} />
            <TableFilter label="Vehicles" value={filters.vehicleId} onChange={(vehicleId) => change({ vehicleId })} options={(options?.vehicles || []).map((vehicle) => ({ value: String(vehicle.id), label: vehicle.registration }))} />
            <TableFilter label="Drivers" value={filters.driverId} onChange={(driverId) => change({ driverId })} options={(options?.drivers || []).map((driver) => ({ value: String(driver.id), label: driver.name }))} />
        </Stack></Paper>
        {error && <Alert severity="error">{error}</Alert>}
        {report && <Grid container spacing={2}>{[['Net fuel issued', `${litres(report.summary.litresMilli)} L`], ['Net issue value', money(report.summary.amountCents)], ['Fuel without route link', `${litres(report.summary.unlinkedLitresMilli)} L`]].map(([label, value]) => <Grid item xs={12} md={4} key={label}><Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography variant="body2">{label}</Typography><Typography variant="h3">{value}</Typography></Paper></Grid>)}</Grid>}
        <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Fuel register sections"><Tab value="register" label="Fuel & Cheque Register" /><Tab value="reports" label="Fuel / Route Analysis" /></Tabs>
        {tab === 'register' ? <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}><AppTable ariaLabel="Vehicle driver fuel and cheque register" rows={report?.entries || []} columns={entryColumns} loading={loading} error={error} onRetry={load} pagination={false} emptyTitle="No fuel issues in this period" emptyDescription="Record a vehicle/driver fuel issue or adjust the date filters." toolbar={<TableToolbar title="Fuel Issues & Reversals" count={report?.total} />} />{pagination()}</Paper> : <>
            <Alert severity="info">Compare fuel issue dates with route service dates for the selected driver/vehicle and period. Unlinked fuel is included in period totals, not assigned to a particular trip. Distance uses odometer readings where available, otherwise GPS; gaps, partial routes, tank stock and idling affect interpretation. Fuel issued is not fuel consumed or proof of misuse.</Alert>
            <AppTable ariaLabel="Fuel and route period analysis" rows={report?.groups || []} loading={loading} error={error} onRetry={load} emptyTitle="No fuel or routes in this period" columns={[
                { id: 'vehicleRegistration', label: 'Vehicle / Driver', render: (group) => <TablePrimaryText primary={group.vehicleRegistration} secondary={group.driverName} /> },
                { id: 'litresMilli', label: 'Issued Litres', render: (group) => litres(group.litresMilli) }, { id: 'amountCents', label: 'Value', render: (group) => money(group.amountCents) },
                { id: 'unlinkedLitresMilli', label: 'Unlinked Litres', render: (group) => litres(group.unlinkedLitresMilli) },
                { id: 'runCount', label: 'Assignments' }, { id: 'gpsKm', label: 'GPS km', render: (group) => Number(group.gpsKm).toFixed(2) },
                { id: 'comparisonKm', label: 'Comparison km', render: (group) => <TablePrimaryText primary={Number(group.comparisonKm).toFixed(2)} secondary={`${group.odometerRuns} odometer-based assignments · ${group.trackingGaps} GPS gaps`} /> },
                { id: 'issuedLitresPer100Km', label: 'Issued L / 100 km', render: (group) => group.issuedLitresPer100Km === null ? 'Insufficient distance' : group.issuedLitresPer100Km.toFixed(2) }
            ]} toolbar={<TableToolbar title="Vehicle / Driver Summary" count={report?.groups.length} actions={<LdButton variant="outlined" onClick={exportSummary} disabled={loading || Boolean(error) || !report?.groups.length}>Export Summary CSV</LdButton>} />} />
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}><AppTable ariaLabel="Routes taken by vehicle and driver" rows={report?.runs || []} loading={loading} error={error} onRetry={load} pagination={false} emptyTitle="No route assignments in this period" columns={[
                { id: 'service_date', label: 'Service Date', render: (run) => formatDate(run.service_date) },
                { id: 'route_name', label: 'Assigned Route', render: (run) => <TablePrimaryText primary={run.route_name} secondary={`#${run.id} · ${run.status}`} /> },
                { id: 'vehicleRegistration', label: 'Vehicle / Driver', render: (run) => <TablePrimaryText primary={run.vehicleRegistration} secondary={run.driverName} /> },
                { id: 'gpsKm', label: 'Recorded GPS km', render: (run) => Number(run.gpsKm).toFixed(2) },
                { id: 'odometerKm', label: 'Odometer km', render: (run) => run.odometerKm === null ? 'Not recorded' : Number(run.odometerKm).toFixed(1) },
                { id: 'actions', label: 'Actions', render: (run) => <TableActionButton label={`View route ${run.route_name}`} icon={<Visibility />} onClick={() => open('run', { run: run.id })} /> }
            ]} toolbar={<TableToolbar title="Route Assignments / Recorded Movement" count={report?.runTotal} />} />{pagination(true)}</Paper>
        </>}
        <Typography variant="caption" color="text.secondary">Entries are immutable; corrections use a reasoned reversal. Cheque numbers are retained and duplicate references are blocked. Recording an issue does not print, transfer or clear a cheque.</Typography>
    </Stack></Box>;
}
