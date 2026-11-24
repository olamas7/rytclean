import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { Alert, Autocomplete, Box, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import imageCompression from 'browser-image-compression';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { FormActions } from 'ui-component/PageLayout';
import { LdButton } from 'utils/myButtons';
import { fleetGet, fleetRequestKey } from 'services/api/fleetService';
import { AppTable, TableActionButton } from 'utils/controls/Tables';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { appRoutes } from 'constants/appRoutes';

const today = () => new Date().toISOString().slice(0, 10);
const required = { required: 'This field is required' };
export default function FleetForm({ view, params, options, saving, onSave, onCancel, error }) {
    const request = useRef(fleetRequestKey());
    const [run, setRun] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [loading, setLoading] = useState(Boolean(params.get('run')));
    const [chosen, setChosen] = useState([]);
    const [acknowledged, setAcknowledged] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [preview, setPreview] = useState('');
    const [processing, setProcessing] = useState(false);
    const [gps, setGps] = useState(null);
    const [gpsPending, setGpsPending] = useState(false);
    const { control, handleSubmit, reset, watch } = useForm({ defaultValues: {
        routeId: params.get('route') || '', driverId: '', vehicleId: '', serviceDate: today(), corridor: 100,
        registration: '', description: '', status: view === 'confirm' ? 'collected' : 'available', expectedLitres: '',
        note: '', odometer: ''
    } });
    const runId = params.get('run'); const entryId = params.get('entry'); const operation = params.get('operation') || 'start';
    const routeId = watch('routeId');
    const route = options?.routes?.find((item) => String(item.id) === String(routeId));
    const stop = run?.stops.find((item) => String(item.id) === params.get('stop'));
    const vehicle = options?.vehicles?.find((item) => String(item.id) === params.get('vehicle'));
    useEffect(() => {
        let active = true;
        if (!runId) return undefined;
        fleetGet(`/runs/${runId}`).then((data) => { if (active) setRun(data); }).catch((err) => { if (active) setLoadError(err.response?.data?.message || err.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [runId]);
    useEffect(() => { if (vehicle) reset({ registration: vehicle.registration, description: vehicle.description, status: vehicle.status, expectedLitres: vehicle.expected_l_per_100km || '' }); }, [vehicle, reset]);
    useEffect(() => {
        if (view === 'stops' && route) setChosen((options.routeStops || []).filter((item) => String(item.route_id) === String(route.id)).map((item) => options.customers.find((customer) => customer.id === item.customer_id)).filter(Boolean));
    }, [view, route, options]);
    useEffect(() => { if (!photo) { setPreview(''); return undefined; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
    const [fieldError, setFieldError] = useState('');
    const captureGps = () => {
        if (!window.isSecureContext || !navigator.geolocation) { setFieldError('GPS needs HTTPS (or localhost) and location permission.'); return; }
        setGpsPending(true); setFieldError('');
        navigator.geolocation.getCurrentPosition((position) => {
            setGps({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() }); setGpsPending(false);
        }, () => { setFieldError('Unable to obtain GPS. Enable location and try outside with a clear sky.'); setGpsPending(false); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    };
    const selectPhoto = async (event) => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { setFieldError('Choose JPG/PNG/WebP up to 15 MB before compression.'); return; }
        setProcessing(true); setFieldError('');
        try {
            const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1800, useWebWorker: true, fileType: 'image/jpeg', preserveExif: false });
            if (compressed.size > 5 * 1024 * 1024) throw new Error('Compressed photo is too large.');
            setPhoto(new File([compressed], 'pickup-evidence.jpg', { type: 'image/jpeg' }));
        } catch (err) { setFieldError(err.message || 'Unable to prepare photo.'); }
        finally { setProcessing(false); }
    };
    const submit = (values) => {
        setFieldError('');
        if (processing || gpsPending) return;
        if (view === 'stops' && !chosen.length) { setFieldError('Choose customer stops.'); return; }
        if (view === 'confirm' && (!stop || !gps || gps.accuracy > 50 || Date.now() - Date.parse(gps.capturedAt) > 120000)) { setFieldError('Capture fresh GPS with accuracy within 50 m first.'); return; }
        if (view === 'confirm' && (stop?.photo_required || stop?.complaint) && !photo) { setFieldError('Photo evidence is required for this customer.'); return; }
        if (view === 'state' && operation !== 'start' && !acknowledged) { setFieldError('Acknowledge outstanding stops and closing this assignment.'); return; }
        const payload = { ...values, requestKey: request.current };
        if (view === 'confirm') {
            const form = new FormData();
            Object.entries({ ...payload, ...gps }).forEach(([name, value]) => form.append(name, String(value)));
            if (photo) form.append('photo', photo);
            onSave(`/runs/${runId}/stops/${stop.id}/confirm`, form);
        } else if (view === 'assignment') onSave('/runs', payload);
        else if (view === 'vehicle') onSave(`/vehicles${vehicle ? `/${vehicle.id}` : ''}`, payload, vehicle ? 'patch' : 'post');
        else if (view === 'stops') onSave(`/routes/${routeId}/stops`, { customerIds: chosen.map((customer) => customer.id) }, 'put');
        else if (view === 'state') onSave(`/runs/${runId}/state`, { ...payload, action: operation, acknowledgeOutstanding: acknowledged });
    };
    if (loading) return <Typography role="status">Loading route assignment…</Typography>;
    if (loadError) return <Alert severity="error">{loadError}</Alert>;
    if (view === 'fuel') return <Stack spacing={2}><Alert severity="info">Fuel is now recorded in the vehicle/driver fuel register with issue date, litres, unit price and cheque number.</Alert><LdButton component={Link} to={`${appRoutes.management.accountant.fuel}${entryId ? `?view=reverse&entry=${entryId}` : ''}`}>Open Fuel &amp; Cheques</LdButton></Stack>;
    if (view === 'vehicle' && params.get('vehicle') && !vehicle) return <Alert severity="warning">Vehicle not found. Return to the fleet list and choose a valid vehicle.</Alert>;
    const busy = saving || processing || gpsPending;
    const customerOptions = (options?.customers || []).filter((customer) => customer.zone_code === route?.zone_code && customer.latitude !== null && customer.longitude !== null);
    return <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit(submit)}>
        {(error || fieldError) && <Alert severity="error">{error || fieldError}</Alert>}
        {run && <Typography>{run.route_name} · {run.driver_name} · {run.registration} · Assignment #{run.id}</Typography>}
        {view === 'assignment' && <>
            <Alert severity="info">A driver/vehicle can have only one open assignment. Stop lists and route/fuel baselines are frozen at assignment time. Configure route stops first.</Alert>
            <RHFTextField name="routeId" label="Route" control={control} select required rules={required} disabled={busy}>{options?.routes.filter((item) => item.status === 'active').map((item) => <MenuItem key={item.id} value={item.id}>{item.route_name} · {item.zone_name} · {options.routeStops.filter((stop) => stop.route_id === item.id).length} stops</MenuItem>)}</RHFTextField>
            <RHFTextField name="driverId" label="Available Driver" control={control} select required rules={required} disabled={busy}>{options?.drivers.filter((item) => !item.open_run_id && item.status === 'available').map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</RHFTextField>
            <RHFTextField name="vehicleId" label="Available Vehicle" control={control} select required rules={required} disabled={busy}>{options?.vehicles.filter((item) => !item.open_run_id && item.status === 'available').map((item) => <MenuItem key={item.id} value={item.id}>{item.registration} · {item.description}</MenuItem>)}</RHFTextField>
            <RHFTextField name="serviceDate" label="Service Date" type="date" control={control} InputLabelProps={{ shrink: true }} inputProps={{ min: today() }} required rules={required} disabled={busy} />
            <RHFTextField name="corridor" label="Off-route Corridor (metres)" type="number" control={control} required rules={required} inputProps={{ min: 30, max: 1000, step: 1 }} helperText="Deviation is confirmed after three accepted points outside this corridor plus GPS accuracy." disabled={busy} />
        </>}
        {view === 'vehicle' && <>
            <RHFTextField name="registration" label="Registration Number" control={control} required rules={required} inputProps={{ maxLength: 30 }} disabled={busy} />
            <RHFTextField name="description" label="Vehicle Description / Model" control={control} required rules={required} inputProps={{ maxLength: 150 }} disabled={busy} />
            <RHFTextField name="status" label="Availability" control={control} select disabled={busy}>{['available', 'maintenance', 'inactive'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</RHFTextField>
            <RHFTextField name="expectedLitres" label="Expected Litres per 100 km (optional)" control={control} type="number" inputProps={{ min: 0.01, max: 200, step: 0.01 }} helperText="Comparison baseline only; not a claim of actual consumption." disabled={busy} />
        </>}
        {view === 'stops' && <>
            <RHFTextField name="routeId" label="Route" control={control} select required rules={required} disabled={busy || Boolean(params.get('route'))}>{options?.routes.map((item) => <MenuItem key={item.id} value={item.id}>{item.route_name} · {item.zone_name}</MenuItem>)}</RHFTextField>
            {options?.customerLimitReached && <Alert severity="warning">Only the first 5,000 customer options are loaded. Larger-area route planning needs server-side customer search before use.</Alert>}
            <Autocomplete multiple options={customerOptions} value={chosen} onChange={(_, values) => setChosen(values)} getOptionLabel={(customer) => `${customer.name} · ${customer.customer_code}${customer.complaint ? ' · COMPLAINT' : ''}`} isOptionEqualToValue={(a, b) => a.id === b.id} disabled={busy || !route} renderInput={(props) => <TextField {...props} label="Customer Stops (active customers in this zone with GPS)" />} />
            <AppTable ariaLabel="Ordered route stops" rows={chosen} columns={[
                { id: 'name', label: 'Customer', render: (customer) => `${chosen.indexOf(customer) + 1}. ${customer.name} · ${customer.customer_code}` },
                { id: 'actions', label: 'Order', render: (customer) => { const index = chosen.indexOf(customer); const move = (direction) => { const next = [...chosen]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; setChosen(next); }; return <Stack direction="row" spacing={1}><TableActionButton label={`Move ${customer.name} up`} icon={<ArrowUpward />} disabled={busy || index === 0} onClick={() => move(-1)} /><TableActionButton label={`Move ${customer.name} down`} icon={<ArrowDownward />} disabled={busy || index === chosen.length - 1} onClick={() => move(1)} /></Stack>; } }
            ]} emptyTitle="Choose customer stops" />
        </>}
        {view === 'state' && <>
            <Alert severity={operation === 'start' ? 'info' : 'warning'}>{operation === 'start' ? 'Start this work route. GPS capture requires a separate deliberate permission action afterward.' : 'Close this assignment and release its vehicle/driver. Unfinished stops are kept as unfinished, not marked collected.'}</Alert>
            <RHFTextField name="odometer" label={operation === 'start' ? 'Start Odometer (km, optional)' : 'End Odometer (km, optional)'} control={control} type="number" inputProps={{ min: 0, step: 0.1 }} disabled={busy} />
            {operation !== 'start' && <><RHFTextField name="note" label="Closing / Cancellation Reason" control={control} required rules={required} inputProps={{ maxLength: 500 }} disabled={busy} /><FormControlLabel label="I acknowledge any unfinished stops and confirm closing this assignment." control={<Checkbox checked={acknowledged} onChange={(_, value) => setAcknowledged(value)} disabled={busy} />} /></>}
        </>}
        {view === 'confirm' && <>
            {!stop ? <Alert severity="error">Customer stop not found.</Alert> : <>
                <Typography variant="h3">{stop.customer_name} · {stop.customer_code}</Typography><Typography>{stop.address}</Typography>
                {(stop.photo_required || stop.complaint) && <Alert severity="warning">Photo evidence is required. {stop.complaint_note || 'This stop was flagged when assigned.'} Photograph the empty bin or site condition, avoiding faces/private interiors.</Alert>}
                <RHFTextField name="status" label="Visit Outcome" control={control} select disabled={busy}><MenuItem value="collected">Collected</MenuItem><MenuItem value="not_collected">Not collected / access problem</MenuItem></RHFTextField>
                <RHFTextField name="note" label="Collection / Site Condition Note" control={control} required rules={required} multiline minRows={2} inputProps={{ maxLength: 1000 }} disabled={busy} />
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><LdButton onClick={captureGps} loading={gpsPending} disabled={saving || processing}>Capture Current GPS</LdButton><LdButton component="label" variant="outlined" loading={processing} disabled={saving || gpsPending}>Take / Choose Evidence Photo<input type="file" hidden accept="image/jpeg,image/png,image/webp" capture="environment" onChange={selectPhoto} /></LdButton></Stack>
                <Typography variant="body2">GPS: {gps ? `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)} · accuracy ${Math.round(gps.accuracy)} m` : 'Not captured'}. Confirmation needs a fresh position within 150 m of the customer.</Typography>
                {preview && <Box component="img" src={preview} alt="Prepared pickup evidence preview" sx={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }} />}
            </>}
        </>}
        <FormActions onCancel={onCancel} loading={saving} disabled={processing || gpsPending || (view === 'confirm' && !stop)} submitLabel={view === 'assignment' ? 'Assign Route' : view === 'confirm' ? 'Save Pickup Evidence' : view === 'state' ? `${operation[0].toUpperCase()}${operation.slice(1)} Route` : view === 'fuel' ? entryId ? 'Reverse Fuel Issue' : 'Record Fuel Issue' : 'Save'} />
    </Stack>;
}
FleetForm.propTypes = { view: PropTypes.string.isRequired, params: PropTypes.object.isRequired, options: PropTypes.object, saving: PropTypes.bool, onSave: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired, error: PropTypes.string };
