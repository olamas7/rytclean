import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { SaveOutlined } from '@mui/icons-material';
import axios from 'axios';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import { SnackError, SnackSuccess } from 'utils/Snackbars';

const previewMessage = (message) => String(message)
  .replace(/\{username\}/g, '0240000000')
  .replace(/\{expiryDate\}/g, '30-09-2026, 10:00 AM');

const settingDescriptions = {
  purchase_confirmation: 'Sent after a package is activated.',
  expiry_warning: 'Sent shortly before an active package expires.',
  fair_use_throttle: 'Sent once when the automatic fair-use throttle is applied.',
  super_throttle: 'Sent once when a Super Admin applies Super Throttle.'
};

const SmsSettings = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const issuedBy = localStorage.getItem('userId');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/api/admins/sms-automation-settings', { params: { issuedBy } });
      setSettings(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch automated SMS settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = (eventKey, field, value) => {
    setSettings((current) => current.map((setting) => (setting.eventKey === eventKey ? { ...setting, [field]: value } : setting)));
  };

  const saveSetting = async (setting) => {
    setSavingKey(setting.eventKey);
    try {
      const response = await axios.put(`/api/api/admins/sms-automation-settings/${setting.eventKey}`, {
        issuedBy,
        enabled: setting.enabled,
        message: setting.message
      });
      setSettings((current) => current.map((item) => (item.eventKey === setting.eventKey ? response.data.setting : item)));
      setSuccess(response.data.message || 'Automated SMS setting updated successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update automated SMS setting.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <>
      <SuperAdminDeskLink />
      <MainCard title={<Typography variant="h3">SMS Settings</Typography>}>
        <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
        <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />

        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: 'primary.lighter' }}>
          <Typography variant="h4" gutterBottom>Automated messages</Typography>
          <Typography variant="body2" color="text.secondary">
            Control the SMS messages sent after a purchase and before a package expires. Use {'{username}'} and {'{expiryDate}'} to insert account details automatically.
          </Typography>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2.5}>
            {settings.map((setting) => (
              <Paper key={setting.eventKey} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h4">{setting.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {settingDescriptions[setting.eventKey]}
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={<Switch checked={setting.enabled} onChange={(event) => updateSetting(setting.eventKey, 'enabled', event.target.checked)} />}
                    label={setting.enabled ? 'Enabled' : 'Disabled'}
                  />
                </Stack>

                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="SMS message"
                  value={setting.message}
                  onChange={(event) => updateSetting(setting.eventKey, 'message', event.target.value)}
                />

                <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: 'grey.100' }}>
                  <Typography variant="caption" color="text.secondary">Preview</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{previewMessage(setting.message)}</Typography>
                </Box>

                <Button
                  variant="contained"
                  size="small"
                  sx={{ mt: 2 }}
                  startIcon={savingKey === setting.eventKey ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined />}
                  disabled={savingKey !== null || !setting.message.trim()}
                  onClick={() => saveSetting(setting)}
                >
                  Save
                </Button>
              </Paper>
            ))}
          </Stack>
        )}
      </MainCard>
    </>
  );
};

export default SmsSettings;
