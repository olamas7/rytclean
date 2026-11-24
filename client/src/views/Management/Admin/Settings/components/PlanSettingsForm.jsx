import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { FormProvider, useForm } from 'react-hook-form';
import { Alert, Box, Grid, MenuItem, Stack, Typography } from '@mui/material';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { FormActions } from 'ui-component/PageLayout';
import { formatCurrency, formatDate } from 'utils/formatters';

const defaults = (plan) => ({
    planCode: plan?.planCode ?? '', name: plan?.name ?? '', billingCycle: plan?.billingCycle ?? 'monthly',
    amount: plan?.nextAmount ?? plan?.amount ?? '', pickupFrequency: plan?.pickupFrequency ?? 1,
    graceDays: plan?.graceDays ?? 0, status: plan?.status ?? 'active'
});
const integerRules = (label, min) => ({ required: `${label} is required`, validate: (value) => value !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= 2147483647 || `Enter a whole number of ${min} or more` });

const PlanSettingsForm = ({ open, initialValues, onSubmit, onCancel, loading, error }) => {
    const methods = useForm({ defaultValues: defaults(initialValues) });
    const { handleSubmit, reset, control } = methods;
    const editing = Boolean(initialValues);
    const cycleLocked = Number(initialValues?.customerCount) > 0;
    useEffect(() => { if (open) reset(defaults(initialValues)); }, [initialValues, open, reset]);

    return <FormProvider {...methods}>
        <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit(onSubmit)} sx={{ p: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {editing && <Box>
                <Typography variant="body2">Current amount: <strong>{formatCurrency(initialValues.amount)}</strong> per {({ monthly: 'month', quarterly: 'quarter', yearly: 'year' })[initialValues.billingCycle]}</Typography>
                {initialValues.nextAmount !== null && initialValues.nextAmount !== undefined && <Typography variant="body2" color="text.secondary">Scheduled: {formatCurrency(initialValues.nextAmount)} from {formatDate(initialValues.nextEffectiveDate)}</Typography>}
            </Box>}
            <Box component="fieldset" disabled={loading} sx={{ border: 0, p: 0, m: 0 }}>
                <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}><RHFTextField name="planCode" label="Plan Code" control={control} required InputProps={{ readOnly: editing }} rules={{ required: 'Plan code is required', maxLength: { value: 60, message: 'Use at most 60 characters' }, pattern: { value: /^[A-Za-z0-9_-]+$/, message: 'Use letters, numbers, hyphens or underscores' } }} /></Grid>
                    <Grid item xs={12} sm={6}><RHFTextField name="name" label="Plan Name" control={control} required rules={{ required: 'Plan name is required', validate: (value) => Boolean(value.trim()) || 'Plan name is required', maxLength: { value: 150, message: 'Use at most 150 characters' } }} /></Grid>
                    <Grid item xs={12} sm={6}><RHFTextField name="billingCycle" label="Billing Cycle" control={control} select disabled={cycleLocked} helperText={cycleLocked ? 'Assigned plans keep their billing cycle.' : undefined}>
                        <MenuItem value="monthly">Monthly</MenuItem><MenuItem value="quarterly">Quarterly</MenuItem><MenuItem value="yearly">Yearly</MenuItem>
                    </RHFTextField></Grid>
                    <Grid item xs={12} sm={6}><RHFTextField name="amount" label={editing ? 'Next-Cycle Amount (GHS)' : 'Amount per Cycle (GHS)'} type="number" control={control} required inputProps={{ min: 0, step: '0.01', max: 99999999.99 }} rules={{ required: 'Amount is required', validate: (value) => /^\d+(\.\d{1,2})?$/.test(String(value)) && Number(value) <= 99999999.99 || 'Enter an amount with up to two decimal places' }} /></Grid>
                    <Grid item xs={12} sm={6}><RHFTextField name="pickupFrequency" label="Pickups per Week" type="number" control={control} required inputProps={{ min: 1, step: 1 }} rules={integerRules('Pickups per week', 1)} /></Grid>
                    <Grid item xs={12} sm={6}><RHFTextField name="graceDays" label="Payment Grace Days" type="number" control={control} required inputProps={{ min: 0, step: 1 }} rules={integerRules('Grace days', 0)} /></Grid>
                    <Grid item xs={12}><RHFTextField name="status" label="Status" control={control} select><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></RHFTextField></Grid>
                </Grid>
            </Box>
            {editing && <Typography variant="caption" color="text.secondary">Price changes start next month and apply when a new service cycle starts. The current cycle is unchanged. Enter the current amount to cancel a pending price change.</Typography>}
            <FormActions onCancel={onCancel} loading={loading} submitLabel={editing ? 'Update Plan' : 'Create Plan'} />
        </Stack>
    </FormProvider>;
};

PlanSettingsForm.propTypes = { open: PropTypes.bool, initialValues: PropTypes.object, onSubmit: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired, loading: PropTypes.bool, error: PropTypes.string };
export default PlanSettingsForm;
