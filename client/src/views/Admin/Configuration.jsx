import { useCallback, useEffect, useRef, useState } from 'react';
import { Add, Edit, Refresh } from '@mui/icons-material';
import { Alert, Box, MenuItem, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { createClientCategory, getClientCategories, updateClientCategory } from 'services/api/clientCategoriesService';
import { PageHeader, FormActions } from 'ui-component/PageLayout';
import StatusBadge from 'ui-component/StatusBadge';
import { AppTable, TableActionButton, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import useInlineNavigation from 'utils/useInlineNavigation';
import { LdButton } from 'utils/myButtons';
import BillingSettings from 'views/Management/Admin/Settings/components/BillingSettings';
import SmsSettings from './SmsSettings';
const sections = { 'new-category': { label: 'New Client Category' }, 'edit-category': { label: 'Edit Client Category' } };

const Configuration = () => {
    const [tab, setTab] = useState('client-categories');
    const [categories, setCategories] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [saving, setSaving] = useState(false);
    const inline = useInlineNavigation({ sections, rootLabel: 'Client Categories', contextKeys: ['category'], blocked: saving });
    const selected = inline.view === 'edit-category' ? categories.find((category) => String(category.id) === inline.params.get('category')) : null;
    const savingRef = useRef(false);
    const [saveError, setSaveError] = useState('');
    const { control, handleSubmit, reset } = useForm({ defaultValues: { name: '', status: 'active' } });
    const canManage = ['Admin', 'Super Admin'].includes(localStorage.getItem('admin_role'));

    const loadCategories = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await getClientCategories();
            if (response.code !== 1) throw new Error(response.message || 'Unable to load client categories.');
            setCategories(response.data);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Unable to load client categories.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadCategories(); }, [loadCategories]);
    useEffect(() => { reset({ name: selected?.name || '', status: selected?.status || 'active' }); }, [inline.view, selected, reset]);

    const openForm = (category = null) => {
        setSaveError('');
        setFeedback('');
        inline.open(category ? 'edit-category' : 'new-category', category ? { category: category.id } : {});
    };
    const closeForm = () => { if (!savingRef.current) inline.back(); };
    const saveCategory = async (values) => {
        if (savingRef.current || (inline.view === 'edit-category' && !selected)) return;
        savingRef.current = true;
        setSaving(true);
        setSaveError('');
        try {
            const payload = { ...values, name: values.name.trim() };
            const response = selected ? await updateClientCategory(selected.id, payload) : await createClientCategory(payload);
            if (response.code !== 1) throw new Error(response.message || 'Unable to save category.');
            inline.close();
            setFeedback(response.message || 'Client category saved.');
            await loadCategories();
        } catch (err) {
            setSaveError(err.response?.data?.message || err.message || 'Unable to save category.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const columns = [
        { id: 'name', label: 'Category', sortable: true, render: (category) => <TablePrimaryText primary={category.name} /> },
        { id: 'status', label: 'Status', sortable: true, render: (category) => <StatusBadge label={category.status} /> },
        { id: 'actions', label: 'Actions', align: 'right', render: (category) => <TableActionButton label={`Edit ${category.name}`} icon={<Edit />} onClick={() => openForm(category)} disabled={!canManage} tooltip={!canManage ? 'Administrator access is required' : 'Edit category'} /> }
    ];
    const filtered = categories.filter((category) => category.name.toLowerCase().includes(query.trim().toLowerCase()));

    if (inline.view) return <Box sx={{ p: { xs: 1, md: 2 } }}>
        <PageHeader title={inline.view === 'edit-category' ? 'Edit Client Category' : 'New Client Category'} inlineNavigation={inline.navigation} />
        {loading ? <Typography role="status">Loading categories…</Typography> : error ? <Alert severity="error" action={<LdButton onClick={loadCategories} loading={loading}>Retry</LdButton>}>{error}</Alert> : inline.view === 'edit-category' && !selected ? <Alert severity="warning">Category not found. Return to Client Categories and select a valid category.</Alert> : !canManage ? <Alert severity="info">Administrator access is required.</Alert> : <Paper variant="outlined" sx={{ borderRadius: 2, maxWidth: 800, mx: 'auto' }}>
            <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit(saveCategory)} sx={{ p: { xs: 1, sm: 2 } }}>
                {saveError && <Alert severity="error">{saveError}</Alert>}
                <RHFTextField name="name" label="Category Name" control={control} required disabled={saving} rules={{ required: 'Category name is required', validate: (value) => Boolean(value.trim()) || 'Category name is required', maxLength: { value: 100, message: 'Use at most 100 characters' } }} inputProps={{ maxLength: 100 }} />
                <RHFTextField name="status" label="Status" control={control} select disabled={saving}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></RHFTextField>
                <FormActions onCancel={closeForm} loading={saving} submitLabel="Save Category" />
            </Stack>
        </Paper>}
    </Box>;

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <PageHeader title="Configuration" description="Manage shared settings used throughout RytClean." />
            <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Configuration sections" variant="scrollable" scrollButtons="auto" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Tab value="client-categories" id="client-categories-tab" aria-controls="client-categories-panel" label="Client Categories" />
                <Tab value="billing" id="billing-settings-tab" aria-controls="billing-settings-panel" label="Billing" />
                <Tab value="sms" id="sms-settings-tab" aria-controls="sms-settings-panel" label="SMS" />
            </Tabs>
            <Box role="tabpanel" id="client-categories-panel" aria-labelledby="client-categories-tab" hidden={tab !== 'client-categories'}>
                <Stack spacing={1} sx={{ mb: 2 }}>
                    <Typography variant="h4" component="h2">Client Categories</Typography>
                    <Typography variant="body2" color="text.secondary">Categories group customers by client type. Inactive categories remain on existing customers but cannot be newly assigned.</Typography>
                </Stack>
                {feedback && <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert>}
                {!canManage && <Alert severity="info" sx={{ mb: 2 }}>Only administrators can add or change client categories.</Alert>}
                <AppTable ariaLabel="Client categories" columns={columns} rows={filtered} loading={loading} error={error} onRetry={loadCategories}
                    emptyTitle={query ? 'No matching categories' : 'No client categories yet'} emptyDescription="Add categories here to make them available on customer forms."
                    toolbar={<TableToolbar title="Client Categories" count={loading ? undefined : filtered.length} searchValue={query} onSearchChange={setQuery} searchLabel="Search categories" actions={<>
                        <LdButton variant="outlined" startIcon={<Refresh />} onClick={loadCategories} loading={loading}>Refresh</LdButton>
                        <LdButton startIcon={<Add />} onClick={() => openForm()} disabled={!canManage || loading || Boolean(error)} tooltip={!canManage ? 'Administrator access is required' : ''}>Add Category</LdButton>
                    </>} />}
                />
            </Box>
            <Box role="tabpanel" id="billing-settings-panel" aria-labelledby="billing-settings-tab" hidden={tab !== 'billing'}>
                {tab === 'billing' && <BillingSettings />}
            </Box>
            <Box role="tabpanel" id="sms-settings-panel" aria-labelledby="sms-settings-tab" hidden={tab !== 'sms'}>
                {tab === 'sms' && <SmsSettings />}
            </Box>
        </Box>
    );
};

export default Configuration;
