import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { AddLocationAlt, EditLocationAlt } from '@mui/icons-material';
import { Alert, Box, Grid, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { LdButton } from 'utils/myButtons';
import { FormActions } from 'ui-component/PageLayout';
import CustomerLocationMapField from './CustomerLocationMapField';
import HousePhotoField from './HousePhotoField';

const today = () => new Date().toISOString().slice(0, 10);
const initialForm = (customer) => ({
    fullName: (customer?.fullName || '').toUpperCase(),
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    zoneId: customer?.zoneId || '',
    planId: customer?.pendingPlanId || customer?.planId || '',
    categoryId: customer?.categoryId ? String(customer.categoryId) : '',
    joinedDate: customer?.joinedDate || today(),
    locationDescription: customer?.locationDescription || '',
    housePhoto: { file: null, remove: false },
    location: {
        latitude: customer?.latitude ?? '',
        longitude: customer?.longitude ?? '',
        locationAddress: customer?.locationAddress || ''
    },
    status: customer?.status || 'active'
});
const hasCoordinate = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
const requiredText = (label, max) => ({
    required: `${label} is required`,
    validate: (value) => Boolean(value.trim()) || `${label} is required`,
    maxLength: { value: max, message: `Use at most ${max} characters` }
});

const CustomerForm = ({ open, onSubmit, onCancel, loading, zoneOptions = [], planOptions = [], categoryOptions = [], initialValues = null, mode = 'create', error }) => {
    const [locationOpen, setLocationOpen] = useState(false);
    const [gpsPending, setGpsPending] = useState(false);
    const [photoPending, setPhotoPending] = useState(false);
    const methods = useForm({ defaultValues: initialForm(initialValues) });
    const { handleSubmit, reset, control, formState: { errors }, watch } = methods;
    const selectedLocation = watch('location');

    useEffect(() => {
        if (open) {
            reset(initialForm(initialValues));
            setLocationOpen(false);
            setGpsPending(false);
            setPhotoPending(false);
        }
    }, [open, initialValues, reset]);

    const hasLocation = hasCoordinate(selectedLocation?.latitude) && hasCoordinate(selectedLocation?.longitude);
    // Retain an existing inactive/legacy option without allowing it for new assignments.
    const optionsWithCurrent = (options, value, label) => value && !options.some((option) => String(option.value) === String(value))
        ? [{ value: String(value), label: `${label || value} (current)`, disabled: true }, ...options] : options;
    const zones = optionsWithCurrent(zoneOptions, initialValues?.zoneId, initialValues?.zoneName);
    const plans = optionsWithCurrent(optionsWithCurrent(planOptions, initialValues?.planId, initialValues?.planName), initialValues?.pendingPlanId, initialValues?.pendingPlanName);
    const categories = optionsWithCurrent(categoryOptions, initialValues?.categoryId, initialValues?.categoryName);

    return (
        <FormProvider {...methods}>
            <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit((values) => { if (!gpsPending && !photoPending) return onSubmit(values); })} sx={{ p: { xs: 1, sm: 2 } }}>
                {error && <Alert severity="error">{error}</Alert>}
                <Box component="fieldset" disabled={loading} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
                    <Grid container spacing={1.5}>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth size="small" margin="normal" label="Customer ID" value={mode === 'edit' ? initialValues?.id || '' : 'Auto-generated'} InputProps={{ readOnly: true }} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RHFTextField name="fullName" label="Full Name" control={control} required rules={requiredText('Full name', 150)} autoComplete="name" autoCapitalize="characters" transformValue={(value) => value.toUpperCase()} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RHFTextField name="email" label="Email (optional)" type="email" control={control} autoComplete="email" rules={{ maxLength: { value: 150, message: 'Use at most 150 characters' }, validate: (value) => !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Enter a valid email address' }} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RHFTextField name="phone" label="Phone" type="tel" control={control} required autoComplete="tel" inputProps={{ inputMode: 'numeric', maxLength: 10, pattern: '[0-9]{10}' }} transformValue={(value) => value.replace(/\D/g, '').slice(0, 10)} rules={{ required: 'Phone is required', pattern: { value: /^\d{10}$/, message: 'Phone number must be exactly 10 digits' } }} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RHFTextField name="categoryId" label="Client Category" control={control} required select rules={{ required: 'Select a client category' }}>
                                {categories.map((option) => <MenuItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</MenuItem>)}
                            </RHFTextField>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RHFTextField name="joinedDate" label="Joined Date" type="date" control={control} required InputLabelProps={{ shrink: true }} InputProps={{ readOnly: initialValues?.billingStatus === 'active' || Boolean(initialValues?.hasAccountEntries) }} rules={{ required: 'Joined date is required', validate: (value) => {
                                const date = new Date(`${value}T00:00:00Z`);
                                return (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) || 'Enter a valid joined date';
                            } }} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RHFTextField name="zoneId" label="Zone" control={control} required select rules={{ required: 'Select a zone' }}>
                                {zones.map((option) => <MenuItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</MenuItem>)}
                            </RHFTextField>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RHFTextField name="planId" label={mode === 'edit' ? 'Next Plan' : 'Plan'} control={control} required select helperText={mode === 'edit' ? `Current: ${initialValues?.planName || initialValues?.planId}. Changes start next month.` : undefined} rules={{ required: 'Select a plan' }}>
                                {plans.map((option) => <MenuItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</MenuItem>)}
                            </RHFTextField>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RHFTextField name="status" label="Status" control={control} select>
                                <MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem>
                            </RHFTextField>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RHFTextField name="address" label="Address (optional)" control={control} autoComplete="street-address" rules={{ maxLength: { value: 255, message: 'Use at most 255 characters' } }} />
                        </Grid>
                        <Grid item xs={12}>
                            <RHFTextField name="locationDescription" label="Location Description (optional)" control={control} multiline minRows={2} rules={{ maxLength: { value: 500, message: 'Use at most 500 characters' } }} inputProps={{ maxLength: 500 }} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Controller name="housePhoto" control={control} render={({ field }) => <HousePhotoField value={field.value} onChange={field.onChange} customer={initialValues} disabled={loading} onBusyChange={setPhotoPending} />} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Stack spacing={1}>
                                <LdButton variant="outlined" startIcon={hasLocation ? <EditLocationAlt /> : <AddLocationAlt />} onClick={() => setLocationOpen((prev) => !prev)} sx={{ alignSelf: 'flex-start' }} aria-expanded={locationOpen} aria-controls="customer-location-picker">
                                    {hasLocation ? 'Change Location' : 'Add Location'}
                                </LdButton>
                                <Typography variant="caption" color={hasLocation ? 'success.main' : 'text.secondary'}>
                                    {hasLocation ? selectedLocation.locationAddress || 'Location selected' : 'Location not selected'}
                                </Typography>
                                {errors.location?.message && <Typography role="alert" variant="caption" color="error.main">{errors.location.message}</Typography>}
                            </Stack>
                        </Grid>
                        <Controller name="location" control={control} rules={{ validate: (value) => {
                            if (!hasCoordinate(value?.latitude) || !hasCoordinate(value?.longitude)) return 'Customer location is required';
                            return (Math.abs(Number(value.latitude)) <= 90 && Math.abs(Number(value.longitude)) <= 180) || 'Customer coordinates are invalid';
                        } }} render={({ field }) => locationOpen ? (
                            <Grid item xs={12}>
                                <Paper id="customer-location-picker" variant="outlined" sx={{ p: 1.5 }}><CustomerLocationMapField value={field.value} onChange={field.onChange} onLocatingChange={setGpsPending} /></Paper>
                            </Grid>
                        ) : null} />
                    </Grid>
                </Box>
                <FormActions onCancel={onCancel} loading={loading} disabled={gpsPending || photoPending} submitLabel={mode === 'edit' ? 'Update Customer' : 'Save Customer'} />
            </Stack>
        </FormProvider>
    );
};

CustomerForm.propTypes = {
    open: PropTypes.bool,
    onSubmit: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    mode: PropTypes.oneOf(['create', 'edit']),
    initialValues: PropTypes.object,
    zoneOptions: PropTypes.array,
    planOptions: PropTypes.array,
    categoryOptions: PropTypes.array,
    error: PropTypes.string
};

export default CustomerForm;
