import React, { useState, useEffect } from 'react';
import {
  Grid,
  Typography,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Pagination,
  FormControlLabel,
  Switch
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddOutlined from '@mui/icons-material/AddOutlined';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';
import axios from 'axios';

import { SnackError, SnackSuccess } from 'utils/Snackbars';
import SubscriberManagementDialog from './SubscriberManagementDialog';
import MediumDialog from 'views/Hooks/dialogMedium';
import NewSubscriber from 'views/Agents/NewSubscriber';
import ClientHistory from './ClientHistory';

const AdminSubscribers = ({ embedded = false, rowsPerPage = 100, enabled = true }) => {
  const [subscribers, setSubscribers] = useState([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [throttledOnly, setThrottledOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [subscriberToManage, setSubscriberToManage] = useState(null);
  const [selectedClientUsername, setSelectedClientUsername] = useState(null);
  const [fairUseReview, setFairUseReview] = useState([]);
  const [page, setPage] = useState(0);
  const [openNewSubscriberDialog, setOpenNewSubscriberDialog] = useState(false);
  const pageCount = Math.max(Math.ceil(totalSubscribers / rowsPerPage), 1);
  const formatAmount = (amount) => `GHS ${Number(amount || 0).toFixed(2)}`;

  const fetchSubscribers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/api/agents/subscribers`, {
        params: { search: searchQuery, page: page + 1, limit: rowsPerPage, throttledOnly }
      });
      setSubscribers(response.data.subscribers);
      setTotalSubscribers(response.data.totalSubscribers);
      const reviewResponse = await axios.get('/api/api/admins/fair-use-review', {
        params: { issuedBy: localStorage.getItem('userId') }
      });
      setFairUseReview(reviewResponse.data || []);
    } catch (err) {
      setError('Failed to fetch subscribers.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return undefined;
    const handler = setTimeout(() => {
      fetchSubscribers();
    }, 500); // Debounce search input

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, throttledOnly, page, refreshTrigger, rowsPerPage, enabled]);

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage - 1);
  };

  const handleThrottledOnlyChange = (event) => {
    setThrottledOnly(event.target.checked);
    setPage(0);
  };

  if (selectedClientUsername) {
    return (
      <>
        <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
        <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />
        <SubscriberManagementDialog
          open={!!subscriberToManage}
          subscriptionId={subscriberToManage}
          onClose={() => setSubscriberToManage(null)}
          onUpdated={(message) => {
            setSuccess(message);
            setRefreshTrigger((current) => current + 1);
          }}
        />
        <ClientHistory
          key={`${selectedClientUsername}-${refreshTrigger}`}
          inline
          clientUsername={selectedClientUsername}
          showPassword
          onBack={() => setSelectedClientUsername(null)}
          onManageSubscription={setSubscriberToManage}
        />
      </>
    );
  }

  return (
    <>
      {!embedded && <SuperAdminDeskLink />}
      <MainCard
      title={
        <Grid container justifyContent="space-between" alignItems="center">
          <Grid item>
            <Typography variant="h3">Subscribers</Typography>
          </Grid>
          <Grid item>
            <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setOpenNewSubscriberDialog(true)}>
              Add Subscriber
            </Button>
          </Grid>
        </Grid>
      }
    >
      <SnackError open={!!error} setOpen={() => setError(null)} message={error} />
      <SnackSuccess open={!!success} setOpen={() => setSuccess(null)} message={success} />

      <SubscriberManagementDialog
        open={!!subscriberToManage}
        subscriptionId={subscriberToManage}
        onClose={() => setSubscriberToManage(null)}
        onUpdated={(message) => {
          setSuccess(message);
          setRefreshTrigger((current) => current + 1);
        }}
      />

      <MediumDialog open={openNewSubscriberDialog} onClose={() => setOpenNewSubscriberDialog(false)}>
        <NewSubscriber
          onSuccess={(message) => {
            setOpenNewSubscriberDialog(false);
            setSuccess(message);
            setRefreshTrigger((current) => current + 1);
          }}
        />
      </MediumDialog>

      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12} sm={5}>
          <TextField
            fullWidth
            label="Search Subscribers"
            value={searchQuery}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <FormControlLabel
            control={<Switch checked={throttledOnly} onChange={handleThrottledOnlyChange} />}
            label="Throttled only"
          />
        </Grid>
        <Grid item xs={12} sm={4} textAlign={{ xs: 'left', sm: 'right' }}>
          <Typography variant="h4">Total Subscribers: {totalSubscribers}</Typography>
        </Grid>
      </Grid>

      {loading ? (
        <Typography>Loading subscribers...</Typography>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <>
        <Paper>
          <TableContainer>
            <Table sx={{ minWidth: 650 }} aria-label="subscribers table">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Subscription Date</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                   <TableCell>Data Used</TableCell>
                   <TableCell>Fair-use</TableCell>
                  <TableCell>Registered By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subscribers.length > 0 ? (
                  subscribers.map((subscriber) => (
                    <TableRow
                      hover
                      key={subscriber.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedClientUsername(subscriber.username)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') setSelectedClientUsername(subscriber.username);
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{subscriber.name}</TableCell>
                      <TableCell>{formatAmount(subscriber.plan_amount)}</TableCell>
                      <TableCell>{subscriber.subscription_date || 'N/A'}</TableCell>
                      <TableCell>{subscriber.start_date}</TableCell>
                      <TableCell>{subscriber.end_date}</TableCell>
                       <TableCell>{subscriber.used_data_gb ? `${parseFloat(subscriber.used_data_gb).toFixed(2)} GB` : '0.00 GB'}</TableCell>
                        <TableCell>
                          {Number(subscriber.fair_use_super_throttled) === 1 ? (
                            <Chip size="small" color="error" label="Super throttled" />
                          ) : Number(subscriber.fair_use_limit_gb) > 0 ? (
                            <Chip
                              size="small"
                              color={Number(subscriber.fair_use_throttled) === 1 ? 'warning' : 'success'}
                              label={Number(subscriber.fair_use_throttled) === 1 ? 'Throttled' : `${Number(subscriber.fair_use_limit_gb)} GB limit`}
                            />
                          ) : (
                            <Chip size="small" label="No limit" />
                          )}
                        </TableCell>
                      <TableCell>{subscriber.reg_by}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No subscribers found.
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
        </Paper>

        <Paper variant="outlined" sx={{ mt: 3, p: 2 }}>
          <Typography variant="h4" gutterBottom>Fair-use Review Required</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            These active accounts are throttled, but their current recorded usage is below the stored fair-use limit. Review their history before restoring normal speed.
          </Typography>
          {fairUseReview.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Subscriber</TableCell>
                    <TableCell>Current Usage</TableCell>
                    <TableCell>Limit</TableCell>
                    <TableCell>Throttled At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fairUseReview.map((subscriber) => (
                    <TableRow
                      hover
                      key={subscriber.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedClientUsername(subscriber.username)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') setSelectedClientUsername(subscriber.username);
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{subscriber.fullname || subscriber.username} ({subscriber.username})</TableCell>
                      <TableCell>{(Number(subscriber.current_usage_bytes) / (1024 * 1024 * 1024)).toFixed(2)} GB</TableCell>
                      <TableCell>{Number(subscriber.fair_use_limit_gb).toFixed(2)} GB</TableCell>
                      <TableCell>{new Date(subscriber.fair_use_throttled_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="success.main">No mismatched active fair-use throttles found.</Typography>
          )}
        </Paper>
        </>
      )}
      </MainCard>
    </>
  );
};

export default AdminSubscribers;
