import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { getSmsSettings, saveSmsSettings, sendTestSms } from 'services/api/smsService';
import { Link } from 'react-router-dom';
import { appRoutes } from 'constants/appRoutes';
import { LdButton } from 'utils/myButtons';

const errorMessage = (error) => error.response?.data?.message || error.message || 'SMS operation failed.';
const checked = (response) => { if (response.code !== 1) throw new Error(response.message); return response.data; };
const statusLabels = { queued: 'Queued', sending: 'Sending', submitted_unverified: 'Submitted · unverified', failed: 'Failed', unknown: 'Unknown · check provider', cancelled: 'Cancelled' };

export default function SmsSettings() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [testFeedback, setTestFeedback] = useState(null);
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('RytClean SMS connection test.');
    const busy = useRef(false);
    const testRequest = useRef(null);
    const canManage = ['Admin', 'Super Admin'].includes(localStorage.getItem('admin_role'));
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try { setSettings(checked(await getSmsSettings())); }
        catch (err) { setError(errorMessage(err)); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { if (canManage) load(); }, [canManage, load]);
    const save = async (event) => {
        event.preventDefault();
        if (busy.current) return;
        busy.current = true;
        setSaving(true);
        setError('');
        setFeedback('');
        try { setSettings(checked(await saveSmsSettings(settings))); setFeedback('SMS settings saved.'); }
        catch (err) { setError(errorMessage(err)); }
        finally { busy.current = false; setSaving(false); }
    };
    const test = async (event) => {
        event.preventDefault();
        if (busy.current) return;
        if (!window.confirm(`Send a paid test SMS to ${phone}? This works even when automatic SMS is off.`)) return;
        busy.current = true;
        setTesting(true);
        setTestFeedback(null);
        const fingerprint = JSON.stringify({ phone, message });
        if (testRequest.current?.fingerprint !== fingerprint) testRequest.current = { fingerprint, key: crypto.randomUUID() };
        try {
            const data = checked(await sendTestSms({ phone, message, requestKey: testRequest.current.key }));
            setTestFeedback({ severity: data.status === 'submitted_unverified' ? 'info' : 'warning', text: `${statusLabels[data.status] || data.status}: ${data.detail || ''}` });
        } catch (err) { setTestFeedback({ severity: 'error', text: errorMessage(err) }); }
        finally { busy.current = false; setTesting(false); }
    };
    if (!canManage) return <Alert severity="info">Only administrators can configure SMS.</Alert>;
    const updateEvent = (index, patch) => setSettings({ ...settings, events: settings.events.map((value, i) => i === index ? { ...value, ...patch } : value) });
    return <Stack spacing={2}>
        <Typography variant="h4" component="h2">SMS Notifications</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {feedback && <Alert severity="success" role="status">{feedback}</Alert>}
        {loading && <Typography role="status">Loading SMS settings…</Typography>}
        {!settings && !loading && <LdButton onClick={load} loading={loading}>Retry SMS Settings</LdButton>}
        {settings && <>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                <Stack component="form" spacing={2} onSubmit={save}>
                    <Alert severity="info">Host, API key and sender ID come from SMS_API_HOST, SMS_API_KEY and SMS_SENDER_ID in server/.env. Restart the server after changing them. Enabling SMS does not send historical registration or payment messages.</Alert>
                    <Typography variant="body2">API key: {settings.credentialsConfigured ? 'Configured (hidden)' : 'Not configured'} · Transport: {settings.transport.toUpperCase()}</Typography>
                    {settings.transport === 'http' && <Alert severity="warning">HTTP sends the API key without encryption. Use HTTPS whenever supported by your provider.</Alert>}
                    <FormControlLabel label="Enable automatic SMS notifications" control={<Switch checked={settings.enabled} disabled={saving || testing} onChange={(_, enabled) => setSettings({ ...settings, enabled })} />} />
                    <TextField label="SMS API Host" helperText="Read from server/.env; defaults to api.smsonlinegh.com when blank." value={settings.host || ''} InputProps={{ readOnly: true }} />
                    <TextField label="SMS Sender ID" helperText="Read from SMS_SENDER_ID in server/.env. Provider-approved sender, maximum 11 characters." value={settings.sender} InputProps={{ readOnly: true }} />
                    <Typography variant="body2" color="text.secondary">Reminders: once on the due date, then once when at least 7 days overdue, for outstanding bills only. Enabling reminders also includes existing outstanding bills.</Typography>
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>Placeholders: {(settings.placeholders || []).map((key) => `{${key}}`).join(', ')}. Follow the defaults for the values available to each event.</Typography>
                    {settings.events.map((item, index) => <Box key={item.key}>
                        <FormControlLabel label={item.title} control={<Switch checked={item.enabled} disabled={saving || testing} onChange={(_, enabled) => updateEvent(index, { enabled })} />} />
                        <TextField fullWidth multiline minRows={2} required label={`${item.title} message`} value={item.message} disabled={saving || testing} inputProps={{ maxLength: 1000 }} helperText={`${item.message.length}/1000 characters. Available: ${(item.placeholders || []).map((key) => `{${key}}`).join(', ')}. Long messages may cost multiple SMS units.`} onChange={(event) => updateEvent(index, { message: event.target.value })} />
                    </Box>)}
                    <Box><LdButton type="submit" loading={saving} disabled={testing || loading}>Save SMS Settings</LdButton></Box>
                </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                <Stack component="form" spacing={2} onSubmit={test}>
                    <Typography variant="h4" component="h3">Send Test SMS</Typography>
                    <Typography variant="body2" color="text.secondary">Uses saved settings and may incur a charge. Repeating an unchanged test will not send another SMS; edit the message to create a new test.</Typography>
                    {testFeedback && <Alert severity={testFeedback.severity} role="status">{testFeedback.text}</Alert>}
                    <TextField label="Test phone number" required value={phone} disabled={testing || saving} inputProps={{ inputMode: 'numeric', pattern: '0[0-9]{9}', maxLength: 10 }} helperText="10 digits starting with 0" onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} />
                    <TextField label="Test message" required multiline minRows={2} value={message} disabled={testing || saving} inputProps={{ maxLength: 1000 }} onChange={(event) => setMessage(event.target.value)} />
                    <Box><LdButton type="submit" loading={testing} disabled={saving || !settings.credentialsConfigured || !settings.sender} tooltip={!settings.credentialsConfigured || !settings.sender ? 'Set SMS_API_KEY and SMS_SENDER_ID in server/.env, then restart the server' : ''}>Send Test SMS</LdButton></Box>
                </Stack>
            </Paper>
        </>}
        <Alert severity="info">Bulk messaging and notification history are now under Manager → SMS Notifications.</Alert>
        <Box><LdButton component={Link} to={`${appRoutes.management.admin.sms}?tab=history`} variant="outlined">View Notification History</LdButton></Box>
    </Stack>;
}
