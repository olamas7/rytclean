import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { Grid, MenuItem, Stack, Typography } from '@mui/material';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { LdButton } from 'utils/myButtons';
import RoutePathMapField from './RoutePathMapField';

const defaultValues = {
    routeCode: '',
    routeName: '',
    zoneId: '',
    startPoint: '',
    endPoint: '',
    estimatedDurationMins: '',
    status: 'active',
    notes: '',
    routeGeoJson: null
};

const RouteForm = ({ zones, onSubmit, loading, onCancel, open }) => {
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
                        <RHFTextField name="routeCode" label="Route Code" control={control} rules={{ required: 'Route code is required' }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="routeName" label="Route Name" control={control} rules={{ required: 'Route name is required' }} />
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
                        <RHFTextField
                            name="estimatedDurationMins"
                            label="Estimated Duration (mins)"
                            type="number"
                            control={control}
                            rules={{ required: 'Estimated duration is required' }}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="startPoint" label="Start Point" control={control} rules={{ required: 'Start point is required' }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="endPoint" label="End Point" control={control} rules={{ required: 'End point is required' }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="status" label="Status" control={control} select>
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                            <MenuItem value="draft">Draft</MenuItem>
                        </RHFTextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RHFTextField name="notes" label="Notes" control={control} />
                    </Grid>
                </Grid>

                <Controller
                    name="routeGeoJson"
                    control={control}
                    rules={{
                        validate: (value) => {
                            if (!value || value.type !== 'LineString' || !Array.isArray(value.coordinates)) {
                                return 'Route path is required';
                            }
                            if (value.coordinates.length < 2) {
                                return 'Route needs at least 2 map points';
                            }
                            return true;
                        }
                    }}
                    render={({ field, fieldState }) => (
                        <>
                            <RoutePathMapField value={field.value} onChange={field.onChange} />
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
                        Save Route
                    </LdButton>
                </Stack>
            </Stack>
        </FormProvider>
    );
};

RouteForm.propTypes = {
    zones: PropTypes.array.isRequired,
    onSubmit: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    open: PropTypes.bool
};

export default RouteForm;
