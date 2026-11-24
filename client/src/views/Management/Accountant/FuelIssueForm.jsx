import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { Alert, Autocomplete, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Controller } from 'react-hook-form';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { FormActions } from 'ui-component/PageLayout';
import { fleetGet, fleetRequestKey } from 'services/api/fleetService';
import { formatCurrency, formatDate } from 'utils/formatters';
import { fuelTotalCents } from 'utils/fuelAmounts';

const required = { required: 'This field is required' };
export default function FuelIssueForm({ options, params, reversal, saving, error, onSave, onCancel }) {
    const requestKey = useRef(fleetRequestKey());
    const [original, setOriginal] = useState(null);
    const [loading, setLoading] = useState(reversal);
    const [loadError, setLoadError] = useState('');
    const { control, handleSubmit, watch, setValue } = useForm({ defaultValues: {
        vehicleId: params.get('vehicle') || '', driverId: params.get('driver') || '', runId: params.get('run') || '',
        issueDate: new Date().toISOString().slice(0, 10), litres: '', pricePerLitre: '', chequeNumber: '', note: ''
    } });
    const vehicleId = watch('vehicleId'); const driverId = watch('driverId');
    const litres = watch('litres'); const price = watch('pricePerLitre');
    const total = fuelTotalCents(litres, price);
    const previousPair = useRef(`${params.get('vehicle') || ''}:${params.get('driver') || ''}`);
    const entryId = params.get('entry');
    useEffect(() => {
        const pair = `${vehicleId}:${driverId}`;
        if (pair !== previousPair.current) { previousPair.current = pair; setValue('runId', ''); }
    }, [vehicleId, driverId, setValue]);
    useEffect(() => {
        let active = true;
        if (!reversal) return undefined;
        if (!entryId) { setLoadError('Choose a fuel issue to reverse.'); setLoading(false); return undefined; }
        fleetGet(`/fuel/${entryId}`).then((data) => { if (active) setOriginal(data); }).catch((err) => { if (active) setLoadError(err.response?.data?.message || err.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [entryId, reversal]);
    if (loading) return <Typography role="status">Loading fuel issue…</Typography>;
    if (loadError) return <Alert severity="error">{loadError}</Alert>;
    if (reversal && (!original || original.entry_type !== 'issue' || original.reversed)) return <Alert severity="warning">This entry cannot be reversed or is already reversed.</Alert>;
    const routeOptions = options.runs.filter((run) => String(run.vehicle_id) === String(vehicleId) && String(run.driver_id) === String(driverId));
    const submit = (values) => {
        if (!reversal && total === null) return;
        onSave(reversal ? `/fuel/${entryId}/reverse` : '/fuel', { ...values, requestKey: requestKey.current }, original);
    };
    const selectRecord = (name, label, records, getLabel) => <Controller name={name} control={control} rules={required} render={({ field, fieldState }) => <Autocomplete options={records} value={records.find((record) => String(record.id) === String(field.value)) || null} onChange={(_, value) => field.onChange(value ? String(value.id) : '')} onBlur={field.onBlur} getOptionLabel={getLabel} isOptionEqualToValue={(a, b) => a.id === b.id} disabled={saving} renderInput={(props) => <TextField {...props} inputRef={field.ref} label={label} required error={Boolean(fieldState.error)} helperText={fieldState.error?.message} />} />} />;
    return <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit(submit)}>
        {error && <Alert severity="error">{error}</Alert>}
        {reversal ? <>
            <Alert severity="warning">Reverse FUEL-{original.id}? The original record and cheque number stay in history. This does not cancel a cheque at the bank.</Alert>
            <Typography>{original.vehicleRegistration} · {original.driverName} · {formatDate(original.issueDate)}</Typography>
            <Typography>{(Number(original.litres_milli) / 1000).toFixed(3)} L · {formatCurrency(Number(original.amount_cents) / 100)} · Cheque/reference {original.reference || 'Not recorded'}</Typography>
            <RHFTextField name="note" label="Reversal Reason" control={control} required rules={{ ...required, validate: (value) => Boolean(value.trim()) || 'Enter a reason' }} multiline minRows={2} inputProps={{ maxLength: 500 }} disabled={saving} />
        </> : <>
            <Grid container spacing={2}>
                <Grid item xs={12} md={6}>{selectRecord('vehicleId', 'Vehicle', options.vehicles, (vehicle) => `${vehicle.registration} · ${vehicle.description}${vehicle.status !== 'available' ? ` (${vehicle.status})` : ''}`)}</Grid>
                <Grid item xs={12} md={6}>{selectRecord('driverId', 'Driver', options.drivers, (driver) => `${driver.name}${driver.status !== 'available' ? ` (${driver.status})` : ''}`)}</Grid>
                <Grid item xs={12} sm={6}><RHFTextField name="issueDate" label="Fuel Issue Date" type="date" control={control} required rules={required} InputLabelProps={{ shrink: true }} inputProps={{ max: new Date().toISOString().slice(0, 10) }} disabled={saving} /></Grid>
                <Grid item xs={12} sm={6}><RHFTextField name="chequeNumber" label="Cheque Number" control={control} required rules={{ ...required, validate: (value) => Boolean(value.trim()) || 'Enter the cheque number' }} inputProps={{ maxLength: 120 }} disabled={saving} /></Grid>
                <Grid item xs={12} sm={6}><RHFTextField name="litres" label="Fuel Given (Litres)" type="number" control={control} required rules={{ ...required, validate: (value) => /^\d+(\.\d{1,3})?$/.test(String(value)) && Number(value) > 0 || 'Enter positive litres with up to 3 decimals' }} inputProps={{ min: 0.001, step: 0.001 }} disabled={saving} /></Grid>
                <Grid item xs={12} sm={6}><RHFTextField name="pricePerLitre" label="Price per Litre (GHS)" type="number" control={control} required rules={{ ...required, validate: (value) => /^\d+(\.\d{1,4})?$/.test(String(value)) && Number(value) > 0 || 'Enter a positive price with up to 4 decimals' }} inputProps={{ min: 0.0001, step: 0.0001 }} disabled={saving} /></Grid>
            </Grid>
            <TextField label="Calculated Total (GHS)" value={total === null ? '' : (total / 100).toFixed(2)} InputProps={{ readOnly: true }} helperText="Litres × price per litre, rounded to the nearest pesewa. Recalculated and validated by the server." />
            <RHFTextField name="runId" label="Route Assignment (Optional)" control={control} select disabled={saving || !vehicleId || !driverId} helperText="No route is required. Link only the matching assignment if this fuel was specifically issued for it.">
                <MenuItem value="">Not linked to a route</MenuItem>
                {routeOptions.map((run) => <MenuItem key={run.id} value={String(run.id)}>{run.route_name} · {formatDate(run.service_date)} · #{run.id}</MenuItem>)}
            </RHFTextField>
            <RHFTextField name="note" label="Supplier / Notes (Optional)" control={control} multiline minRows={2} inputProps={{ maxLength: 500 }} disabled={saving} />
        </>}
        <FormActions onCancel={onCancel} loading={saving} disabled={!reversal && total === null} submitLabel={reversal ? 'Reverse Fuel Issue' : 'Record Fuel & Cheque'} />
    </Stack>;
}
FuelIssueForm.propTypes = { options: PropTypes.object.isRequired, params: PropTypes.object.isRequired, reversal: PropTypes.bool, saving: PropTypes.bool, error: PropTypes.string, onSave: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired };
