import { useCallback, useEffect, useRef, useState } from 'react';
import { Add, Edit, Payments, Refresh, Tune } from '@mui/icons-material';
import { Alert, Box, Grid, Paper, Stack, Typography } from '@mui/material';
import StatusBadge from 'ui-component/StatusBadge';
import { PageHeader } from 'ui-component/PageLayout';
import { createPlan, getPlans, updatePlan } from 'services/api/plansService';
import { AppTable, TableActionButton, TableFilter, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import useInlineNavigation from 'utils/useInlineNavigation';
import { formatCurrency, formatDate } from 'utils/formatters';
import { LdButton } from 'utils/myButtons';
import PlanSettingsForm from './components/PlanSettingsForm';
import BillingSettings from './components/BillingSettings';

const sections = {
    plans: { label: 'Plan Settings' }, billing: { label: 'Billing Settings' },
    'new-plan': { label: 'New Plan', parent: 'plans' }, 'edit-plan': { label: 'Edit Plan', parent: 'plans' }
};

const AdminSettings = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [saving, setSaving] = useState(false);
    const [billingSaving, setBillingSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const lock = useRef(false);
    const inline = useInlineNavigation({ sections, rootLabel: 'Settings', parameter: 'section', contextKeys: ['plan'], blocked: saving || billingSaving });
    const section = inline.view;
    const formOpen = ['new-plan', 'edit-plan'].includes(section);
    const editing = section === 'edit-plan' ? plans.find((plan) => String(plan.id) === inline.params.get('plan')) : null;
    const canManage = ['Admin', 'Super Admin', 'Manager'].includes(localStorage.getItem('admin_role'));

    const loadPlans = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await getPlans();
            if (response.code !== 1) throw new Error(response.message || 'Unable to load plans.');
            setPlans(response.data);
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { loadPlans(); }, [loadPlans]);

    const openForm = (plan = null) => { setFormError(''); setFeedback(''); inline.open(plan ? 'edit-plan' : 'new-plan', plan ? { plan: plan.id } : {}); };
    const closeForm = () => { if (!lock.current) inline.back(); };
    const savePlan = async (values) => {
        if (lock.current || (section === 'edit-plan' && !editing)) return;
        lock.current = true;
        setSaving(true);
        setFormError('');
        try {
            const payload = { ...values, planCode: values.planCode.trim(), name: values.name.trim(), amount: String(values.amount), pickupFrequency: Number(values.pickupFrequency), graceDays: Number(values.graceDays) };
            const response = editing ? await updatePlan(editing.id, payload) : await createPlan(payload);
            if (response.code !== 1) throw new Error(response.message || 'Unable to save plan.');
            inline.close();
            setFeedback(response.message);
            await loadPlans();
        } catch (err) { setFormError(err.response?.data?.message || err.message); }
        finally { lock.current = false; setSaving(false); }
    };

    if (!section) return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title="Settings" description="Service plans and subscription billing." inlineNavigation={inline.navigation} />
        <Grid container spacing={2}>
            {[{ id: 'plans', title: 'Plan Settings', description: 'Create plans and schedule pricing changes.', icon: Tune }, { id: 'billing', title: 'Billing Settings', description: 'Choose how to bill clients joining mid-month.', icon: Payments }].map((item) => {
                const Icon = item.icon;
                return <Grid item xs={12} md={6} key={item.id}><Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}><Stack spacing={1.5} alignItems="flex-start"><Icon color="primary" /><Typography component="h2" variant="h4">{item.title}</Typography><Typography variant="body2" color="text.secondary">{item.description}</Typography><LdButton variant="outlined" onClick={() => inline.open(item.id)}>Open {item.title}</LdButton></Stack></Paper></Grid>;
            })}
        </Grid>
    </Box>;

    if (section === 'billing') return <Box sx={{ p: { xs: 1, md: 2 } }}><PageHeader title="Billing Settings" inlineNavigation={inline.navigation} /><BillingSettings onPendingChange={setBillingSaving} /></Box>;

    if (formOpen) return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title={section === 'edit-plan' ? 'Edit Plan' : 'New Plan'} inlineNavigation={inline.navigation} />
        {loading ? <Typography role="status">Loading plan…</Typography> : error ? <Alert severity="error" action={<LdButton onClick={loadPlans} loading={loading}>Retry</LdButton>}>{error}</Alert> : section === 'edit-plan' && !editing ? <Alert severity="warning">Plan not found. Return to Plan Settings and select a valid plan.</Alert> : <Paper variant="outlined" sx={{ borderRadius: 2, maxWidth: 1100, mx: 'auto' }}><PlanSettingsForm key={editing?.id || 'new'} open initialValues={editing} onSubmit={savePlan} onCancel={closeForm} loading={saving} error={formError} /></Paper>}
    </Box>;

    const filtered = plans.filter((plan) => (status === 'all' || plan.status === status) && [plan.name, plan.planCode].some((value) => value.toLowerCase().includes(query.trim().toLowerCase())));
    const scheduled = plans.filter((plan) => plan.nextAmount !== null && plan.nextAmount !== undefined).length;
    const columns = [
        { id: 'name', label: 'Plan', sortable: true, render: (plan) => <TablePrimaryText fontSize={14} primary={plan.name} secondary={plan.planCode} /> },
        { id: 'billingCycle', label: 'Cycle', sortable: true, render: (plan) => ({ monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }[plan.billingCycle]) },
        { id: 'amount', label: 'Current Amount', align: 'right', sortable: true, getValue: (plan) => Number(plan.amount), render: (plan) => formatCurrency(plan.amount) },
        { id: 'nextAmount', label: 'Next-Cycle Amount', align: 'right', render: (plan) => plan.nextAmount === null || plan.nextAmount === undefined ? '—' : <TablePrimaryText fontSize={14} primary={formatCurrency(plan.nextAmount)} secondary={`From ${formatDate(plan.nextEffectiveDate)}`} /> },
        { id: 'pickupFrequency', label: 'Pickups / Week', sortable: true },
        { id: 'graceDays', label: 'Grace Days', sortable: true },
        { id: 'customerCount', label: 'Customers', sortable: true },
        { id: 'status', label: 'Status', render: (plan) => <StatusBadge label={plan.status} /> },
        { id: 'actions', label: 'Actions', align: 'right', render: (plan) => <TableActionButton label={`Edit ${plan.name}`} icon={<Edit />} onClick={() => openForm(plan)} disabled={!canManage} tooltip={!canManage ? 'Manager or administrator access is required' : 'Edit plan'} /> }
    ];

    return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title="Plan Settings" description="Plan amounts are charged per billing cycle." inlineNavigation={inline.navigation} actions={<>
            <LdButton variant="outlined" startIcon={<Refresh />} loading={loading} onClick={loadPlans}>Refresh</LdButton>
            <LdButton startIcon={<Add />} onClick={() => openForm()} disabled={!canManage || loading || Boolean(error)}>Add Plan</LdButton>
        </>} />
        {feedback && <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert>}
        {!loading && !error && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{plans.length} plans · {plans.filter((plan) => plan.status === 'active').length} active · {scheduled} scheduled price changes</Typography>}
        <AppTable ariaLabel="Subscription plans" columns={columns} rows={filtered} fontSize={14} minWidth={1000} loading={loading} error={error} onRetry={loadPlans} emptyTitle={query || status !== 'all' ? 'No matching plans' : 'No plans yet'} emptyDescription="Create a plan or adjust your filters."
            toolbar={<TableToolbar title="Plans" count={loading ? undefined : filtered.length} searchValue={query} onSearchChange={setQuery} searchLabel="Search plans" filters={<TableFilter label="Status" value={status} onChange={setStatus} allLabel="All statuses" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />} actions={<LdButton variant="text" onClick={() => { setQuery(''); setStatus('all'); }}>Reset</LdButton>} />} />
    </Box>;
};

export default AdminSettings;
