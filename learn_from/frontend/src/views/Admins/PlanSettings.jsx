import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { SaveOutlined } from '@mui/icons-material';
import axios from 'axios';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import { SnackError, SnackSuccess } from 'utils/Snackbars';

const PlanSettings = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const issuedBy = localStorage.getItem('userId');

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/api/admins/fair-use-plans', { params: { issuedBy } });
      setPlans(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch fair-use plan settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const updateValue = (planId, field, value) => {
    setPlans((current) => current.map((plan) => (plan.id === planId ? { ...plan, [field]: value } : plan)));
  };

  const savePlan = async (plan) => {
    setSavingId(plan.id);
    try {
      const response = await axios.put(`/api/api/admins/fair-use-plans/${plan.id}`, {
        issuedBy,
        fairUseLimitGb: plan.fair_use_limit_gb,
        fairUseDownKbps: plan.fair_use_down_kbps,
        fairUseUpKbps: plan.fair_use_up_kbps
      });
      setSuccess(response.data.message || 'Fair-use settings updated successfully.');
      await fetchPlans();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update fair-use settings.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <SuperAdminDeskLink />
      <MainCard title={<Typography variant="h3">Plan Settings</Typography>}>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: 'primary.lighter' }}>
        <Typography variant="h4" gutterBottom>
          Fair-use policy
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Users are throttled after their current subscription reaches the configured data limit. Speeds are stored in kbit/s and sent to pfSense as RADIUS bandwidth replies. Set all values to 0 to disable fair-use for a plan.
        </Typography>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="fair-use plan settings">
            <TableHead>
              <TableRow>
                <TableCell>Plan</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Fair-use limit (GB)</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Download (kbit/s)</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Upload (kbit/s)</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id} hover>
                  <TableCell>{plan.plan_name}</TableCell>
                  <TableCell>GHS {Number(plan.amount || 0).toFixed(2)}</TableCell>
                  <TableCell>{plan.expires_display}</TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      type="number"
                      inputProps={{ min: 0, step: 0.1 }}
                      value={plan.fair_use_limit_gb}
                      onChange={(event) => updateValue(plan.id, 'fair_use_limit_gb', event.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      type="number"
                      inputProps={{ min: 0, step: 1 }}
                      value={plan.fair_use_down_kbps}
                      onChange={(event) => updateValue(plan.id, 'fair_use_down_kbps', event.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      type="number"
                      inputProps={{ min: 0, step: 1 }}
                      value={plan.fair_use_up_kbps}
                      onChange={(event) => updateValue(plan.id, 'fair_use_up_kbps', event.target.value)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={savingId === plan.id ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined />}
                      disabled={savingId !== null}
                      onClick={() => savePlan(plan)}
                    >
                      Save
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">No subscription plans found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      </MainCard>
    </>
  );
};

export default PlanSettings;
