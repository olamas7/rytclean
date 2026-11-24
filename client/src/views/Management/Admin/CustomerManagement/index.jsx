import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountBalanceWallet, Add, Edit, PhotoCamera, Place, Public, Refresh } from '@mui/icons-material';
import { Alert, Box, Paper, Skeleton, Stack, Typography } from '@mui/material';
import useInlineNavigation from 'utils/useInlineNavigation';
import { createCustomer, getCustomers, updateCustomer } from 'services/api/customersService';
import { getClientCategories } from 'services/api/clientCategoriesService';
import { getPlans } from 'services/api/plansService';
import { getZones } from 'services/api/zonesRoutesService';
import StatusBadge from 'ui-component/StatusBadge';
import { PageHeader } from 'ui-component/PageLayout';
import { AppTable, TableActionButton, TableFilter, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { FullscreenDialog, MediumDialog } from 'utils/dialogs';
import { formatDate } from 'utils/formatters';
import { LdButton } from 'utils/myButtons';
import CustomerForm from './components/CustomerForm';
import CustomerLocationsMap from './components/CustomerLocationsMap';
import CustomerLocationPreviewMap from './components/CustomerLocationPreviewMap';
import HousePhotoPreview from './components/HousePhotoPreview';
import CustomerAccount from 'views/Management/Accountant/CustomerAccount';

const hasLocation = (customer) => [customer.latitude, customer.longitude].every((value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)));
const apiMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const sections = { new: { label: 'New Customer' }, edit: { label: 'Edit Customer' }, account: { label: 'Customer Account' } };

const CustomerManagement = () => {
    const [customers, setCustomers] = useState([]);
    const [zones, setZones] = useState([]);
    const [plans, setPlans] = useState([]);
    const [categories, setCategories] = useState([]);
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState({ status: 'all', zone: 'all', plan: 'all', category: 'all' });
    const [saving, setSaving] = useState(false);
    const inline = useInlineNavigation({ sections, rootLabel: 'Customers', contextKeys: ['customer'], blocked: saving });
    const searchParams = inline.params;
    const formMode = searchParams.get('view') === 'edit' ? 'edit' : 'create';
    const formOpen = ['new', 'edit'].includes(searchParams.get('view'));
    const selectedCustomer = formMode === 'edit' ? customers.find((customer) => customer.id === searchParams.get('customer')) || null : null;
    const formPanel = useRef(null);
    const [mapPreviewCustomer, setMapPreviewCustomer] = useState(null);
    const [photoCustomer, setPhotoCustomer] = useState(null);
    const [allMapOpen, setAllMapOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const savingRef = useRef(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [feedback, setFeedback] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const responses = await Promise.all([getCustomers(), getZones(), getPlans(), getClientCategories()]);
            const failed = responses.find((response) => response.code !== 1);
            if (failed) throw new Error(failed.message || 'Unable to load customer data.');
            setCustomers(responses[0].data);
            setZones(responses[1].data);
            setPlans(responses[2].data);
            setCategories(responses[3].data);
        } catch (err) {
            setError(apiMessage(err, 'Unable to load customer data.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => {
        if (formOpen) {
            formPanel.current?.focus({ preventScroll: true });
            formPanel.current?.scrollIntoView({ block: 'start' });
        }
    }, [formOpen, formMode]);

    const zoneOptions = zones.filter((zone) => zone.status === 'active').map((zone) => ({ value: zone.zone_code, label: zone.name }));
    const planOptions = plans.filter((plan) => plan.status === 'active').map((plan) => ({ value: plan.planCode, label: plan.name }));
    const categoryOptions = categories.filter((category) => category.status === 'active').map((category) => ({ value: String(category.id), label: category.name }));
    const missingOptions = !zoneOptions.length || !planOptions.length || !categoryOptions.length;

    const filtered = useMemo(() => {
        const search = query.trim().toLowerCase();
        return customers.filter((customer) =>
            (filters.status === 'all' || customer.status === filters.status)
            && (filters.zone === 'all' || customer.zoneId === filters.zone)
            && (filters.plan === 'all' || customer.planId === filters.plan)
            && (filters.category === 'all' || String(customer.categoryId) === filters.category)
            && (!search || [customer.fullName, customer.phone, customer.email, customer.id, customer.locationDescription, customer.locationAddress]
                .some((value) => String(value || '').toLowerCase().includes(search)))
        );
    }, [customers, query, filters]);
    const customersWithLocation = customers.filter(hasLocation);
    const openForm = (customer = null) => {
        setFormError('');
        setFeedback(null);
        inline.open(customer ? 'edit' : 'new', customer ? { customer: customer.id } : {});
    };
    const showList = inline.close;
    const closeForm = () => { if (!savingRef.current) showList(); };

    const handleSubmitCustomer = async (values) => {
        if (savingRef.current || (formMode === 'edit' && !selectedCustomer)) return;
        savingRef.current = true;
        setSaving(true);
        setFormError('');
        const { location, ...details } = values;
        try {
            const payload = { ...details, latitude: location.latitude, longitude: location.longitude, locationAddress: location.locationAddress || '' };
            const response = selectedCustomer ? await updateCustomer(selectedCustomer.id, payload) : await createCustomer(payload);
            if (response.code !== 1) throw new Error(response.message || 'Unable to save customer.');
            // Close after a confirmed save; refresh failure must not encourage duplicate creation.
            showList();
            setFeedback({ type: 'success', message: response.message || 'Customer saved successfully.' });
            await loadData();
        } catch (err) {
            setFormError(apiMessage(err, 'Unable to save customer. Your changes have been kept.'));
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const columns = [
        { id: 'fullName', label: 'Customer', sortable: true, render: (customer) => <TablePrimaryText fontSize={14} primary={customer.fullName?.toUpperCase()} secondary={customer.id} /> },
        { id: 'phone', label: 'Contact', sortable: true, render: (customer) => <TablePrimaryText fontSize={14} primary={customer.phone} secondary={customer.email} /> },
        { id: 'categoryName', label: 'Category / Zone', sortable: true, render: (customer) => <TablePrimaryText fontSize={14} primary={customer.categoryName || 'Not assigned'} secondary={customer.zoneName || customer.zoneId} /> },
        { id: 'planName', label: 'Plan / Joined', sortable: true, render: (customer) => <TablePrimaryText fontSize={14} primary={customer.planName || customer.planId} secondary={<>
            Joined {formatDate(customer.joinedDate)}
            {customer.pendingPlanId && <><br />Next: {customer.pendingPlanName || customer.pendingPlanId} · {formatDate(customer.pendingPlanDate)}</>}
        </>} /> },
        { id: 'locationAddress', label: 'Location', render: (customer) => <Box sx={{ minWidth: 160, maxWidth: 260 }}><Typography variant="body2">{customer.locationAddress || customer.address || (hasLocation(customer) ? 'Map pin saved' : 'Not set')}</Typography>{customer.locationDescription && <Typography variant="caption" color="text.secondary">{customer.locationDescription}</Typography>}</Box> },
        { id: 'status', label: 'Status', sortable: true, render: (customer) => <StatusBadge label={customer.status} size="medium" /> },
        { id: 'actions', label: 'Actions', align: 'right', render: (customer) => <Stack direction="row" spacing={1} justifyContent="flex-end">
            <TableActionButton label={`Open account for ${customer.fullName}`} icon={<AccountBalanceWallet />} disabled={!['Admin', 'Super Admin', 'Manager', 'Accountant'].includes(localStorage.getItem('admin_role'))} tooltip="Account statement and payments" onClick={() => inline.open('account', { customer: customer.id })} />
            <TableActionButton label={`View house photo for ${customer.fullName}`} icon={<PhotoCamera />} disabled={!customer.hasHousePhoto} tooltip={customer.hasHousePhoto ? 'View house / frontage photo' : 'No house photo attached'} onClick={() => setPhotoCustomer(customer)} />
            <TableActionButton label={`View location for ${customer.fullName}`} icon={<Place />} disabled={!hasLocation(customer)} tooltip={!hasLocation(customer) ? 'No map location saved for this customer' : 'View customer location'} onClick={() => setMapPreviewCustomer(customer)} />
            <TableActionButton label={`Edit ${customer.fullName}`} icon={<Edit />} tooltip="Edit customer" onClick={() => openForm(customer)} />
        </Stack> }
    ];

    const filterSelect = (name, label, options) => (
        <TableFilter key={name} label={label} allLabel={name === 'status' ? 'All statuses' : undefined} value={filters[name]} onChange={(value) => setFilters((prev) => ({ ...prev, [name]: value }))} options={options} />
    );

    if (searchParams.get('view') === 'account' && searchParams.get('customer')) return <CustomerAccount key={searchParams.get('customer')} customerId={searchParams.get('customer')} onBack={showList} backLabel="Customers" />;

    if (formOpen) return (
        <Box ref={formPanel} tabIndex={-1} sx={{ p: { xs: 1, md: 2 }, outline: 'none' }}>
            <PageHeader title={formMode === 'edit' ? 'Edit Customer' : 'New Customer'} inlineNavigation={inline.navigation} />
            {error && <Stack spacing={1} sx={{ mb: 2 }}><Alert severity="error">{error}</Alert><LdButton variant="outlined" onClick={loadData} loading={loading}>Retry</LdButton></Stack>}
            <Paper variant="outlined" sx={{ borderRadius: 2, p: { xs: 1, md: 2 }, maxWidth: 1100, mx: 'auto' }}>
                {loading ? <Skeleton variant="rounded" height={400} aria-label="Loading customer form" /> : !error && (formMode === 'create' || selectedCustomer) ? (
                    <CustomerForm key={selectedCustomer?.id || 'new'} open onSubmit={handleSubmitCustomer} onCancel={closeForm} loading={saving} mode={formMode} initialValues={selectedCustomer} zoneOptions={zoneOptions} planOptions={planOptions} categoryOptions={categoryOptions} error={formError} />
                ) : !error ? <Alert severity="warning">Customer not found. Return to the customer list and choose a valid customer.</Alert> : null}
            </Paper>
        </Box>
    );

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <PageHeader title="Customer Management" description="Manage customer details, categories and pickup locations." actions={<>
                <LdButton startIcon={<Add />} onClick={() => openForm()} disabled={loading || Boolean(error) || missingOptions} tooltip={missingOptions && !loading ? 'An active zone, plan and client category are required' : ''}>Add Customer</LdButton>
                <LdButton variant="outlined" startIcon={<Public />} onClick={() => setAllMapOpen(true)} disabled={loading || Boolean(error) || !customersWithLocation.length} tooltip="Search and filter customer locations on the map">View on Map</LdButton>
                <LdButton variant="outlined" startIcon={<Refresh />} onClick={loadData} loading={loading}>Refresh</LdButton>
            </>} />
            {feedback && <Alert severity={feedback.type} sx={{ mb: 2 }}>{feedback.message}</Alert>}
            {!loading && !error && missingOptions && <Alert severity="warning" sx={{ mb: 2 }}>Create at least one active zone, plan and client category before adding a customer. Categories are managed under Admin → Configuration.</Alert>}
            <AppTable columns={columns} rows={filtered} ariaLabel="Customers" loading={loading} error={error} onRetry={loadData} minWidth={980} fontSize={14}
                emptyTitle={customers.length ? 'No matching customers' : 'No customers yet'} emptyDescription={customers.length ? 'Try changing your search or filters.' : 'Add your first customer to get started.'}
                toolbar={<TableToolbar title="Customers" count={loading ? undefined : filtered.length} searchValue={query} onSearchChange={setQuery} searchLabel="Search customers" filters={<>
                    {filterSelect('status', 'Status', [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }])}
                    {filterSelect('category', 'Categories', categories.map((item) => ({ value: String(item.id), label: item.name })))}
                    {filterSelect('zone', 'Zones', zones.map((item) => ({ value: item.zone_code, label: item.name })))}
                    {filterSelect('plan', 'Plans', plans.map((item) => ({ value: item.planCode, label: item.name })))}
                </>} actions={<LdButton variant="text" onClick={() => { setQuery(''); setFilters({ status: 'all', zone: 'all', plan: 'all', category: 'all' }); }}>Reset</LdButton>} />}
            />
            <MediumDialog open={Boolean(mapPreviewCustomer)} onClose={() => setMapPreviewCustomer(null)} title="Customer Location">
                {mapPreviewCustomer && <Stack spacing={1} sx={{ p: 1 }}>
                    <Typography variant="h4">{mapPreviewCustomer.fullName?.toUpperCase()}</Typography>
                    <Typography variant="body2">{mapPreviewCustomer.locationAddress || mapPreviewCustomer.address || 'Saved map pin'}</Typography>
                    {mapPreviewCustomer.locationDescription && <Typography variant="body2" color="text.secondary">{mapPreviewCustomer.locationDescription}</Typography>}
                    <CustomerLocationPreviewMap latitude={mapPreviewCustomer.latitude} longitude={mapPreviewCustomer.longitude} label={mapPreviewCustomer.locationAddress || mapPreviewCustomer.fullName} />
                    {Boolean(mapPreviewCustomer.hasHousePhoto) && <>
                        <Typography variant="h4" component="h2">House / Frontage Photo</Typography>
                        <HousePhotoPreview customerId={mapPreviewCustomer.id} hasPhoto={mapPreviewCustomer.hasHousePhoto} name={mapPreviewCustomer.fullName} version={mapPreviewCustomer.updated_at} />
                    </>}
                </Stack>}
            </MediumDialog>
            <MediumDialog open={Boolean(photoCustomer)} onClose={() => setPhotoCustomer(null)} title="House / Frontage Photo">
                {photoCustomer && <Stack spacing={1.5} sx={{ p: 1 }}>
                    <Typography variant="h4">{photoCustomer.fullName?.toUpperCase()} · {photoCustomer.id}</Typography>
                    <Typography variant="body2" color="text.secondary">{photoCustomer.locationDescription || photoCustomer.locationAddress || photoCustomer.address}</Typography>
                    <HousePhotoPreview customerId={photoCustomer.id} hasPhoto={photoCustomer.hasHousePhoto} name={photoCustomer.fullName} height="min(65vh, 560px)" version={photoCustomer.updated_at} />
                </Stack>}
            </MediumDialog>
            <FullscreenDialog open={allMapOpen} onClose={() => setAllMapOpen(false)} title="Customer Locations">
                {allMapOpen && <CustomerLocationsMap customers={customers} initialFilters={filters} initialQuery={query}
                    zoneOptions={zones.map((item) => ({ value: item.zone_code, label: item.name }))}
                    planOptions={plans.map((item) => ({ value: item.planCode, label: item.name }))}
                    categoryOptions={categories.map((item) => ({ value: String(item.id), label: item.name }))} />}
            </FullscreenDialog>
        </Box>
    );
};

export default CustomerManagement;
