import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { FormProvider, useForm } from 'react-hook-form';
import { Grid, MenuItem, Stack } from '@mui/material';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { LdButton } from 'utils/myButtons';

const defaultValues = {
    userId: '',
    driverCode: '',
    phone: '',
    vehicleNumber: '',
    zoneId: '',
    status: 'available'
};

const DriverForm = ({ driverUsers, zones, onSubmit, loading, onCancel, open, initialValues }) => {
    const methods = useForm({ defaultValues });
    const { handleSubmit, reset, control } = methods;

    useEffect(() => {
        if (open) {
            reset(initialValues ? { userId: initialValues.userId, driverCode: initialValues.id, phone: initialValues.phone, zoneId: initialValues.zoneId, status: initialValues.status } : defaultValues);
        }
    }, [open, reset, initialValues]);

    return (
        <FormProvider {...methods}>
            <Stack component="form" spacing={1.25} onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={1.25}>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="userId" label="Driver User" control={control} rules={{ required: 'Driver user is required' }} select disabled={Boolean(initialValues) || loading}>
                            {driverUsers.length > 0 ? (
                                driverUsers.map((user) => (
                                    <MenuItem key={user.id} value={user.id}>
                                        {user.fullname} ({user.username})
                                    </MenuItem>
                                ))
                            ) : (
                                <MenuItem value="" disabled>
                                    No available driver users
                                </MenuItem>
                            )}
                        </RHFTextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="driverCode" label="Driver Code" control={control} InputProps={{ readOnly: Boolean(initialValues) }} disabled={loading} inputProps={{ maxLength: 40 }} rules={{ required: 'Driver code is required' }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="phone" label="Phone" control={control} disabled={loading} transformValue={(value) => value.replace(/\D/g, '').slice(0, 10)} inputProps={{ inputMode: 'numeric', maxLength: 10 }} rules={{ required: 'Phone is required', pattern: { value: /^\d{10}$/, message: 'Enter exactly ten digits' } }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="zoneId" label="Zone" control={control} rules={{ required: 'Zone is required' }} select disabled={loading}>
                            {zones.map((zone) => (
                                <MenuItem key={zone.id} value={zone.id}>
                                    {zone.zone_code} - {zone.name}
                                </MenuItem>
                            ))}
                        </RHFTextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="status" label="Status" control={control} select disabled={loading}>
                            {initialValues?.status === 'on-route' && <MenuItem value="on-route" disabled>Legacy on-route (review before changing)</MenuItem>}
                            <MenuItem value="available">Available</MenuItem>
                            <MenuItem value="off-duty">Off Duty</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                        </RHFTextField>
                    </Grid>
                </Grid>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <LdButton variant="outlined" color="secondary" onClick={onCancel} disabled={loading}>
                        Cancel
                    </LdButton>
                    <LdButton type="submit" loading={loading} disabled={driverUsers.length === 0}>
                        Save Driver
                    </LdButton>
                </Stack>
            </Stack>
        </FormProvider>
    );
};

DriverForm.propTypes = {
    driverUsers: PropTypes.array.isRequired,
    zones: PropTypes.array.isRequired,
    onSubmit: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    open: PropTypes.bool,
    initialValues: PropTypes.object
};

export default DriverForm;
