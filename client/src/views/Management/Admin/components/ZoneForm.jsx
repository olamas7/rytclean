import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { MenuItem, Stack, Typography } from '@mui/material';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { LdButton } from 'utils/myButtons';
import ZoneBoundaryMapField from './ZoneBoundaryMapField';

const defaultValues = {
    zoneCode: '',
    name: '',
    city: '',
    coverageArea: '',
    status: 'active',
    boundaryGeoJson: null
};

const ZoneForm = ({ onSubmit, loading, onCancel, open }) => {
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
                <RHFTextField name="zoneCode" label="Zone Code" control={control} rules={{ required: 'Zone code is required' }} />
                <RHFTextField name="name" label="Zone Name" control={control} rules={{ required: 'Zone name is required' }} />
                <RHFTextField name="city" label="City" control={control} rules={{ required: 'City is required' }} />
                <RHFTextField name="coverageArea" label="Coverage Area" control={control} />
                <RHFTextField name="status" label="Status" control={control} select>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                </RHFTextField>
                <Controller
                    name="boundaryGeoJson"
                    control={control}
                    rules={{
                        validate: (value) => {
                            if (!value || value.type !== 'Polygon' || !value.coordinates || !value.coordinates[0]) {
                                return 'Boundary polygon is required';
                            }
                            const points = value.coordinates[0] || [];
                            if (points.length < 4) {
                                return 'Boundary needs at least 3 points';
                            }
                            return true;
                        }
                    }}
                    render={({ field, fieldState }) => (
                        <>
                            <ZoneBoundaryMapField value={field.value} onChange={field.onChange} />
                            {fieldState.error && (
                                <Typography variant="caption" color="error.main" sx={{ mt: -0.5 }}>
                                    {fieldState.error.message}
                                </Typography>
                            )}
                        </>
                    )}
                />
                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 0.5 }}>
                    <LdButton variant="outlined" color="secondary" onClick={onCancel}>
                        Cancel
                    </LdButton>
                    <LdButton type="submit" loading={loading}>
                        Save Zone
                    </LdButton>
                </Stack>
            </Stack>
        </FormProvider>
    );
};

ZoneForm.propTypes = {
    onSubmit: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    open: PropTypes.bool
};

export default ZoneForm;
