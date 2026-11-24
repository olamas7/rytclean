import React, { useState, useEffect } from 'react';
import {
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Button,
  Box,
  Divider,
  Pagination
} from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import axios from 'axios';

import { useForm } from 'react-hook-form';
import { RHFAutocomplete } from 'utils/controls/ReactHookForms';
import { SnackError, SnackSuccess } from 'utils/Snackbars';
import { ConfirmDialog } from 'utils/controls/confirmation';

const ReceiveRevenue = () => {
  const [revenueData, setRevenueData] = useState([]);
  const [stats, setStats] = useState({
    totalSubscriptions: 0,
    totalAmountCollected: 0,
    totalAmountByMobileMoney: 0,
    totalAmountByCash: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [agents, setAgents] = useState([]);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;
  const pageCount = Math.max(Math.ceil(revenueData.length / rowsPerPage), 1);
  const paginatedRevenueData = revenueData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const { control, watch } = useForm();
  const selectedAgent = watch('agent');

  const fetchRevenueData = async () => {
    setLoading(true);
    setError(null);
    setPage(0);
    try {
      const params = {};
      if (selectedAgent) {
        params.agentId = selectedAgent.username;
      }

      const response = await axios.get(`/api/api/admins/revenue-report`, {
        params
      });
      setRevenueData(response.data.subscriptions);
      setStats(response.data.stats);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch revenue data.');
      console.error('Error fetching revenue data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await axios.get(`/api/api/admins/select-agent-dropdown`);
        const transformedAgents = response.data.data.map((agent) => ({
          id: agent.username, // Required for RHFAutocomplete
          username: agent.username, // Explicitly keep username
          label: `${agent.fullname} (${agent.username})`
        }));
        setAgents(transformedAgents);
      } catch (err) {
        setError('Failed to fetch agents.');
        console.error('Error fetching agents:', err);
      }
    };
    fetchAgents();
  }, []);

  useEffect(() => {
    fetchRevenueData();
  }, [selectedAgent]);

  const handleReceiveMoneyClick = () => {
    setOpenConfirmDialog(true);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage - 1);
  };

  const handleConfirmReceiveMoney = async () => {
    setOpenConfirmDialog(false);
    try {
      const payload = {};
      if (selectedAgent) {
        payload.agentId = selectedAgent.username;
      }
      const response = await axios.post(`/api/api/admins/mark-received`, payload);
      setSuccess(response.data.message || 'Revenue marked as received successfully!');
      fetchRevenueData(); // Refresh data after update
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark revenue as received.');
      console.error('Error marking revenue as received:', err);
    }
  };

  return (
    <>
      <SuperAdminDeskLink />
      <MainCard title={<Typography variant="h3">Received Revenue Report</Typography>}>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />

      <ConfirmDialog
        open={openConfirmDialog}
        handleClose={() => setOpenConfirmDialog(false)}
        onConfirm={handleConfirmReceiveMoney}
        message="Are you sure you want to mark all displayed revenue as received? This action cannot be undone."
        title="Confirm Revenue Reception"
        confirmButton="Yes, Receive Money"
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <RHFAutocomplete name="agent" control={control} options={agents} label="Select Agent" />
        </Grid>
      </Grid>

      {loading ? (
        <Grid container justifyContent="center" alignItems="center" style={{ height: '200px' }}>
          <CircularProgress />
        </Grid>
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={3} sx={{ p: 2, textAlign: 'center', backgroundColor: '#e3f2fd', color: '#1a237e' }}>
                <Typography variant="h6" color="inherit">
                  Total Subscriptions
                </Typography>
                <Typography variant="h4" color="inherit">
                  {stats.totalSubscriptions}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={3} sx={{ p: 2, textAlign: 'center', backgroundColor: '#e8f5e9', color: '#1b5e20' }}>
                <Typography variant="h6" color="inherit">
                  Total Collected
                </Typography>
                <Typography variant="h4" color="inherit">
                  GHS {stats.totalAmountCollected.toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper elevation={3} sx={{ p: 2, textAlign: 'center', backgroundColor: '#fff3e0', color: '#e65100' }}>
                <Grid container direction="row" justifyContent="space-around" alignItems="center">
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="textSecondary">
                      Mobile Money
                    </Typography>
                    <Typography variant="h4" color="primary">
                      GHS {stats.totalAmountByMobileMoney.toFixed(2)}
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="textSecondary">
                      Cash
                    </Typography>
                    <Typography variant="h4" color="primary">
                      GHS {stats.totalAmountByCash.toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper elevation={3} sx={{ p: 2, textAlign: 'center', backgroundColor: '#ffe0f8ff', color: '#b272f3ff' }}>
                <Grid container direction="row" justifyContent="space-around" alignItems="center">
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="textSecondary">
                      Commissions
                    </Typography>
                    <Typography variant="h4" color="secondary">
                      GHS {(stats.totalAmountCollected * 0.1).toFixed(2)}
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="textSecondary">
                      Payable
                    </Typography>
                    <Typography variant="h4" color="error">
                      GHS {(stats.totalAmountCollected * 0.9).toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
              </Paper>
            </Grid>
          </Grid>

          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="revenue table">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Subscriber Name</TableCell>
                  <TableCell>Amount Paid</TableCell>
                  <TableCell>Payment Method</TableCell>
                  <TableCell>Subscription Date</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {revenueData.length > 0 ? (
                  paginatedRevenueData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{row.subscriber_name}</TableCell>
                      <TableCell>GHS {Number(row.plan_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{row.mode_of_payment}</TableCell>
                      <TableCell>{row.payment_date || row.start_date}</TableCell>
                      <TableCell>{row.start_date}</TableCell>
                      <TableCell>{row.end_date}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No revenue data found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination
            count={pageCount}
            page={page + 1}
            onChange={handleChangePage}
            color="primary"
            showFirstButton
            showLastButton
            sx={{ display: 'flex', justifyContent: 'center', p: 2 }}
          />

          <Grid item xs={12} sx={{ mt: 2, textAlign: 'right' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleReceiveMoneyClick}
              disabled={revenueData.length === 0} // Disable if no data to receive
            >
              Receive Money
            </Button>
          </Grid>
        </>
      )}
      </MainCard>
    </>
  );
};

export default ReceiveRevenue;
