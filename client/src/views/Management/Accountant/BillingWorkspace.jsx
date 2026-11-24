import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AccountBalanceWallet, Print, ReceiptLong, Refresh } from '@mui/icons-material';
import { Alert, Box, Grid, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { generateDueBills, getBillingAccounts, getBillingInvoices, getBillingPayments, getGatewayPayments, verifyGatewayPayment } from 'services/api/billingService';
import { PageHeader } from 'ui-component/PageLayout';
import StatusBadge from 'ui-component/StatusBadge';
import { AppTable, TableActionButton, TableFilter, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { MediumDialog } from 'utils/dialogs';
import { formatCurrency, formatDate } from 'utils/formatters';
import { LdButton } from 'utils/myButtons';
import useInlineNavigation from 'utils/useInlineNavigation';
import CustomerAccount from './CustomerAccount';
import { paymentMethods, paymentMethodLabel, paymentSourceLabel } from 'utils/paymentMethods';
import { printPaymentReceipt, printSubscriptionBill } from 'utils/accountPrinting';

const money = (cents) => formatCurrency(Number(cents) / 100);
const sections = { account: { label: 'Customer Account' } };
const BillingWorkspace = ({ initialTab = 'accounts' }) => {
    const [tab, setTab] = useState(initialTab);
    const [accounts, setAccounts] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [payments, setPayments] = useState([]);
    const [gateway, setGateway] = useState([]);
    const [paymentSource, setPaymentSource] = useState('all');
    const [paymentMethod, setPaymentMethod] = useState('all');
    const [verifying, setVerifying] = useState(null);
    const verifyLock = useRef(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const inline = useInlineNavigation({ sections, rootLabel: 'Client Billing', contextKeys: ['customer'] });
    const selected = inline.view === 'account' ? inline.params.get('customer') : null;
    const [confirmRun, setConfirmRun] = useState(false);
    const [running, setRunning] = useState(false);
    const [runError, setRunError] = useState('');
    const [runNotes, setRunNotes] = useState([]);
    const lock = useRef(false);
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const responses = await Promise.all([getBillingAccounts(), getBillingInvoices(), getBillingPayments(), getGatewayPayments()]);
            const failed = responses.find((response) => response.code !== 1);
            if (failed) throw new Error(failed.message || 'Unable to load billing records.');
            setAccounts(responses[0].data); setInvoices(responses[1].data); setPayments(responses[2].data);
            setGateway(responses[3].data);
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);
    const run = async () => {
        if (lock.current) return;
        lock.current = true; setRunning(true); setRunError(''); setRunNotes([]);
        try {
            const response = await generateDueBills();
            if (response.code !== 1) throw new Error(response.message || 'Unable to generate bills.');
            setConfirmRun(false); setFeedback(response.message); setRunNotes(response.data.skipped || []);
            await load();
        } catch (err) { setRunError(err.response?.data?.message || err.message); }
        finally { lock.current = false; setRunning(false); }
    };
    const openAccount = (id) => inline.open('account', { customer: id });
    const print = (work) => { try { work(); } catch (err) { setError(err.message); } };
    const verify = async (id) => {
        if (verifyLock.current) return;
        verifyLock.current = true; setVerifying(id); setError('');
        try { const response = await verifyGatewayPayment(id); if (response.code !== 1) throw new Error(response.message); setFeedback(response.message); await load(); }
        catch (err) { setError(err.response?.data?.message || err.message); }
        finally { verifyLock.current = false; setVerifying(null); }
    };
    if (selected) return <CustomerAccount key={selected} customerId={selected} onBack={() => { inline.back(); load(); }} backLabel={tab === 'payments' ? 'Payments' : tab === 'invoices' ? 'Bills' : 'Client Billing'} />;

    const accountColumns = [
        { id: 'fullName', label: 'Customer', sortable: true, render: (row) => <TablePrimaryText fontSize={14} primary={row.fullName} secondary={row.id} /> },
        { id: 'phone', label: 'Phone' }, { id: 'planName', label: 'Plan', render: (row) => row.planName || 'Plan needs review' },
        { id: 'balanceCents', label: 'Balance', align: 'right', sortable: true, render: (row) => `${money(Math.abs(row.balanceCents))}${row.balanceCents < 0 ? ' credit' : row.balanceCents > 0 ? ' owing' : ''}` },
        { id: 'overdueCents', label: 'Overdue', align: 'right', sortable: true, render: (row) => money(row.overdueCents) },
        { id: 'billingStatus', label: 'Billing', render: (row) => <StatusBadge label={row.billingStatus.replaceAll('_', ' ')} /> },
        { id: 'actions', label: 'Actions', align: 'right', render: (row) => <TableActionButton label={`Open account for ${row.fullName}`} icon={<AccountBalanceWallet />} onClick={() => openAccount(row.id)} /> }
    ];
    const invoiceColumns = [
        { id: 'reference', label: 'Bill / Customer', sortable: true, render: (row) => <TablePrimaryText fontSize={14} primary={row.reference} secondary={`${row.fullName} · ${row.customerId}`} /> },
        { id: 'periodStart', label: 'Service Period', render: (row) => `${formatDate(row.serviceStart)} – ${formatDate(row.periodEnd)}` },
        { id: 'amountCents', label: 'Amount', align: 'right', sortable: true, render: (row) => money(row.amountCents) },
        { id: 'outstandingCents', label: 'Outstanding', align: 'right', sortable: true, render: (row) => money(row.outstandingCents) },
        { id: 'dueOn', label: 'Due', sortable: true, render: (row) => formatDate(row.dueOn) },
        { id: 'status', label: 'Status', render: (row) => <StatusBadge label={row.status} /> },
        { id: 'actions', label: 'Actions', align: 'right', render: (row) => <Stack direction="row" spacing={1}><TableActionButton label={`Print invoice ${row.reference}`} icon={<Print />} onClick={() => print(() => printSubscriptionBill({ id: row.customerId, fullName: row.fullName }, row))} /><TableActionButton label={`Open account for ${row.fullName}`} icon={<AccountBalanceWallet />} onClick={() => openAccount(row.customerId)} /></Stack> }
    ];
    const paymentColumns = [
        { id: 'receipt', label: 'Receipt / Customer', sortable: true, render: (row) => <TablePrimaryText fontSize={14} primary={row.receipt} secondary={`${row.fullName} · ${row.customerId}`} /> },
        { id: 'date', label: 'Date', sortable: true, render: (row) => formatDate(row.date) },
        { id: 'amountCents', label: 'Amount', align: 'right', sortable: true, render: (row) => money(row.amountCents) },
        { id: 'method', label: 'Method / Reference', render: (row) => <TablePrimaryText fontSize={14} primary={paymentMethodLabel(row.method)} secondary={row.reference} /> },
        { id: 'source', label: 'Paid Via / Recorded By', render: paymentSourceLabel },
        { id: 'status', label: 'Status', render: (row) => <StatusBadge label={row.status} /> },
        { id: 'actions', label: 'Actions', align: 'right', render: (row) => <Stack direction="row" spacing={1}><TableActionButton label={`Print receipt ${row.receipt}`} icon={<Print />} onClick={() => print(() => printPaymentReceipt({ id: row.customerId, fullName: row.fullName }, { ...row, creditCents: row.amountCents }))} /><TableActionButton label={`Open account for ${row.fullName}`} icon={<AccountBalanceWallet />} onClick={() => openAccount(row.customerId)} /></Stack> }
    ];
    const gatewayColumns = [
        { id: 'reference', label: 'Paystack Reference / Customer', render: (row) => <TablePrimaryText primary={row.reference} secondary={`${row.fullName} · ${row.customerId}`} /> },
        { id: 'date', label: 'Started', render: (row) => formatDate(row.date) },
        { id: 'amountCents', label: 'Amount', render: (row) => money(row.amountCents) },
        { id: 'environment', label: 'Mode / Network', render: (row) => <TablePrimaryText primary={row.environment === 'test' ? 'TEST — no ledger credit' : 'Live'} secondary={row.provider} /> },
        { id: 'status', label: 'Gateway Status', render: (row) => <StatusBadge label={row.status} /> },
        { id: 'receipt', label: 'Ledger Receipt', render: (row) => row.receipt ? `${row.receipt}${row.reversed ? ' · reversed' : ''}` : row.status === 'success' && row.environment === 'test' ? 'Test confirmation only' : 'Not posted' },
        { id: 'actions', label: 'Actions', render: (row) => <Stack direction="row" spacing={1}><TableActionButton label={`Open account for ${row.fullName}`} icon={<AccountBalanceWallet />} onClick={() => openAccount(row.customerId)} />{row.status !== 'success' && <LdButton variant="outlined" loading={verifying === row.id} disabled={Boolean(verifying) && verifying !== row.id} onClick={() => verify(row.id)}>Verify</LdButton>}</Stack> }
    ];
    const options = tab === 'accounts'
        ? [{ value: 'owing', label: 'Owing' }, { value: 'credit', label: 'In credit' }, { value: 'settled', label: 'Settled' }, { value: 'needs_review', label: 'Needs billing review' }]
        : (tab === 'invoices' ? ['unpaid', 'partially paid', 'overdue', 'paid', 'voided'] : tab === 'gateway' ? ['created', 'pending', 'send_otp', 'unknown', 'review', 'success', 'failed'] : ['paid', 'reversed']).map((value) => ({ value, label: value.replace(/^./, (character) => character.toUpperCase()) }));
    const source = tab === 'accounts' ? accounts : tab === 'invoices' ? invoices : tab === 'gateway' ? gateway : payments;
    const rows = source.filter((row) => {
        const search = query.trim().toLowerCase();
        const match = tab === 'accounts' ? filter === 'all' || (filter === 'owing' && row.balanceCents > 0) || (filter === 'credit' && row.balanceCents < 0) || (filter === 'settled' && row.balanceCents === 0) || (filter === 'needs_review' && row.billingStatus === 'needs_review') : filter === 'all' || row.status === filter;
        const methodMatch = tab !== 'payments' || (paymentSource === 'all' || row.source === paymentSource) && (paymentMethod === 'all' || row.method === paymentMethod);
        return match && methodMatch && (!search || [row.id, row.customerId, row.fullName, row.phone, row.reference, row.receipt, row.collectorName].some((value) => String(value || '').toLowerCase().includes(search)));
    });
    return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title="Client Billing" description="Monthly subscription accounts and debit/credit balances." actions={<>
            <LdButton variant="outlined" startIcon={<Refresh />} loading={loading} onClick={load}>Refresh</LdButton>
            <LdButton startIcon={<ReceiptLong />} disabled={loading || Boolean(error)} onClick={() => { setRunError(''); setConfirmRun(true); }}>Generate Due Bills</LdButton>
        </>} />
        {feedback && <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>To collect on a client&apos;s behalf or generate their invoice, open their Client Account. Receipts distinguish staff-recorded payments from verified client Paystack payments. Clients can pay at /pay or dial *412*99#. USSD reconciliation is not connected yet.</Alert>
        {runNotes.map((item) => <Alert severity="warning" key={item.customerId} sx={{ mb: 1 }}>{item.customerId}: {item.reason}</Alert>)}
        {!loading && !error && <Grid container spacing={2} sx={{ mb: 2 }}>{[
            ['Total Owing', accounts.reduce((sum, row) => sum + Math.max(0, row.balanceCents), 0)],
            ['Client Credit', accounts.reduce((sum, row) => sum + Math.max(0, -row.balanceCents), 0)],
            ['Overdue', accounts.reduce((sum, row) => sum + row.overdueCents, 0)]
        ].map(([label, value]) => <Grid item xs={12} md={4} key={label}><Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h3" sx={{ mt: 0.75 }}>{money(value)}</Typography></Paper></Grid>)}</Grid>}
        <Tabs value={tab} onChange={(_, value) => { setTab(value); setQuery(''); setFilter('all'); }} aria-label="Billing sections" variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}><Tab value="accounts" label="Client Accounts" /><Tab value="invoices" label="Bills" /><Tab value="payments" label="Payments / Receipts" /><Tab value="gateway" label="Paystack Transactions" /></Tabs>
        <AppTable key={tab} ariaLabel={`Billing ${tab}`} columns={tab === 'accounts' ? accountColumns : tab === 'invoices' ? invoiceColumns : tab === 'gateway' ? gatewayColumns : paymentColumns} rows={rows} loading={loading} error={error} onRetry={load} fontSize={14} minWidth={950} emptyTitle="No matching records" emptyDescription="Review account activation or change the filters."
            toolbar={<TableToolbar title={tab === 'accounts' ? 'Client Accounts' : tab === 'invoices' ? 'Subscription Bills' : tab === 'gateway' ? 'All Paystack Attempts' : 'Payments'} count={loading ? undefined : rows.length} searchValue={query} onSearchChange={setQuery} searchLabel="Search customer, collector or reference"
                filters={<><TableFilter label="Status" allLabel="All statuses" value={filter} onChange={setFilter} options={options} />{tab === 'payments' && <><TableFilter label="Source" value={paymentSource} onChange={setPaymentSource} options={[{ value: 'staff', label: 'Staff-recorded' }, { value: 'paystack', label: 'Client Paystack' }]} /><TableFilter label="Method" value={paymentMethod} onChange={setPaymentMethod} options={[...paymentMethods, { value: 'paystack', label: 'Paystack (Online)' }]} /></>}</>} actions={<LdButton variant="text" onClick={() => { setQuery(''); setFilter('all'); setPaymentSource('all'); setPaymentMethod('all'); }}>Reset</LdButton>} />} />
        <MediumDialog open={confirmRun} onClose={() => { if (!lock.current) setConfirmRun(false); }} title="Generate Due Bills">
            <Stack spacing={2} sx={{ p: 2 }}>
                {runError && <Alert severity="error">{runError}</Alert>}
                <Typography variant="body2">Generate bills for completed monthly periods on activated accounts? Existing bills are not duplicated. Accounts awaiting activation/review are not charged.</Typography>
                <Stack direction="row" spacing={1} justifyContent="flex-end"><LdButton variant="outlined" onClick={() => setConfirmRun(false)} disabled={running}>Cancel</LdButton><LdButton loading={running} onClick={run}>Generate Bills</LdButton></Stack>
            </Stack>
        </MediumDialog>
    </Box>;
};
BillingWorkspace.propTypes = { initialTab: PropTypes.oneOf(['accounts', 'invoices', 'payments']) };
export default BillingWorkspace;
