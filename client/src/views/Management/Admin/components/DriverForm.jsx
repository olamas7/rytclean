import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { FormProvider, useForm } from 'react-hook-form';
import { Grid, MenuItem, Stack } from '@mui/material';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { LdButton } from 'utils/myButtons';

const defaultValues = {
    driverCode: '',
    fullName: '',
    phone: '',
    vehicleNumber: '',
    zoneId: '',
    status: 'available'
};

const DriverForm = ({ zones, onSubmit, loading, onCancel, open }) => {
    const methods = useForm({ defaultValues });
    const { handleSubmit, reset, control } = methods;

    useEffect(() => {
        if (open) {
            reset(defaultValues);
        }
    }, [open, reset]);

    return (
        <FormProvider {...methods}>
            <Stack component="form" spacing={1.25} onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={1.25}>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="driverCode" label="Driver Code" control={control} rules={{ required: 'Driver code is required' }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="fullName" label="Full Name" control={control} rules={{ required: 'Driver name is required' }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="phone" label="Phone" control={control} rules={{ required: 'Phone is required' }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField
                            name="vehicleNumber"
                            label="Vehicle Number"
                            control={control}
                            rules={{ required: 'Vehicle number is required' }}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="zoneId" label="Zone" control={control} rules={{ required: 'Zone is required' }} select>
                            {zones.map((zone) => (
                                <MenuItem key={zone.id} value={zone.id}>
                                    {zone.zone_code} - {zone.name}
                                </MenuItem>
                            ))}
                        </RHFTextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="status" label="Status" control={control} select>
                            <MenuItem value="available">Available</MenuItem>
                            <MenuItem value="on-route">On Route</MenuItem>
                            <MenuItem value="off-duty">Off Duty</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                        </RHFTextField>
                    </Grid>
                </Grid>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <LdButton variant="outlined" color="secondary" onClick={onCancel}>
                        Cancel
                    </LdButton>
                    <LdButton type="submit" loading={loading}>
                        Save Driver
                    </LdButton>
                </Stack>
            </Stack>
        </FormProvider>
    );
};

DriverForm.propTypes = {
    zones: PropTypes.array.isRequired,
    onSubmit: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    open: PropTypes.bool
};

export default DriverForm;
