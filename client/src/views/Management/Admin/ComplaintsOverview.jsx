import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Paper, Stack, TextField } from '@mui/material';
import { fleetGet, fleetPost } from 'services/api/fleetService';
import { PageHeader, FormActions } from 'ui-component/PageLayout';
import { AppTable, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { LdButton } from 'utils/myButtons';
import useInlineNavigation from 'utils/useInlineNavigation';
import StatusBadge from 'ui-component/StatusBadge';

const sections = { new: { label: 'Record Collection Complaint' } };
export default function ComplaintsOverview() {
    const [rows, setRows] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [customer, setCustomer] = useState(null);
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [search, setSearch] = useState('');
    const lock = useRef(false);
    const inline = useInlineNavigation({ sections, rootLabel: 'Complaints Overview', blocked: saving });
    const canWrite = ['Admin', 'Super Admin', 'Manager', 'Support'].includes(localStorage.getItem('admin_role'));
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try { const [complaints, options] = await Promise.all([fleetGet('/complaints'), canWrite ? fleetGet('/complaint-customers') : Promise.resolve([])]); setRows(complaints); setCustomers(options); }
        catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setLoading(false); }
    }, [canWrite]);
    useEffect(() => { load(); }, [load]);
    const save = async (event, complaintId) => {
        event?.preventDefault();
        if (lock.current) return;
        if (!complaintId && (!customer || !description.trim())) { setError('Select a customer and enter the complaint.'); return; }
        lock.current = true; setSaving(true); setError('');
        try {
            await fleetPost(complaintId ? `/complaints/${complaintId}/resolve` : '/complaints', complaintId ? {} : { customerId: customer.id, description });
            if (!complaintId) inline.close();
            setFeedback(complaintId ? 'Complaint resolved. Stored pickup evidence is retained.' : 'Complaint recorded. Customer markers will be flagged and photo evidence required.');
            setDescription(''); setCustomer(null); await load();
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { lock.current = false; setSaving(false); }
    };
    return <Box sx={{ p: { xs: 1, md: 2 } }}><Stack spacing={2}>
        <PageHeader title={inline.view ? 'Record Collection Complaint' : 'Complaints Overview'} inlineNavigation={inline.navigation} actions={!inline.view && canWrite && <LdButton onClick={() => { setError(''); inline.open('new'); }}>Record Complaint</LdButton>} />
        {error && <Alert severity="error">{error}</Alert>}{feedback && <Alert severity="success">{feedback}</Alert>}
        {inline.view ? !canWrite ? <Alert severity="info">Manager or support access is required.</Alert> : <Paper component="form" onSubmit={save} variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack spacing={2}>
            <Autocomplete options={customers} value={customer} onChange={(_, value) => setCustomer(value)} getOptionLabel={(value) => `${value.name} · ${value.customer_code}`} isOptionEqualToValue={(a, b) => a.id === b.id} loading={loading} disabled={saving} renderInput={(props) => <TextField {...props} label="Customer" required />} />
            <TextField label="Complaint / Site Condition" required multiline minRows={3} value={description} onChange={(event) => setDescription(event.target.value)} inputProps={{ maxLength: 1000 }} disabled={saving} />
            <Alert severity="info">Open complaints appear red on assigned route maps. Drivers must attach evidence when confirming a flagged visit. This does not automatically resolve the complaint.</Alert>
            <FormActions onCancel={inline.back} loading={saving} submitLabel="Record Complaint" />
        </Stack></Paper> : <AppTable ariaLabel="Customer collection complaints" rows={rows.filter((row) => `${row.customer_name} ${row.customer_code} ${row.description}`.toLowerCase().includes(search.toLowerCase()))} loading={loading} error={error} onRetry={load} columns={[
            { id: 'customer_name', label: 'Customer', render: (row) => <TablePrimaryText primary={row.customer_name} secondary={`${row.customer_code} · Complaint #${row.id}`} /> },
            { id: 'description', label: 'Complaint' }, { id: 'status', label: 'Status', render: (row) => <StatusBadge label={row.status} /> },
            { id: 'actions', label: 'Actions', render: (row) => row.status === 'open' && canWrite ? <LdButton variant="outlined" loading={saving} onClick={() => { if (window.confirm('Resolve this complaint? Existing pickup evidence and history will remain.')) save(null, row.id); }}>Resolve</LdButton> : null }
        ]} emptyTitle="No collection complaints recorded" toolbar={<TableToolbar title="Latest 500 Complaints" count={rows.length} searchValue={search} onSearchChange={setSearch} searchLabel="Search customer or complaint" actions={<LdButton onClick={load} loading={loading}>Refresh</LdButton>} />} />}
    </Stack></Box>;
}
