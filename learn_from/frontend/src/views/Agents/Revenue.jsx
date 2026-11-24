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
  Box,
  Divider,
  Pagination
} from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import AgentsDeskLink from './AgentsDeskLink';
import axios from 'axios';

import { SnackError } from 'utils/Snackbars';

const Revenue = () => {
  const [revenueData, setRevenueData] = useState([]);
  const [stats, setStats] = useState({
    totalSubscriptions: 0,
    totalAmountCollected: 0,
    totalAmountByMobileMoney: 0,
    totalAmountByCash: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;
  const pageCount = Math.max(Math.ceil(revenueData.length / rowsPerPage), 1);
  const paginatedRevenueData = revenueData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const formatAmount = (amount) => `GHS ${Number(amount || 0).toFixed(2)}`;

  const handleChangePage = (event, newPage) => {
    setPage(newPage - 1);
  };

  useEffect(() => {
    const fetchRevenueData = async () => {
      setLoading(true);
      setError(null);
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
          setError('User ID not found. Please log in.');
          setLoading(false);
          return;
        }

        const response = await axios.get(`/api/api/agents/revenue`, {
          params: { userId }
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

    fetchRevenueData();
  }, []);

  return (
    <>
      <AgentsDeskLink />
      <MainCard title={<Typography variant="h3">Revenue Report</Typography>}>
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />

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
                      <TableCell>{formatAmount(row.plan_amount)}</TableCell>
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
        </>
      )}
      </MainCard>
    </>
  );
};

export default Revenue;
