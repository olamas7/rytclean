import { useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Grid, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';

const wasteTypeOptions = ['Household', 'Recyclables', 'Commercial', 'General Waste'];

const initialState = {
    wasteType: 'Household',
    pickupDate: '',
    pickupAddress: '',
    landmark: '',
    notes: '',
    extraBin: false,
    emergencyPickup: false
};

const BookPickup = () => {
    const [formData, setFormData] = useState(initialState);
    const [submitted, setSubmitted] = useState(false);

    const isSubmitDisabled = useMemo(() => !formData.wasteType || !formData.pickupDate || !formData.pickupAddress, [formData]);

    const handleChange = (event) => {
        const { name, value, checked, type } = event.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        setSubmitted(false);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (isSubmitDisabled) {
            return;
        }

        setSubmitted(true);
    };

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Book Pickup
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Fill out pickup details and review summary before submission.
            </Typography>

            {submitted ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                    Pickup request submitted (mock).
                </Alert>
            ) : null}

            <Grid container spacing={2.5}>
                <Grid item xs={12} lg={8}>
                    <Paper
                        component="form"
                        onSubmit={handleSubmit}
                        sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                    >
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Waste Type"
                                    name="wasteType"
                                    value={formData.wasteType}
                                    onChange={handleChange}
                                >
                                    {wasteTypeOptions.map((option) => (
                                        <MenuItem key={option} value={option}>
                                            {option}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label="Pickup Date"
                                    name="pickupDate"
                                    value={formData.pickupDate}
                                    onChange={handleChange}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Pickup Address"
                                    name="pickupAddress"
                                    value={formData.pickupAddress}
                                    onChange={handleChange}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField fullWidth label="Landmark" name="landmark" value={formData.landmark} onChange={handleChange} />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={4}
                                    label="Notes"
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    <FormControlLabel
                                        control={<Checkbox checked={formData.extraBin} name="extraBin" onChange={handleChange} />}
                                        label="Extra bin option"
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox checked={formData.emergencyPickup} name="emergencyPickup" onChange={handleChange} />
                                        }
                                        label="Emergency pickup option"
                                    />
                                </Stack>
                            </Grid>
                            <Grid item xs={12}>
                                <Button type="submit" variant="contained" disabled={isSubmitDisabled}>
                                    Submit Booking
                                </Button>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                <Grid item xs={12} lg={4}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Booking Summary
                        </Typography>
                        <Stack spacing={1}>
                            <Typography variant="body2">Waste Type: {formData.wasteType || '-'}</Typography>
                            <Typography variant="body2">Pickup Date: {formData.pickupDate || '-'}</Typography>
                            <Typography variant="body2">Address: {formData.pickupAddress || '-'}</Typography>
                            <Typography variant="body2">Landmark: {formData.landmark || '-'}</Typography>
                            <Typography variant="body2">Extra Bin: {formData.extraBin ? 'Yes' : 'No'}</Typography>
                            <Typography variant="body2">Emergency: {formData.emergencyPickup ? 'Yes' : 'No'}</Typography>
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default BookPickup;
