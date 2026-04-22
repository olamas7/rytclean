import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Alert, Box, Grid, MenuItem, Paper, Stack, Typography } from '@mui/material';
import { getDrivers } from 'services/api/driversService';
import { assignPickup, getPickups } from 'services/api/pickupsService';
import { RHFTextField } from 'utils/controls/ReactHookForms';
import { LdButton } from 'utils/myButtons';

const DriverAssignment = () => {
    const methods = useForm({
        defaultValues: {
            selectedPickup: '',
            selectedDriver: ''
        }
    });
    const { watch, control } = methods;

    const [drivers, setDrivers] = useState([]);
    const [pickups, setPickups] = useState([]);
    const [assignmentLoading, setAssignmentLoading] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const selectedPickup = watch('selectedPickup');
    const selectedDriver = watch('selectedDriver');

    const loadData = async () => {
        const [driversRes, pickupsRes] = await Promise.all([getDrivers(), getPickups()]);
        if (driversRes.code === 1) {
            setDrivers(driversRes.data.filter((driver) => Number(driver.userStatus) === 1));
        }
        if (pickupsRes.code === 1) {
            setPickups(pickupsRes.data);
        }
    };

    const handleAssignDriver = async () => {
        if (!selectedPickup || !selectedDriver) {
            setFeedback({ type: 'error', message: 'Select both pickup and driver before assigning.' });
            return;
        }

        setAssignmentLoading(true);
        setFeedback(null);

        try {
            const response = await assignPickup({ pickupId: selectedPickup, driverId: selectedDriver });
            if (response.code === 1) {
                setFeedback({ type: 'success', message: response.message });
                await loadData();
                return;
            }
            setFeedback({ type: 'error', message: response.message });
        } catch (error) {
            setFeedback({ type: 'error', message: 'Unable to save assignment right now.' });
        } finally {
            setAssignmentLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const assignmentPreview = useMemo(() => {
        const pickup = pickups.find((item) => item.id === selectedPickup);
        const driver = drivers.find((item) => item.id === selectedDriver);

        if (!pickup || !driver) {
            return null;
        }

        return { pickup, driver };
    }, [drivers, pickups, selectedPickup, selectedDriver]);

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Driver Assignment
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Assign active driver users to pickup requests.
            </Typography>

            {feedback && (
                <Alert severity={feedback.type} sx={{ mb: 2.5 }}>
                    {feedback.message}
                </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2.5 }}>
                <LdButton onClick={handleAssignDriver} loading={assignmentLoading} disabled={!selectedPickup || !selectedDriver}>
                    Assign Driver
                </LdButton>
            </Stack>

            <FormProvider {...methods}>
                <Grid container spacing={2.5}>
                    <Grid item xs={12} md={7}>
                        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Grid container spacing={1.5}>
                                <Grid item xs={12}>
                                    <RHFTextField name="selectedPickup" label="Pickup Request" control={control} select>
                                        {pickups
                                            .filter((pickup) => pickup.status !== 'completed')
                                            .map((pickup) => (
                                            <MenuItem key={pickup.id} value={pickup.id}>
                                                {pickup.id} - {pickup.address}
                                            </MenuItem>
                                            ))}
                                    </RHFTextField>
                                </Grid>
                                <Grid item xs={12}>
                                    <RHFTextField name="selectedDriver" label="Available Driver" control={control} select>
                                        {drivers
                                            .filter((driver) => driver.status === 'available')
                                            .map((driver) => (
                                            <MenuItem key={driver.id} value={driver.id}>
                                                {driver.fullName} ({driver.status})
                                            </MenuItem>
                                            ))}
                                    </RHFTextField>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={5}>
                        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                            <Typography variant="h4" sx={{ mb: 1.5 }}>
                                Route Preview
                            </Typography>
                            {assignmentPreview ? (
                                <>
                                    <Typography variant="body2">Pickup: {assignmentPreview.pickup.id}</Typography>
                                    <Typography variant="body2">Address: {assignmentPreview.pickup.address}</Typography>
                                    <Typography variant="body2">Driver: {assignmentPreview.driver.fullName}</Typography>
                                    <Typography variant="body2">Vehicle: {assignmentPreview.driver.vehicleNumber}</Typography>
                                    <Typography variant="body2">Zone: {assignmentPreview.driver.zoneName || assignmentPreview.driver.zoneId}</Typography>
                                </>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    Select pickup and driver to preview assignment.
                                </Typography>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            </FormProvider>
        </Box>
    );
};

export default DriverAssignment;
