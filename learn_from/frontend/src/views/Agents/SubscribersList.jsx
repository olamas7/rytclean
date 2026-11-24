import React, { useState, useEffect } from 'react';
import {
  Button,
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
  Chip,
  Pagination
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import MainCard from 'ui-component/cards/MainCard';
import axios from 'axios';
import PropTypes from 'prop-types';

import NewSubscriber from './NewSubscriber';
import MediumDialog from 'views/Hooks/dialogMedium';
import { SnackSuccess } from 'utils/Snackbars';
import SuperAdminDeskLink from '../Admins/SuperAdminDeskLink';
import AgentsDeskLink from './AgentsDeskLink';

const SubscribersList = ({ agentView }) => {
  const [subscribers, setSubscribers] = useState([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;
  const pageCount = Math.max(Math.ceil(totalSubscribers / rowsPerPage), 1);
  const formatAmount = (amount) => `GHS ${Number(amount || 0).toFixed(2)}`;

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSuccess = (message) => {
    setOpenDialog(false);
    setSuccessMessage(message);
    setRefreshTrigger((prev) => prev + 1); // Trigger refresh
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage - 1);
  };

  useEffect(() => {
    const fetchSubscribers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`/api/api/agents/subscribers`, {
          params: {
            search: searchQuery,
            page: page + 1
          }
        });
        setSubscribers(response.data.subscribers);
        setTotalSubscribers(response.data.totalSubscribers);
      } catch (err) {
        setError('Failed to fetch subscribers.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const handler = setTimeout(() => {
      fetchSubscribers();
    }, 500); // Debounce search input

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, page, refreshTrigger]);

  return (
    <>
      {agentView ? <AgentsDeskLink /> : <SuperAdminDeskLink />}
      <MainCard
      title={
        <Grid container justifyContent="space-between" alignItems="center">
          <Grid item>
            <Typography variant="h3">{agentView ? 'Subscribers' : 'Subscribers List'}</Typography>
          </Grid>
          <Grid item>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
              Add Subscriber
            </Button>
          </Grid>
        </Grid>
      }
    >
      <SnackSuccess open={!!successMessage} setOpen={() => setSuccessMessage('')} message={successMessage} />
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12}>
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
      </Grid>

      {loading ? (
        <Typography>Loading subscribers...</Typography>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
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
                  <TableCell>Fair-use Status</TableCell>
                  <TableCell>Registered By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subscribers.length > 0 ? (
                  subscribers.map((subscriber) => (
                    <TableRow key={subscriber.id}>
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
                            label={Number(subscriber.fair_use_throttled) === 1 ? 'Throttled' : 'Normal speed'}
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
      )}

      <MediumDialog open={openDialog} onClose={handleCloseDialog}>
        <NewSubscriber onSuccess={handleSuccess} />
      </MediumDialog>
      </MainCard>
    </>
  );
};

SubscribersList.propTypes = {
  agentView: PropTypes.bool
};

export default SubscribersList;
