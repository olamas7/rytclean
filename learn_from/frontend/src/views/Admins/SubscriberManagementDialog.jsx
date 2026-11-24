import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography
} from '@mui/material';
import { BlockOutlined, SpeedOutlined, SwapHorizOutlined } from '@mui/icons-material';
import axios from 'axios';

const SubscriberManagementDialog = ({ subscriptionId, open, onClose, onUpdated }) => {
  const [data, setData] = useState(null);
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  const issuedBy = localStorage.getItem('userId');

  const loadData = async () => {
    if (!subscriptionId) return;

    setLoading(true);
    setError(null);
    try {
      const [response, auditResponse] = await Promise.all([
        axios.get(`/api/api/admins/subscribers/${subscriptionId}/manage`, { params: { issuedBy } }),
        axios.get(`/api/api/admins/subscribers/${subscriptionId}/audit`, { params: { issuedBy } })
      ]);
      setData(response.data);
      setPlanId(String(response.data.subscription.plan_subs));
      setAuditEvents(auditResponse.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load subscriber management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadData();
  }, [open, subscriptionId]);

  const runAction = async (request, successMessage) => {
    setSaving(true);
    setError(null);
    try {
      const response = await request();
      await loadData();
      onUpdated(response.data.message || successMessage);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update this subscriber.');
    } finally {
      setSaving(false);
    }
  };

  const subscription = data?.subscription;
  const isDisabled = Number(subscription?.disabled) === 1;
  const isThrottled = Number(subscription?.fair_use_throttled) === 1;
  const isSuperThrottled = Number(subscription?.fair_use_super_throttled) === 1;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Manage Subscriber</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
        ) : error && !subscription ? (
          <Alert severity="error">{error}</Alert>
        ) : subscription ? (
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <Box>
              <Typography variant="h4">{subscription.client_fullname}</Typography>
              <Typography color="text.secondary">{subscription.username}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                <Chip size="small" color={isDisabled ? 'error' : 'success'} label={isDisabled ? 'Account disabled' : 'Account enabled'} />
                <Chip size="small" color={isSuperThrottled ? 'error' : isThrottled ? 'warning' : 'success'} label={isSuperThrottled ? 'Super throttled: 20 kbit/s' : isThrottled ? 'Fair-use throttled' : 'Normal speed'} />
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h5" gutterBottom>Recent History</Typography>
              {auditEvents.length > 0 ? (
                <Stack spacing={1}>
                  {auditEvents.map((event, index) => (
                    <Box key={`${event.event_type}-${event.created_at}-${index}`} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'grey.100' }}>
                      <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>{event.event_type.replace(/_/g, ' ')}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(event.created_at).toLocaleString()} | {event.source}{event.actor_username ? ` by ${event.actor_username}` : ''}
                      </Typography>
                      {event.usage_bytes != null && <Typography variant="caption" display="block">Usage at event: {(Number(event.usage_bytes) / (1024 * 1024 * 1024)).toFixed(2)} GB</Typography>}
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No recorded history yet. New actions will appear here.</Typography>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="h5" gutterBottom>Change Plan</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                The original subscription start date stays unchanged. The end date is recalculated from that date using the selected plan.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel id="subscriber-plan-label">Subscription plan</InputLabel>
                  <Select labelId="subscriber-plan-label" label="Subscription plan" value={planId} onChange={(event) => setPlanId(event.target.value)}>
                    {data.plans.map((plan) => <MenuItem key={plan.id} value={String(plan.id)}>{plan.plan_name} - GHS {Number(plan.amount).toFixed(2)}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  startIcon={<SwapHorizOutlined />}
                  disabled={saving || planId === String(subscription.plan_subs)}
                  onClick={() => runAction(() => axios.put(`/api/api/admins/subscribers/${subscriptionId}/plan`, { issuedBy, planId }), 'Plan changed successfully.')}
                >
                  Change
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h5" gutterBottom>Fair-use Speed</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Configured throttle: {subscription.fair_use_down_kbps || 0} down / {subscription.fair_use_up_kbps || 0} up kbit/s.
              </Typography>
              <Button
                color={isThrottled ? 'success' : 'warning'}
                variant="outlined"
                startIcon={<SpeedOutlined />}
                disabled={saving}
                onClick={() => runAction(() => axios.put(`/api/api/admins/subscribers/${subscriptionId}/fair-use`, { issuedBy, mode: isThrottled ? 'normal' : 'fair_use' }), isThrottled ? 'Throttle removed.' : 'Fair-use throttle applied.')}
              >
                {isThrottled ? 'Clear Fair-use Throttle' : 'Drop to Fair Use'}
              </Button>
              <Button
                color={isSuperThrottled ? 'success' : 'error'}
                variant="outlined"
                startIcon={<SpeedOutlined />}
                disabled={saving}
                onClick={() => runAction(() => axios.put(`/api/api/admins/subscribers/${subscriptionId}/fair-use`, { issuedBy, mode: isSuperThrottled ? 'normal' : 'super' }), isSuperThrottled ? 'Super Throttle removed.' : 'Super Throttle applied at 20 kbit/s.')}
              >
                {isSuperThrottled ? 'Clear Super Throttle' : 'Super Throttle'}
              </Button>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h5" gutterBottom>Account Access</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Disabling keeps the client and subscription history, but removes RADIUS authorization. pfSense applies the change at its next reauthentication.
              </Typography>
              <Button
                color={isDisabled ? 'success' : 'error'}
                variant="outlined"
                startIcon={<BlockOutlined />}
                disabled={saving}
                onClick={() => runAction(() => axios.put(`/api/api/admins/subscribers/${subscriptionId}/account-status`, { issuedBy, disabled: !isDisabled }), isDisabled ? 'Account enabled.' : 'Account disabled.')}
              >
                {isDisabled ? 'Enable Account' : 'Disable Account'}
              </Button>
            </Box>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={saving}>Close</Button></DialogActions>
    </Dialog>
  );
};

export default SubscriberManagementDialog;
