import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Checkbox, FormControlLabel, Paper, Stack, Typography } from '@mui/material';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { appRoutes } from 'constants/appRoutes';
import { getSmsWorkspaceOptions, previewSmsCampaign, sendSmsCampaign } from 'services/api/smsService';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { AppTable, TableFilter, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { MediumDialog } from 'utils/dialogs';
import { LdButton } from 'utils/myButtons';

const checked = (response) => { if (response.code !== 1) throw new Error(response.message); return response.data; };
const apiError = (error) => error.response?.data?.message || error.message || 'Unable to process bulk SMS.';
const initialFilters = { status: 'all', zone: 'all', plan: 'all', category: 'all', search: '' };
export default function BulkSms() {
    const [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [filters, setFilters] = useState(initialFilters);
    const [preview, setPreview] = useState(null);
    const [selected, setSelected] = useState([]);
    const [previewing, setPreviewing] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);
    const busy = useRef(false);
    const { control, handleSubmit } = useForm({ defaultValues: { title: '', message: '' } });
    const [title, message] = useWatch({ control, name: ['title', 'message'] });
    useEffect(() => { setPreview(null); setSelected([]); setError(''); }, [title, message, filters]);
    const load = useCallback(async () => {
        setLoading(true); setLoadError('');
        try { setOptions(checked(await getSmsWorkspaceOptions())); }
        catch (err) { setLoadError(apiError(err)); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);
    const makePreview = async (values) => {
        if (busy.current) return;
        busy.current = true; setPreviewing(true); setError(''); setResult(null); setPreview(null); setSelected([]);
        try {
            const data = checked(await previewSmsCampaign({ ...values, filters }));
            setPreview(data); setSelected(data.recipients.map((row) => row.id));
        } catch (err) { setError(apiError(err)); }
        finally { busy.current = false; setPreviewing(false); }
    };
    const send = async () => {
        if (busy.current || !acknowledged || !selected.length || !preview) return;
        busy.current = true; setSending(true); setError('');
        try {
            const data = checked(await sendSmsCampaign(preview.id, { confirmed: true, recipientIds: selected }));
            setResult(data); setPreview(null); setSelected([]); setConfirmOpen(false);
        } catch (err) { setError(apiError(err)); }
        finally { busy.current = false; setSending(false); }
    };
    const pending = sending || previewing;
    const selectedRows = preview?.recipients.filter((row) => selected.includes(row.id)) || [];
    const units = selectedRows.reduce((total, row) => total + row.segments, 0);
    const filterControl = (key, label, values) => <TableFilter key={key} label={label} value={filters[key]} onChange={(value) => setFilters({ ...filters, [key]: value })} options={values} disabled={pending || loading} />;
    const columns = [
        { id: 'selected', label: 'Select', render: (row) => <Checkbox checked={selected.includes(row.id)} disabled={sending} inputProps={{ 'aria-label': `Include ${row.name}, customer ${row.customerId}` }} onChange={(_, include) => setSelected((previous) => include ? [...previous, row.id] : previous.filter((id) => id !== row.id))} /> },
        { id: 'name', label: 'Customer', render: (row) => <TablePrimaryText primary={row.name} secondary={`${row.customerId} · ${row.phone}`} /> },
        { id: 'zone', label: 'Category / Zone', render: (row) => <TablePrimaryText primary={row.category || 'Uncategorised'} secondary={row.zone || 'No zone'} /> },
        { id: 'message', label: 'Personalised Message', render: (row) => <Typography variant="body2" sx={{ maxWidth: 420, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{row.message}</Typography> },
        { id: 'segments', label: 'Estimated Units', render: (row) => <TablePrimaryText primary={String(row.segments)} secondary={row.encoding} /> }
    ];
    return <Stack spacing={2}>
        {loading && <Typography role="status">Loading SMS options…</Typography>}
        {loadError && <Alert severity="error" action={<LdButton variant="outlined" onClick={load} loading={loading}>Retry</LdButton>}>{loadError}</Alert>}
        {error && !confirmOpen && <Alert severity="error">{error}</Alert>}
        {result && <Alert severity="success" role="status">{result.count} messages {result.repeated ? 'were already queued; no duplicates created' : 'queued'}. They have not been confirmed delivered. <Link to={`${appRoutes.management.admin.sms}?tab=history`}>View notification history</Link>.</Alert>}
        {options && <>
            {!options.ready && <Alert severity="warning">Ask an administrator to configure SMS_API_KEY and SMS_SENDER_ID in server/.env and restart the server. You can prepare a preview, but cannot send yet.</Alert>}
            {options.transport === 'http' && <Alert severity="warning">The server uses unencrypted HTTP for the SMS provider.</Alert>}
            <Alert severity="info">Bulk sends are deliberate paid actions, independent of the automatic-notification switch. Each phone receives one message per campaign. Maximum 1,000 matching customers per preview.</Alert>
            <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
                <Stack component="form" spacing={2} onSubmit={handleSubmit(makePreview)} noValidate>
                    <Typography variant="h4" component="h2">Compose Bulk SMS</Typography>
                    <RHFTextField name="title" label="Campaign Title" control={control} required disabled={pending} inputProps={{ maxLength: 100 }} rules={{ required: 'Enter a campaign title', validate: (value) => Boolean(value.trim()) || 'Enter a campaign title', maxLength: { value: 100, message: 'Use at most 100 characters' } }} helperText="Internal title shown in notification history; not included in the SMS." />
                    <TableToolbar title="Recipient Filters" searchValue={filters.search} onSearchChange={pending ? undefined : (search) => setFilters({ ...filters, search })} searchLabel="Customer name, ID or phone" filters={<>
                        <TableFilter label="Customer Status" allLabel="All statuses" value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={[{ value: 'active', label: 'Active only' }, { value: 'inactive', label: 'Inactive only' }]} disabled={pending} />
                        {filterControl('zone', 'Zones', options.zones)}{filterControl('plan', 'Plans', options.plans)}{filterControl('category', 'Categories', options.categories)}
                    </>} actions={<LdButton variant="outlined" disabled={pending} onClick={() => setFilters(initialFilters)}>Reset Filters</LdButton>} />
                    <RHFTextField name="message" label="SMS Message" control={control} multiline minRows={4} required disabled={pending} inputProps={{ maxLength: 1000 }} rules={{ required: 'Enter a message', maxLength: { value: 1000, message: 'Use at most 1000 characters' }, validate: (value) => !value.trim() ? 'Enter a message' : /[{}]/.test(value.replace(/\{(name|customerId)\}/g, '')) ? 'Only {name} and {customerId} placeholders are supported' : true }} helperText={`${message?.length || 0}/1000 characters. Optional: {name}, {customerId}. Names are uppercase. Long/Unicode messages may cost multiple SMS units.`} />
                    <Box><LdButton type="submit" loading={previewing} disabled={sending}>Preview Recipients &amp; Message</LdButton></Box>
                </Stack>
            </Paper>
            {preview && <>
                <Alert severity="info">{preview.matched} customers matched; {preview.invalid} invalid phone numbers and {preview.duplicates} duplicate phone numbers skipped. Preview expires after {preview.expiresInMinutes} minutes. Deselect anyone you do not want to contact.</Alert>
                <AppTable ariaLabel="Bulk SMS recipient preview" columns={columns} rows={preview.recipients} emptyTitle="No eligible recipients" toolbar={<TableToolbar title="Recipient Preview" count={preview.recipients.length} actions={<>
                    <LdButton variant="outlined" disabled={sending} onClick={() => setSelected(preview.recipients.map((row) => row.id))}>Select All</LdButton>
                    <LdButton variant="outlined" disabled={sending} onClick={() => setSelected([])}>Clear Selection</LdButton>
                </>} />} />
                <Typography variant="body2">Selected: <strong>{selected.length}</strong> unique phones · Estimated SMS units: <strong>{units}</strong> · Sender: <strong>{options.sender || 'Not configured'}</strong></Typography>
                <Typography variant="caption" color="text.secondary">Units are estimates, not a price quote. Provider encoding and billing rules determine the actual charge.</Typography>
                <Box><LdButton disabled={!selected.length || !options.ready || pending} tooltip={!options.ready ? 'SMS credentials and sender ID must be configured first' : !selected.length ? 'Select at least one recipient' : ''} onClick={() => { setAcknowledged(false); setConfirmOpen(true); }}>Review &amp; Send Bulk SMS</LdButton></Box>
            </>}
        </>}
        <MediumDialog open={confirmOpen} onClose={() => { if (!busy.current) setConfirmOpen(false); }} title="Confirm Paid Bulk SMS">
            <Stack spacing={2} sx={{ p: 2 }}>
                {error && <Alert severity="error">{error}</Alert>}
                <Typography variant="body1">Queue “{preview?.title}” for {selected.length} unique phone numbers using sender {options?.sender}?</Typography>
                <Alert severity="warning">Estimated {units} SMS units. This can incur provider charges even when automatic notifications are disabled. Queued messages send while the server is online. Do not create a second campaign to retry a slow request.</Alert>
                <FormControlLabel label="I reviewed the recipients and messages and approve the SMS charges." control={<Checkbox checked={acknowledged} disabled={sending} onChange={(_, value) => setAcknowledged(value)} />} />
                <Stack direction="row" spacing={1}>
                    <LdButton variant="outlined" disabled={sending} onClick={() => setConfirmOpen(false)}>Cancel</LdButton>
                    <LdButton loading={sending} disabled={!acknowledged || !selected.length} onClick={send}>Confirm &amp; Queue {selected.length} SMS</LdButton>
                </Stack>
            </Stack>
        </MediumDialog>
    </Stack>;
}
