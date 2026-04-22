import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { FormProvider, useForm } from 'react-hook-form';
import { Grid, MenuItem, Stack } from '@mui/material';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { LdButton } from 'utils/myButtons';

const defaultValues = {
    fullname: '',
    username: '',
    password: '',
    workTitle: 'driver',
    status: 1,
    driverCode: '',
    phone: '',
    vehicleNumber: '',
    zoneId: '',
    driverStatus: 'available'
};

const UserForm = ({ zones, onSubmit, loading, onCancel, open }) => {
    const methods = useForm({ defaultValues });
    const { handleSubmit, reset, control, watch } = methods;

    const workTitle = watch('workTitle');

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
                        <RHFTextField name="fullname" label="Full Name" control={control} rules={{ required: 'Full name is required' }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="username" label="Username" control={control} rules={{ required: 'Username is required' }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="password" label="Password" type="password" control={control} rules={{ required: 'Password is required' }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="workTitle" label="Work Title" control={control} select rules={{ required: 'Work title is required' }}>
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="driver">Driver</MenuItem>
                            <MenuItem value="supervisor">Supervisor</MenuItem>
                            <MenuItem value="accountant">Accountant</MenuItem>
                            <MenuItem value="support">Support</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                        </RHFTextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="status" label="User Status" control={control} select>
                            <MenuItem value={1}>Active</MenuItem>
                            <MenuItem value={0}>Inactive</MenuItem>
                        </RHFTextField>
                    </Grid>

                    {workTitle === 'driver' && (
                        <>
                            <Grid item xs={12} md={6}>
                                <RHFTextField
                                    name="driverCode"
                                    label="Driver Code"
                                    control={control}
                                    rules={{ required: 'Driver code is required for driver users' }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <RHFTextField
                                    name="phone"
                                    label="Phone"
                                    control={control}
                                    rules={{ required: 'Phone is required for driver users' }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <RHFTextField
                                    name="vehicleNumber"
                                    label="Vehicle Number"
                                    control={control}
                                    rules={{ required: 'Vehicle number is required for driver users' }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <RHFTextField name="zoneId" label="Zone" control={control} select rules={{ required: 'Zone is required for driver users' }}>
                                    {zones.map((zone) => (
                                        <MenuItem key={zone.id} value={zone.id}>
                                            {zone.zone_code} - {zone.name}
                                        </MenuItem>
                                    ))}
                                </RHFTextField>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <RHFTextField name="driverStatus" label="Driver Status" control={control} select>
                                    <MenuItem value="available">Available</MenuItem>
                                    <MenuItem value="on-route">On Route</MenuItem>
                                    <MenuItem value="off-duty">Off Duty</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                </RHFTextField>
                            </Grid>
                        </>
                    )}
                </Grid>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <LdButton variant="outlined" color="secondary" onClick={onCancel}>
                        Cancel
                    </LdButton>
                    <LdButton type="submit" loading={loading}>
                        Save User
                    </LdButton>
                </Stack>
            </Stack>
        </FormProvider>
    );
};

UserForm.propTypes = {
    zones: PropTypes.array.isRequired,
    onSubmit: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    open: PropTypes.bool
};

export default UserForm;
