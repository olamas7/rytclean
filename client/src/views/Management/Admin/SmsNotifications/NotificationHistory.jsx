import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Paper, Stack, TablePagination, Typography } from '@mui/material';
import { getSmsHistory } from 'services/api/smsService';
import StatusBadge from 'ui-component/StatusBadge';
import { AppTable, TableFilter, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { LdButton } from 'utils/myButtons';

const events = { registration: 'Registration', payment: 'Payment received', bill: 'Bill issued', due: 'Payment due', overdue: 'Payment overdue', plan_change: 'Plan change', bulk: 'Bulk SMS', test: 'Test SMS' };
const statuses = { queued: 'Queued', sending: 'Sending', submitted_unverified: 'Submitted · unverified', failed: 'Failed', unknown: 'Unknown · check provider', cancelled: 'Cancelled' };
const dateLabel = (value) => value ? new Date(value).toLocaleString('en-GH', { timeZone: 'Africa/Accra' }) : 'Not attempted';
export default function NotificationHistory() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState({ search: '', status: 'all', event: 'all', page: 0, limit: 25 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const request = useRef(0);
    const load = useCallback(async () => {
        const sequence = ++request.current;
        setLoading(true); setError('');
        try {
            const response = await getSmsHistory(filters);
            if (response.code !== 1) throw new Error(response.message);
            if (sequence === request.current) { setRows(response.data.rows); setTotal(response.data.total); }
        } catch (err) { if (sequence === request.current) setError(err.response?.data?.message || err.message || 'Unable to load notification history.'); }
        finally { if (sequence === request.current) setLoading(false); }
    }, [filters]);
    useEffect(() => {
        const timer = setTimeout(load, 250);
        return () => { clearTimeout(timer); request.current += 1; };
    }, [load]);
    const change = (patch) => { setLoading(true); setFilters((previous) => ({ ...previous, page: 0, ...patch })); };
    const columns = [
        { id: 'customerName', label: 'Recipient', render: (row) => <TablePrimaryText primary={row.customerName || 'Test recipient'} secondary={`${row.customerId ? `${row.customerId} · ` : ''}${row.phone}`} /> },
        { id: 'event', label: 'Notification / Campaign', render: (row) => <TablePrimaryText primary={events[row.event] || row.event} secondary={row.campaignTitle} /> },
        { id: 'status', label: 'Status', render: (row) => <Stack spacing={0.5} alignItems="flex-start"><StatusBadge label={statuses[row.status] || row.status} /><Typography variant="caption" color="text.secondary" sx={{ maxWidth: 280 }}>{row.detail}</Typography></Stack> },
        { id: 'message', label: 'Message', render: (row) => <Typography variant="body2" sx={{ maxWidth: 420, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{row.message}</Typography> },
        { id: 'createdAt', label: 'Created / Attempted (Ghana)', render: (row) => <TablePrimaryText primary={dateLabel(row.createdAt)} secondary={dateLabel(row.attemptedAt)} /> }
    ];
    return <Stack spacing={2}>
        <Alert severity="info">Submitted is not confirmed delivered. Failed or uncertain sends are not automatically retried. History includes automatic notifications, bulk campaigns and connection tests; phone numbers and messages are restricted to managers and administrators.</Alert>
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <AppTable ariaLabel="SMS notification history" columns={columns} rows={rows} loading={loading} error={error} onRetry={load} pagination={false} emptyTitle="No matching notifications" emptyDescription="Queued messages and deliberate test sends appear here."
                toolbar={<TableToolbar title="Notification History" count={total} searchValue={filters.search} onSearchChange={(search) => change({ search })} searchLabel="Search customer, phone, message or campaign" filters={<>
                    <TableFilter label="Event" value={filters.event} onChange={(event) => change({ event })} options={Object.entries(events).map(([value, label]) => ({ value, label }))} />
                    <TableFilter label="Status" value={filters.status} onChange={(status) => change({ status })} options={Object.entries(statuses).map(([value, label]) => ({ value, label }))} />
                </>} actions={<>
                    <LdButton variant="outlined" onClick={() => change({ search: '', status: 'all', event: 'all' })} disabled={loading}>Reset Filters</LdButton>
                    <LdButton variant="outlined" onClick={load} loading={loading}>Refresh History</LdButton>
                </>} />} />
            <TablePagination component="div" count={total} page={filters.page} rowsPerPage={filters.limit} rowsPerPageOptions={[10, 25, 50, 100]} onPageChange={(_, page) => change({ page })} onRowsPerPageChange={(event) => change({ limit: Number(event.target.value) })} sx={{ '& .MuiTablePagination-toolbar': { flexWrap: 'wrap' } }} />
        </Paper>
    </Stack>;
}
