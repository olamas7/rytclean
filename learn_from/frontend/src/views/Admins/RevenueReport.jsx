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
  Pagination
} from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import axios from 'axios';

import { SnackError } from 'utils/Snackbars';
import { useForm } from 'react-hook-form';
import { RHFAutocomplete, RHFDatePicker } from 'utils/controls/ReactHookForms';

const RevenueReport = () => {
  const [revenueData, setRevenueData] = useState([]);
  const [stats, setStats] = useState({
    totalSubscriptions: 0,
    totalAmountCollected: 0,
    totalAmountByMobileMoney: 0,
    totalAmountByCash: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [agents, setAgents] = useState([]);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;
  const pageCount = Math.max(Math.ceil(revenueData.length / rowsPerPage), 1);
  const paginatedRevenueData = revenueData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const formatAmount = (amount) => `GHS ${Number(amount || 0).toFixed(2)}`;

  const { control, handleSubmit } = useForm();
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await axios.get(`/api/api/admins/select-agent-dropdown`);
        const transformedAgents = response.data.data.map((agent) => ({
          id: agent.username,
          label: `${agent.fullname} (${agent.username})`
        }));
        setAgents([{ id: '', label: 'All Agents' }, ...transformedAgents]);
      } catch (err) {
        setError('Failed to fetch agents.');
        console.error('Error fetching agents:', err);
      }
    };
    fetchAgents();
  }, []);

  const fetchRevenueReport = async (data) => {
    setLoading(true);
    setError(null);
    setPage(0);
    try {
      const params = {};
      if (data.agent) {
        params.agentId = data.agent.id;
      }
      if (data.dateFrom) {
        params.dateFrom = data.dateFrom;
      }
      if (data.dateTo) {
        params.dateTo = data.dateTo;
      }

      const response = await axios.get(`/api/api/admins/admin-revenue-report`, {
        params
      });
      setRevenueData(response.data.subscriptions);
      setStats(response.data.stats);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch revenue report.');
      console.error('Error fetching revenue report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage - 1);
  };

  return (
    <>
      <SuperAdminDeskLink />
      <MainCard title={<Typography variant="h3">Admin Revenue Report</Typography>}>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />

      <form onSubmit={handleSubmit(fetchRevenueReport)}>
        <Grid container spacing={2} sx={{ mb: 3 }} alignItems="center">
          <Grid item xs={12} md={3}>
            <RHFAutocomplete name="agent" control={control} options={agents} label="Select Agent" />
          </Grid>
          <Grid item xs={12} md={3}>
            <RHFDatePicker name="dateFrom" control={control} label="Date From" />
          </Grid>
          <Grid item xs={12} md={3}>
            <RHFDatePicker name="dateTo" control={control} label="Date To" />
          </Grid>
          <Grid item xs={12} md={3}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Generate Report
            </Button>
          </Grid>
        </Grid>
      </form>

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
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={3} sx={{ p: 2, textAlign: 'center', backgroundColor: '#fff3e0', color: '#e65100' }}>
                <Typography variant="h6" color="inherit">
                  Mobile Money
                </Typography>
                <Typography variant="h4" color="inherit">
                  GHS {stats.totalAmountByMobileMoney.toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={3} sx={{ p: 2, textAlign: 'center', backgroundColor: '#fbe9e7', color: '#bf360c' }}>
                <Typography variant="h6" color="inherit">
                  Cash
                </Typography>
                <Typography variant="h4" color="inherit">
                  GHS {stats.totalAmountByCash.toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="revenue report table">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Subscriber Name</TableCell>
                  <TableCell>Amount Paid</TableCell>
                  <TableCell>Payment Method</TableCell>
                  <TableCell>Payment Date</TableCell>
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
                      <TableCell>{formatAmount(row.plan_amount)}</TableCell>
                      <TableCell>{row.mode_of_payment}</TableCell>
                      <TableCell>{row.payment_date}</TableCell>
                      <TableCell>{row.start_date}</TableCell>
                      <TableCell>{row.end_date}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No revenue data found for the selected criteria.
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
        </>
      )}
      </MainCard>
    </>
  );
};

export default RevenueReport;
