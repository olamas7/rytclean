import React, { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Grid, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import { ArrowBackOutlined, HistoryOutlined, ManageAccountsOutlined, SearchOutlined } from '@mui/icons-material';
import axios from 'axios';
import MainCard from 'ui-component/cards/MainCard';
import SuperAdminDeskLink from './SuperAdminDeskLink';

const statusColor = (status) => {
  if (status === 'Active') return 'success';
  if (status === 'Expired') return 'default';
  return 'warning';
};

const ClientHistory = ({ clientUsername = null, inline = false, onBack, onManageSubscription, showPassword = false }) => {
  const issuedBy = localStorage.getItem('userId');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [history, setHistory] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSelectedClient(clientUsername ? { username: clientUsername } : null);
  }, [clientUsername]);

  useEffect(() => {
    if (clientUsername) return undefined;
    if (search.trim().length < 2) {
      setOptions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const response = await axios.get('/api/api/admins/client-history/search', {
          params: { issuedBy, search },
          signal: controller.signal
        });
        setOptions(response.data || []);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.response?.data?.error || 'Failed to search clients.');
      } finally {
        if (!controller.signal.aborted) setLoadingSearch(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search, issuedBy]);

  useEffect(() => {
    if (!selectedClient) {
      setHistory(null);
      return undefined;
    }
    const controller = new AbortController();
    const loadHistory = async () => {
      setLoadingHistory(true);
      setError(null);
      try {
        const response = await axios.get(`/api/api/admins/client-history/${encodeURIComponent(selectedClient.username)}`, {
          params: { issuedBy },
          signal: controller.signal
        });
        setHistory(response.data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.response?.data?.error || 'Failed to load client history.');
      } finally {
        if (!controller.signal.aborted) setLoadingHistory(false);
      }
    };
    loadHistory();
    return () => controller.abort();
  }, [selectedClient, issuedBy]);

  return (
    <>
      {!inline && <SuperAdminDeskLink />}
      <MainCard title={<Typography variant="h3">{inline ? 'Client Details' : 'Client History'}</Typography>}>
        {inline && <Button size="small" startIcon={<ArrowBackOutlined />} onClick={onBack} sx={{ mb: 2 }}>Back to subscribers</Button>}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {!clientUsername && <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: 'primary.lighter' }}>
          <Typography variant="h4" gutterBottom>Find a client</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Search by name, phone number, or account number to view every subscription record.</Typography>
          <Autocomplete
            fullWidth
            options={options}
            value={selectedClient}
            onChange={(_, value) => setSelectedClient(value)}
            inputValue={search}
            onInputChange={(_, value) => setSearch(value)}
            loading={loadingSearch}
            getOptionLabel={(option) => `${option.fullname || 'Guest'} (${option.username})`}
            isOptionEqualToValue={(option, value) => option.username === value.username}
            noOptionsText={search.trim().length < 2 ? 'Enter at least two characters.' : 'No clients found.'}
            renderOption={(props, option) => <li {...props} key={option.username}><Box><Typography>{option.fullname || 'Guest'}</Typography><Typography variant="caption" color="text.secondary">{option.username}{option.hostel ? ` | ${option.hostel}` : ''}</Typography></Box></li>}
            renderInput={(params) => <TextField {...params} label="Search client" placeholder="Name or phone number" InputProps={{ ...params.InputProps, startAdornment: <SearchOutlined sx={{ color: 'text.secondary', mr: 1 }} />, endAdornment: <>{loadingSearch ? <CircularProgress size={18} /> : null}{params.InputProps.endAdornment}</> }} />}
          />
        </Paper>}

        {!selectedClient && !clientUsername && <Paper variant="outlined" sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}><HistoryOutlined sx={{ fontSize: 42, mb: 1 }} /><Typography>Select a client to view subscription history.</Typography></Paper>}
        {loadingHistory && <Box sx={{ display: 'flex', justifyContent: 'center', py: 7 }}><CircularProgress /></Box>}
        {history && !loadingHistory && (
          <>
            <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}><Typography variant="caption" color="text.secondary">CLIENT</Typography><Typography variant="h4">{history.client.fullname || 'Guest'}</Typography><Typography>{history.client.username}</Typography></Grid>
                <Grid item xs={12} sm={3}><Typography variant="caption" color="text.secondary">CONTACT</Typography><Typography>{history.client.phone || '-'}</Typography><Typography variant="body2" color="text.secondary">{history.client.email || '-'}</Typography></Grid>
                <Grid item xs={12} sm={3}><Typography variant="caption" color="text.secondary">LOCATION</Typography><Typography>{history.client.hostel || '-'}</Typography><Typography variant="body2" color="text.secondary">Room: {history.client.room || '-'}</Typography></Grid>
                <Grid item xs={12} sm={3}><Typography variant="caption" color="text.secondary">REGISTERED</Typography><Typography>{history.client.registered_at || '-'}</Typography>{showPassword && <><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>PASSWORD</Typography><Typography fontWeight={700}>{history.client.password || '-'}</Typography></>}</Grid>
              </Grid>
              {onManageSubscription && <Button variant="contained" size="small" startIcon={<ManageAccountsOutlined />} disabled={!history.subscriptions.some((subscription) => subscription.subscription_status === 'Active')} onClick={() => onManageSubscription(history.subscriptions.find((subscription) => subscription.subscription_status === 'Active')?.id)} sx={{ mt: 2 }}>Manage Active Subscription</Button>}
            </Paper>
            <Typography variant="h4" sx={{ mb: 1.5 }}>Subscription History ({history.subscriptions.length})</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" sx={{ minWidth: 1100 }}>
                <TableHead><TableRow><TableCell>Status</TableCell><TableCell>Plan</TableCell><TableCell>Amount</TableCell><TableCell>Paid by</TableCell><TableCell>Method</TableCell><TableCell>Payment date</TableCell><TableCell>Start</TableCell><TableCell>End</TableCell><TableCell>Fair-use</TableCell><TableCell>Reference</TableCell></TableRow></TableHead>
                <TableBody>
                  {history.subscriptions.length === 0 ? <TableRow><TableCell colSpan={10} align="center">No subscription history found.</TableCell></TableRow> : history.subscriptions.map((subscription) => <TableRow key={subscription.id}>
                    <TableCell><Chip size="small" color={statusColor(subscription.subscription_status)} label={subscription.subscription_status} /></TableCell>
                    <TableCell>{subscription.plan_name || 'Custom subscription'}</TableCell><TableCell>GHS {Number(subscription.plan_amount || 0).toFixed(2)}</TableCell><TableCell>{subscription.paid_by || '-'}</TableCell><TableCell>{subscription.payment_method || '-'}</TableCell><TableCell>{subscription.payment_date || '-'}</TableCell><TableCell>{subscription.start_date || '-'}</TableCell><TableCell>{subscription.end_date || '-'}</TableCell><TableCell>{Number(subscription.fair_use_limit_gb || 0).toFixed(2)} GB</TableCell><TableCell sx={{ maxWidth: 160, overflowWrap: 'anywhere' }}>{subscription.payment_ref || '-'}</TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </MainCard>
    </>
  );
};

export default ClientHistory;
