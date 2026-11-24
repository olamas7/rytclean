import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { Payments, Print, ReceiptLong, Refresh, Undo, Visibility } from '@mui/icons-material';
import { Alert, Box, Grid, MenuItem, Paper, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import { activateCustomerBilling, generateDueBills, getCustomerAccount, newRequestKey, postAccountEntry } from 'services/api/billingService';
import { PageHeader, FormActions } from 'ui-component/PageLayout';
import StatusBadge from 'ui-component/StatusBadge';
import { AppTable, TableActionButton, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import useInlineNavigation from 'utils/useInlineNavigation';
import { formatCurrency, formatDate } from 'utils/formatters';
import { printAccountStatement, printPaymentReceipt, printSubscriptionBill } from 'utils/accountPrinting';
import { LdButton } from 'utils/myButtons';
import { paymentMethods, paymentMethodLabel, paymentSourceLabel } from 'utils/paymentMethods';

const today = () => new Date().toISOString().slice(0, 10);
const money = (cents) => formatCurrency(Number(cents) / 100);
const balanceText = (cents) => `${money(Math.abs(cents))}${cents < 0 ? ' credit' : cents > 0 ? ' owing' : ''}`;
const labels = { payment: 'Record Payment', credit_adjustment: 'Credit Adjustment', debit_adjustment: 'Debit Adjustment', reversal: 'Reverse Entry', activate: 'Activate Monthly Billing', run: 'Generate Due Bills' };
const sections = { ...Object.fromEntries(Object.entries(labels).map(([key, label]) => [key, { label }])), invoice: { label: 'Subscription Bill' } };

const CustomerAccount = ({ customerId, onBack, backLabel = 'Client Billing' }) => {
    const [account, setAccount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [tab, setTab] = useState('statement');
    const [saving, setSaving] = useState(false);
    const inline = useInlineNavigation({ sections, rootLabel: 'Customer Account', parameter: 'action', contextKeys: ['entry', 'invoice'], blocked: saving });
    const action = inline.view === 'invoice' ? '' : inline.view;
    const entryId = inline.params.get('entry');
    const selectedEntry = account?.statement.find((entry) => String(entry.id) === entryId) || null;
    const selectedInvoice = inline.view === 'invoice' ? account?.invoices.find((invoice) => String(invoice.id) === inline.params.get('invoice')) : null;
    const [formError, setFormError] = useState('');
    const [runNotes, setRunNotes] = useState([]);
    const lock = useRef(false);
    const requestKey = useRef('');
    const { control, handleSubmit, reset, watch } = useForm({ defaultValues: { amount: '', date: today(), method: 'cash', reference: '', note: '', serviceStart: today() } });
    const paymentMethod = watch('method');
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const response = await getCustomerAccount(customerId);
            if (response.code !== 1) throw new Error(response.message || 'Unable to load account.');
            setAccount(response.data);
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setLoading(false); }
    }, [customerId]);
    useEffect(() => { setAccount(null); setTab('statement'); load(); }, [load]);
    useEffect(() => {
        if (!action) return;
        requestKey.current = newRequestKey();
        setFormError('');
        reset({ amount: '', date: today(), method: 'cash', reference: '', note: action === 'payment' ? 'Payment received' : '', serviceStart: account?.customer.joinedDate > today() ? account.customer.joinedDate : today() });
    }, [action, entryId, account?.customer.joinedDate, reset]);
    const openAction = (type, entry = null) => {
        setFormError(''); setFeedback(''); setRunNotes([]);
        inline.open(type, entry ? { entry: entry.id } : {});
    };
    const closeAction = () => { if (!lock.current) inline.back(); };
    const submit = async (values) => {
        if (lock.current || (action === 'reversal' && !selectedEntry)) return;
        lock.current = true; setSaving(true); setFormError('');
        try {
            const response = action === 'activate' ? await activateCustomerBilling(customerId, values.serviceStart)
                : action === 'run' ? await generateDueBills(customerId)
                    : await postAccountEntry(customerId, { ...values, type: action, entryId: selectedEntry?.id, requestKey: requestKey.current });
            if (response.code !== 1) throw new Error(response.message || 'Unable to save account entry.');
            if (action === 'payment') setTab('payments');
            inline.close(); setFeedback(response.message); setRunNotes(response.data?.skipped || []);
            await load();
        } catch (err) { setFormError(err.response?.data?.message || err.message); }
        finally { lock.current = false; setSaving(false); }
    };
    const print = (work) => { try { work(); } catch (err) { setError(err.message); } };
    const statementColumns = [
        { id: 'date', label: 'Date', render: (entry) => formatDate(entry.date) },
        { id: 'description', label: 'Entry', render: (entry) => <TablePrimaryText fontSize={14} primary={entry.description} secondary={`${entry.type.replaceAll('_', ' ')} · #${entry.id}${entry.reversed ? ' · Reversed' : ''}`} /> },
        { id: 'debitCents', label: 'Debit', align: 'right', render: (entry) => entry.debitCents ? money(entry.debitCents) : '—' },
        { id: 'creditCents', label: 'Credit', align: 'right', render: (entry) => entry.creditCents ? money(entry.creditCents) : '—' },
        { id: 'balanceCents', label: 'Running Balance', align: 'right', render: (entry) => balanceText(entry.balanceCents) },
        { id: 'actions', label: 'Actions', align: 'right', render: (entry) => <TableActionButton label={`Reverse entry ${entry.id}`} icon={<Undo />} disabled={entry.reversed || entry.type === 'reversal'} onClick={() => openAction('reversal', entry)} tooltip="Reverse with a reason" /> }
    ];
    const invoiceColumns = [
        { id: 'reference', label: 'Bill / Plan', render: (invoice) => <TablePrimaryText fontSize={14} primary={invoice.reference} secondary={invoice.plan_name} /> },
        { id: 'periodStart', label: 'Service Period', render: (invoice) => `${formatDate(invoice.serviceStart)} – ${formatDate(invoice.periodEnd)}` },
        { id: 'amountCents', label: 'Billed', align: 'right', render: (invoice) => money(invoice.amountCents) },
        { id: 'settledCents', label: 'Settled', align: 'right', render: (invoice) => money(invoice.settledCents) },
        { id: 'outstandingCents', label: 'Outstanding', align: 'right', render: (invoice) => money(invoice.outstandingCents) },
        { id: 'dueOn', label: 'Due', render: (invoice) => formatDate(invoice.dueOn) },
        { id: 'status', label: 'Status', render: (invoice) => <StatusBadge label={invoice.status} /> },
        { id: 'actions', label: 'Actions', align: 'right', render: (invoice) => <TableActionButton label={`View ${invoice.reference}`} icon={<Visibility />} onClick={() => inline.open('invoice', { invoice: invoice.id })} /> }
    ];
    const paymentColumns = [
        { id: 'id', label: 'Receipt', render: (entry) => `RCPT-${entry.id}` },
        { id: 'date', label: 'Date', render: (entry) => formatDate(entry.date) },
        { id: 'creditCents', label: 'Amount', align: 'right', render: (entry) => money(entry.creditCents) },
        { id: 'method', label: 'Method / Reference', render: (entry) => <TablePrimaryText fontSize={14} primary={paymentMethodLabel(entry.method)} secondary={entry.reference} /> },
        { id: 'source', label: 'Paid Via / Recorded By', render: paymentSourceLabel },
        { id: 'status', label: 'Status', render: (entry) => <StatusBadge label={entry.reversed ? 'reversed' : 'paid'} /> },
        { id: 'actions', label: 'Actions', align: 'right', render: (entry) => <TableActionButton label={`Print receipt ${entry.id}`} icon={<Print />} onClick={() => print(() => printPaymentReceipt(account.customer, entry))} /> }
    ];

    return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title={inline.view ? sections[inline.view].label : account ? `${account.customer.fullName} · ${account.customer.id}` : 'Customer Account'} description={inline.view && account ? `${account.customer.fullName} · ${account.customer.id}` : 'Subscription bills, payments and account statement.'} inlineNavigation={inline.view ? inline.navigation : { active: Boolean(onBack), parentLabel: backLabel, onBack, disabled: saving }} actions={!inline.view && <>
            <LdButton variant="outlined" startIcon={<Refresh />} loading={loading} onClick={load}>Refresh</LdButton>
            <LdButton variant="outlined" startIcon={<Print />} disabled={!account || loading} onClick={() => print(() => printAccountStatement(account))}>Print Statement</LdButton>
        </>} />
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {feedback && <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert>}
        {runNotes.map((item) => <Alert severity="warning" key={item.customerId} sx={{ mb: 1 }}>{item.reason}</Alert>)}
        {loading ? <Skeleton variant="rounded" height={350} /> : account && !inline.view && <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
                {[['Balance', balanceText(account.summary.balanceCents)], ['Total Billed', money(account.summary.totalBilledCents)], ['Total Paid', money(account.summary.totalPaidCents)], ['Overdue', money(account.summary.overdueCents)]].map(([label, value]) => <Grid item xs={12} sm={6} lg={3} key={label}><Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h3" sx={{ mt: 0.75 }}>{value}</Typography></Paper></Grid>)}
            </Grid>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}><Stack spacing={1.5}>
                <Typography variant="body2">Current plan: <strong>{account.customer.planName}</strong> · Billing: <strong>{account.subscription.status.replaceAll('_', ' ')}</strong></Typography>
                {account.pendingPlan && <Typography variant="body2" color="text.secondary">Next plan: {account.pendingPlan.planName} from {formatDate(account.pendingPlan.effectiveFrom)}</Typography>}
                {account.subscription.serviceStart && <Typography variant="body2" color="text.secondary">Billing starts {formatDate(account.subscription.serviceStart)} · First month: {account.subscription.firstMonthPolicy === 'prorated' ? 'remaining days' : 'full month'}</Typography>}
                {account.subscription.billEligibleFrom && <Typography variant="body2" color="text.secondary">Next bill eligible from {formatDate(account.subscription.billEligibleFrom)}{account.subscription.cycleAmountCents !== null ? ` · Monthly rate ${money(account.subscription.cycleAmountCents)}` : ''}</Typography>}
                {account.subscription.holdReason && <Alert severity="warning">{account.subscription.holdReason}</Alert>}
                {account.subscription.status === 'needs_review' && <Alert severity="info">Review this account and activate monthly billing before generating charges. Historical arrears are not added automatically.</Alert>}
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <LdButton startIcon={<Payments />} onClick={() => openAction('payment')}>Record Payment</LdButton>
                    {account.subscription.status !== 'active' && <LdButton variant="outlined" onClick={() => openAction('activate')}>Activate Billing</LdButton>}
                    <LdButton variant="outlined" startIcon={<ReceiptLong />} disabled={account.subscription.status !== 'active'} tooltip={account.subscription.status !== 'active' ? 'Activate monthly billing before generating invoices' : 'Generate invoices for completed monthly service periods'} onClick={() => openAction('run')}>Generate Due Bills</LdButton>
                    <LdButton variant="outlined" onClick={() => openAction('credit_adjustment')}>Add Credit</LdButton>
                    <LdButton variant="outlined" onClick={() => openAction('debit_adjustment')}>Add Debit</LdButton>
                </Stack>
            </Stack></Paper>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Customer account sections" sx={{ mb: 2 }}><Tab value="statement" label="Statement" /><Tab value="invoices" label="Bills" /><Tab value="payments" label="Payments" /></Tabs>
            <AppTable ariaLabel={`Customer ${tab}`} fontSize={14} minWidth={850} rows={tab === 'statement' ? account.statement : tab === 'invoices' ? account.invoices : account.statement.filter((entry) => entry.type === 'payment')}
                columns={tab === 'statement' ? statementColumns : tab === 'invoices' ? invoiceColumns : paymentColumns} emptyTitle="No account entries yet" toolbar={<TableToolbar title={tab === 'statement' ? 'Account Statement' : tab === 'invoices' ? 'Subscription Bills' : 'Payment Receipts'} />} />
            {tab === 'statement' && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Debits increase the amount owing; credits reduce it. Running balances follow posting order. Overpayments carry forward.</Typography>}
        </>}
        {!loading && account && inline.view === 'invoice' && <Paper variant="outlined" sx={{ borderRadius: 2, maxWidth: 1100, mx: 'auto' }}>
            {selectedInvoice && <Stack spacing={1.5} sx={{ p: 2 }}>
                <Typography variant="h3">{selectedInvoice.reference}</Typography>
                <Typography variant="body2">{account?.customer.fullName} · {selectedInvoice.plan_name}</Typography>
                <Typography variant="body2">{formatDate(selectedInvoice.serviceStart)} – {formatDate(selectedInvoice.periodEnd)}</Typography>
                <Typography variant="body2">{selectedInvoice.first_month_policy === 'prorated' ? `${selectedInvoice.service_days} / ${selectedInvoice.month_days} days × ${money(selectedInvoice.rate_cents)}` : 'Full monthly charge'}</Typography>
                <Typography variant="h4">Amount: {money(selectedInvoice.amountCents)}</Typography>
                <Typography variant="body2">Settled: {money(selectedInvoice.settledCents)} · Outstanding: {money(selectedInvoice.outstandingCents)}</Typography>
                <Typography variant="body2">Due: {formatDate(selectedInvoice.dueOn)}</Typography>
                <StatusBadge label={selectedInvoice.status} />
                <LdButton variant="outlined" startIcon={<Print />} onClick={() => print(() => printSubscriptionBill(account.customer, selectedInvoice))}>Print Bill</LdButton>
            </Stack>}
            {!selectedInvoice && <Alert severity="warning">Bill not found. Return to the customer account and choose a valid bill.</Alert>}
        </Paper>}
        {!loading && account && action && <Paper variant="outlined" sx={{ borderRadius: 2, maxWidth: 1100, mx: 'auto' }}>
            {action === 'reversal' && !selectedEntry ? <Alert severity="warning">Entry not found. Return to the customer account and choose a valid entry.</Alert> :
            <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit(submit)} sx={{ p: 2 }}>
                {formError && <Alert severity="error">{formError}</Alert>}
                {action === 'activate' ? <>
                    <RHFTextField name="serviceStart" label="Billing Service Start" type="date" control={control} required InputLabelProps={{ shrink: true }} inputProps={{ min: today() }} disabled={saving} rules={{ required: 'Choose a service start date' }} />
                    <Alert severity="info">Only monthly plans are supported. No bills are created before this start date. The configured full-month/prorated rule applies to the first month.</Alert>
                </> : action === 'run' ? <Alert severity="info">Generate bills for completed monthly service periods only. Existing bills will not be duplicated.</Alert> : <>
                    {action !== 'reversal' && <RHFTextField name="amount" label="Amount (GHS)" type="number" control={control} required disabled={saving} inputProps={{ min: 0.01, step: '0.01' }} rules={{ required: 'Amount is required', validate: (value) => /^\d+(\.\d{1,2})?$/.test(String(value)) && Number(value) > 0 && Number(value) <= 99999999.99 || 'Enter an amount greater than zero with up to two decimals' }} />}
                    {action === 'reversal' && <Alert severity="warning">Reverse “{selectedEntry?.description}”? The original entry stays in the statement. This affects balances and bill allocations. This does not refund a Paystack payment, cancel a cheque or reverse a bank transfer.</Alert>}
                    <RHFTextField name="date" label="Transaction Date" type="date" control={control} required disabled={saving} InputLabelProps={{ shrink: true }} inputProps={{ max: today() }} rules={{ required: 'Date is required' }} />
                    {action === 'payment' && <>
                        <Alert severity="info">Record money received on this customer&apos;s behalf. This receipt will identify it as staff-recorded and retain your staff name. This form does not charge a wallet or clear a cheque.</Alert>
                        <RHFTextField name="method" label="Payment Method" control={control} select disabled={saving}>{paymentMethods.map((method) => <MenuItem key={method.value} value={method.value}>{method.label}</MenuItem>)}</RHFTextField>
                        <RHFTextField name="reference" label="Transaction Reference" control={control} required={paymentMethod !== 'cash'} disabled={saving} rules={{ validate: (value) => paymentMethod === 'cash' || Boolean(value.trim()) || 'Transaction reference is required', maxLength: { value: 120, message: 'Use at most 120 characters' } }} />
                    </>}
                    <RHFTextField name="note" label={action === 'payment' ? 'Description' : 'Reason'} control={control} required multiline minRows={2} disabled={saving} rules={{ required: 'Enter a reason/description', validate: (value) => Boolean(value.trim()) || 'Enter a reason/description', maxLength: { value: 500, message: 'Use at most 500 characters' } }} />
                </>}
                <FormActions onCancel={closeAction} loading={saving} submitLabel={labels[action] || 'Save'} />
            </Stack>}
        </Paper>}
    </Box>;
};

CustomerAccount.propTypes = { customerId: PropTypes.string.isRequired, onBack: PropTypes.func, backLabel: PropTypes.string };
export default CustomerAccount;
