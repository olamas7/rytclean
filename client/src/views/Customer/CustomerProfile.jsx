import { useEffect, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Grid, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { getCustomerById } from 'services/mockApi';

const CUSTOMER_ID = 'CUST-001';

const CustomerProfile = () => {
    const [profile, setProfile] = useState(null);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const loadProfile = async () => {
            const response = await getCustomerById(CUSTOMER_ID);
            if (response.code === 1) {
                setProfile(response.data);
            }
        };

        loadProfile();
    }, []);

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
                Profile
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Manage account details, preferences, and password settings.
            </Typography>

            {notice ? <Alert sx={{ mb: 2 }}>{notice}</Alert> : null}

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h4" sx={{ mb: 1.5 }}>
                            Customer Details
                        </Typography>
                        <Stack spacing={1.5}>
                            <TextField label="Full Name" value={profile?.fullName || ''} fullWidth />
                            <TextField label="Email" value={profile?.email || ''} fullWidth />
                            <TextField label="Phone" value={profile?.phone || ''} fullWidth />
                            <TextField label="Address" value={profile?.address || ''} fullWidth multiline minRows={3} />
                            <Button variant="contained" onClick={() => setNotice('Profile changes saved (mock).')}>
                                Save Changes
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Stack spacing={2.5}>
                        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="h4" sx={{ mb: 1.5 }}>
                                Notification Preferences
                            </Typography>
                            <Stack>
                                <FormControlLabel control={<Switch defaultChecked />} label="Pickup reminders" />
                                <FormControlLabel control={<Switch defaultChecked />} label="Payment notifications" />
                                <FormControlLabel control={<Switch />} label="Promotional updates" />
                            </Stack>
                        </Paper>

                        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="h4" sx={{ mb: 1.5 }}>
                                Change Password
                            </Typography>
                            <Stack spacing={1.5}>
                                <TextField type="password" label="Current Password" fullWidth />
                                <TextField type="password" label="New Password" fullWidth />
                                <TextField type="password" label="Confirm New Password" fullWidth />
                                <Button variant="outlined" onClick={() => setNotice('Password update submitted (mock).')}>
                                    Update Password
                                </Button>
                            </Stack>
                        </Paper>
                    </Stack>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CustomerProfile;
