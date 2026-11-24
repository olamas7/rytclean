import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Controller, useForm } from 'react-hook-form';
import { Alert, FormControlLabel, MenuItem, Paper, Skeleton, Stack, Switch, Typography } from '@mui/material';
import { getBillingSettings, updateBillingSettings } from 'services/api/billingSettingsService';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { LdButton } from 'utils/myButtons';

const BillingSettings = ({ onPendingChange }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const lock = useRef(false);
    const { control, reset, handleSubmit } = useForm({ defaultValues: { firstMonthPolicy: 'full_month', automaticBilling: false } });
    const canManage = ['Admin', 'Super Admin'].includes(localStorage.getItem('admin_role'));
    const load = useCallback(async () => {
        setLoading(true);
        setReady(false);
        setError('');
        try {
            const response = await getBillingSettings();
            if (response.code !== 1) throw new Error(response.message || 'Unable to load billing settings.');
            reset({ ...response.data, automaticBilling: Boolean(response.data.automaticBilling) });
            setReady(true);
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setLoading(false); }
    }, [reset]);
    useEffect(() => { load(); }, [load]);

    const save = async (values) => {
        if (lock.current || !canManage || !ready || loading) return;
        lock.current = true;
        setSaving(true);
        onPendingChange?.(true);
        setError('');
        setFeedback('');
        try {
            const response = await updateBillingSettings(values);
            if (response.code !== 1) throw new Error(response.message || 'Unable to save billing settings.');
            reset(response.data);
            setFeedback(response.message);
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { lock.current = false; setSaving(false); onPendingChange?.(false); }
    };

    return <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, maxWidth: 800 }}>
        <Stack component="form" noValidate onSubmit={handleSubmit(save)} spacing={2}>
            <Typography component="h2" variant="h4">Subscription Billing</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {feedback && <Alert severity="success">{feedback}</Alert>}
            {loading ? <Skeleton height={100} /> : ready ? <>
                <RHFTextField name="firstMonthPolicy" label="Mid-month registration" control={control} select disabled={!canManage || saving} rules={{ required: 'Choose a first-month billing rule' }}>
                    <MenuItem value="full_month">Charge the full month</MenuItem>
                    <MenuItem value="prorated">Charge only remaining days</MenuItem>
                </RHFTextField>
                <Typography variant="body2" color="text.secondary">Remaining-days billing includes the joined date and uses the actual number of days in that month. Example: GH₵120 × 15 remaining days ÷ 30 days = GH₵60.</Typography>
                <Typography variant="body2" color="text.secondary">Monthly plans are billed at month-end. Plan amount changes apply to a later service cycle, not the cycle already in progress.</Typography>
                <Controller
                    name="automaticBilling"
                    control={control}
                    render={({ field }) => (
                        <FormControlLabel
                            label="Automatically generate completed monthly bills"
                            control={<Switch checked={Boolean(field.value)} onChange={(_, checked) => field.onChange(checked)} disabled={!canManage || saving} />}
                        />
                    )}
                />
                <Alert severity="info">Automatic billing runs while the server is online. Only activated monthly accounts are billed. Existing clients require billing activation; no historical arrears are generated automatically.</Alert>
                <Stack direction="row" spacing={1}>
                    <LdButton type="submit" loading={saving} disabled={!canManage} tooltip={!canManage ? 'Administrator access is required' : ''}>Save Billing Settings</LdButton>
                    <LdButton variant="outlined" onClick={load} disabled={saving}>Reload</LdButton>
                </Stack>
            </> : <LdButton variant="outlined" onClick={load}>Retry Billing Settings</LdButton>}
        </Stack>
    </Paper>;
};

BillingSettings.propTypes = { onPendingChange: PropTypes.func };
export default BillingSettings;
