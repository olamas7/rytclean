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
  Chip,
  Stack,
  useTheme,
  TextField,
  InputAdornment,
  Pagination
} from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import HostelOwnersDeskLink from './HostelOwnersDeskLink';
import axios from 'axios';
import { PeopleAltOutlined as PeopleIcon, BusinessOutlined as HostelIcon, Search as SearchIcon } from '@mui/icons-material';
import { useForm, FormProvider } from 'react-hook-form';
import { RHFAutocomplete } from 'utils/controls/ReactHookForms';

const HostelOwnerClients = () => {
  const theme = useTheme();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hostels, setHostels] = useState([{ id: '', label: 'All My Hostels' }]);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;
  const pageCount = Math.max(Math.ceil(clients.length / rowsPerPage), 1);
  const paginatedClients = clients.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
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

  const fetchClients = async (search = '', hostel = null) => {
    setLoading(true);
    try {
      const username = localStorage.getItem('userId');
      const response = await axios.get(`/api/api/agents/hostel-owner-clients`, {
        params: { username, search, hostelId: hostel?.id || undefined }
      });
      if (response.data.code === 1) {
        setClients(response.data.data);
        setPage(0);
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError('Failed to fetch clients.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchClients(searchQuery, selectedHostel);
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
                Total Members
              </Typography>
              <Typography variant="h3" color="primary">
                {clients.length}
              </Typography>
            </Box>
            <Avatar sx={{ bgcolor: theme.palette.primary.light, color: theme.palette.primary.main, width: 56, height: 56 }}>
              <PeopleIcon fontSize="large" />
            </Avatar>
          </Paper>
        </Grid>
      </Grid>

      <>
        <HostelOwnersDeskLink />
        <MainCard title={<Typography variant="h3">Hostel Members List</Typography>}>
        <FormProvider {...methods}>
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <HostelIcon color="primary" />
                <Typography variant="h4">Filter Members</Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <RHFAutocomplete name="hostel" control={control} options={hostels} label="Select Hostel" />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by name or phone number..."
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
        {loading && clients.length === 0 ? (
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
                    <TableCell sx={{ fontWeight: 'bold' }}>Member Info</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Contact</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Hostel</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Room</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clients.length > 0 ? (
                    paginatedClients.map((client, index) => (
                      <TableRow key={index} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar sx={{ bgcolor: theme.palette.secondary.light, color: theme.palette.secondary.main }}>
                              {client.fullname ? client.fullname.charAt(0) : '?'}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                {client.fullname}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {client.username}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{client.phone}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {client.email || 'No Email'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={client.hostel_name} size="small" variant="outlined" color="primary" sx={{ borderRadius: '6px' }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {client.room || 'N/A'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                        <Typography variant="h5" color="textSecondary">
                          No members found for your hostels.
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

export default HostelOwnerClients;
