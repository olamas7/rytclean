import React, { useState, useEffect } from 'react';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Grid,
  CircularProgress,
  Avatar,
  Stack,
  useTheme,
  TextField,
  InputAdornment,
  Pagination
} from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import HostelOwnersDeskLink from './HostelOwnersDeskLink';
import axios from 'axios';
import { WifiOutlined as WifiIcon, Search as SearchIcon, UpdateOutlined as TimeIcon } from '@mui/icons-material';
import { useForm, FormProvider } from 'react-hook-form';
import { RHFAutocomplete } from 'utils/controls/ReactHookForms';

const HostelOwnerSubscribers = () => {
  const theme = useTheme();
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hostels, setHostels] = useState([{ id: '', label: 'All My Hostels' }]);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;
  const pageCount = Math.max(Math.ceil(subscribers.length / rowsPerPage), 1);
  const paginatedSubscribers = subscribers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const methods = useForm({ defaultValues: { hostel: { id: '', label: 'All My Hostels' } } });
  const { control, watch, setValue } = methods;
  const selectedHostel = watch('hostel');

  useEffect(() => {
    const fetchMyHostels = async () => {
      const username = localStorage.getItem('userId');
      try {
        const response = await axios.get(`/api/api/admins/user-hostels/${username}`);
        if (response.data.code === 1) {
          const hostelOptions = [
            { id: '', label: 'All My Hostels' },
            ...response.data.data.map((hostel) => ({ id: hostel.id, label: hostel.name }))
          ];
          setHostels(hostelOptions);
          setValue('hostel', hostelOptions[0]);
        }
      } catch (err) {
        setError('Failed to fetch assigned hostels.');
        console.error(err);
      }
    };
    fetchMyHostels();
  }, [setValue]);

  const fetchSubscribers = async (search = '', hostel = null) => {
    setLoading(true);
    try {
      const username = localStorage.getItem('userId');
      const response = await axios.get(`/api/api/agents/hostel-owner-subscribers`, {
        params: { username, search, hostelId: hostel?.id || undefined }
      });
      if (response.data.code === 1) {
        setSubscribers(response.data.data);
        setPage(0);
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError('Failed to fetch active subscribers.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchSubscribers(searchQuery, selectedHostel);
    }, 500); // Debounce search

    return () => clearTimeout(handler);
  }, [searchQuery, selectedHostel]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage - 1);
  };

  return (
    <Box>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fff',
              color: theme.palette.text.primary,
              borderRadius: '12px',
              border: `1px solid ${theme.palette.divider}`
            }}
          >
            <Box>
              <Typography variant="h6" color="textSecondary">
                Active Subscribers
              </Typography>
              <Typography variant="h3" color="primary">
                {subscribers.length}
              </Typography>
            </Box>
            <Avatar sx={{ bgcolor: theme.palette.success.light, color: theme.palette.success.dark, width: 56, height: 56 }}>
              <WifiIcon fontSize="large" />
            </Avatar>
          </Paper>
        </Grid>
      </Grid>

      <>
        <HostelOwnersDeskLink />
        <MainCard title={<Typography variant="h3">Current Active Subscribers</Typography>}>
        <FormProvider {...methods}>
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <WifiIcon color="primary" />
                <Typography variant="h4">Filter Subscribers</Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <RHFAutocomplete name="hostel" control={control} options={hostels} label="Select Hostel" />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search subscriber..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>
        </FormProvider>
        {loading && subscribers.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" align="center">
            {error}
          </Typography>
        ) : (
          <>
            <TableContainer component={Paper} elevation={0}>
              <Table sx={{ minWidth: 650 }} size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: theme.palette.grey[50] }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Subscriber</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Hostel</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Subscription Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Start Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Expires At</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Data Used</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subscribers.length > 0 ? (
                    paginatedSubscribers.map((sub, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar sx={{ bgcolor: theme.palette.primary.light, color: theme.palette.primary.main }}>
                              {sub.name ? sub.name.split(' (')[1]?.charAt(0) : '?'}
                            </Avatar>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              {sub.name}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{sub.hostel_name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">GHS {Number(sub.plan_amount || 0).toFixed(2)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{sub.subscription_date || 'N/A'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{sub.start_date}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <TimeIcon fontSize="small" color="action" />
                            <Typography variant="body2">{sub.end_date}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {sub.used_data_gb ? `${parseFloat(sub.used_data_gb).toFixed(2)} GB` : '0.00 GB'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                        <Typography variant="h5" color="textSecondary">
                          No active subscribers found in your hostels.
                        </Typography>
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
    </Box>
  );
};

export default HostelOwnerSubscribers;
