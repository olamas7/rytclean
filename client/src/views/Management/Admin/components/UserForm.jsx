import { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FormProvider, useForm } from 'react-hook-form';
import { Grid, MenuItem, Stack } from '@mui/material';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { LdButton } from 'utils/myButtons';

const UserForm = ({ initialValues, mode, onSubmit, loading, onCancel, open }) => {
    const defaultValues = useMemo(
        () => ({
            fullname: initialValues?.fullname || '',
            username: initialValues?.username || '',
            password: '',
            workTitle: initialValues?.workTitle === 'supervisor' ? 'driver' : initialValues?.workTitle || 'driver',
            status: initialValues?.status ?? 1
        }),
        [initialValues]
    );

    const methods = useForm({ defaultValues });
    const { handleSubmit, reset, control } = methods;

    useEffect(() => {
        if (open) {
            reset(defaultValues);
        }
    }, [open, reset, defaultValues]);

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
                    {mode === 'create' && (
                        <Grid item xs={12} md={6}>
                            <RHFTextField name="password" label="Password" type="password" control={control} rules={{ required: 'Password is required' }} />
                        </Grid>
                    )}
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="workTitle" label="Work Title" control={control} select rules={{ required: 'Work title is required' }}>
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="driver">Driver</MenuItem>
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
                </Grid>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <LdButton variant="outlined" color="secondary" onClick={onCancel} disabled={loading}>
                        Cancel
                    </LdButton>
                    <LdButton type="submit" loading={loading}>
                        {mode === 'edit' ? 'Update User' : 'Save User'}
                    </LdButton>
                </Stack>
            </Stack>
        </FormProvider>
    );
};

UserForm.propTypes = {
    initialValues: PropTypes.object,
    mode: PropTypes.oneOf(['create', 'edit']).isRequired,
    onSubmit: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    open: PropTypes.bool
};

export default UserForm;
