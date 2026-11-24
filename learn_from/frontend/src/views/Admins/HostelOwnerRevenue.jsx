import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { ApartmentOutlined, GroupsOutlined, PaidOutlined, QueryStatsOutlined } from '@mui/icons-material';
import MainCard from 'ui-component/cards/MainCard';
import HostelOwnersDeskLink from './HostelOwnersDeskLink';
import axios from 'axios';
import { SnackError } from 'utils/Snackbars';
import { useForm, FormProvider } from 'react-hook-form';
import { RHFAutocomplete } from 'utils/controls/ReactHookForms';

const formatDate = (date) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
};

const statCards = [
  {
    key: 'totalSubscribers',
    label: 'Total Subscribers',
    icon: GroupsOutlined,
    color: '#2563eb',
    soft: '#dbeafe',
    format: (value) => Number(value || 0).toLocaleString()
  },
  {
    key: 'commission',
    label: 'Owner Commission (10%)',
    icon: PaidOutlined,
    color: '#059669',
    soft: '#d1fae5',
    format: (value) => `GHS ${Number(value || 0).toFixed(2)}`
  }
];

const HostelOwnerRevenue = () => {
  const [revenueData, setRevenueData] = useState([]);
  const [stats, setStats] = useState({ totalSubscribers: 0, totalAmountCollected: 0 });
  const [period, setPeriod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hostels, setHostels] = useState([]);
  const [page, setPage] = useState(0);
  const rowsPerPage = 50;
  const pageCount = Math.max(Math.ceil(revenueData.length / rowsPerPage), 1);
  const paginatedRevenueData = revenueData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const methods = useForm({ defaultValues: { hostel: { id: '', label: 'All My Hostels' } } });
  const { control, handleSubmit } = methods;

  useEffect(() => {
    const fetchMyHostels = async () => {
      const username = localStorage.getItem('userId');
      try {
        const res = await axios.get(`/api/api/admins/user-hostels/${username}`);
        if (res.data.code === 1) {
          setHostels([{ id: '', label: 'All My Hostels' }, ...res.data.data.map((h) => ({ id: h.id, label: h.name }))]);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load your hostels.');
      }
    };
    fetchMyHostels();
  }, []);

  const fetchRevenueReport = async (data = {}) => {
    setLoading(true);
    setError(null);
    setPage(0);
    try {
      const username = localStorage.getItem('userId');
      const params = { username };
      if (data.hostel?.id) params.hostelId = data.hostel.id;
      const response = await axios.get('/api/api/admins/hostel-owner-revenue', { params });
      if (response.data.code === 1) {
        setRevenueData(response.data.data || []);
        setStats(response.data.stats || { totalSubscribers: 0, totalAmountCollected: 0 });
        setPeriod(response.data.period || null);
      } else {
        setError(response.data.message || 'Failed to fetch revenue report.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch revenue report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenueReport({});
  }, []);

  const commission = Number(stats.totalAmountCollected || 0) * 0.1;

  return (
    <>
      <HostelOwnersDeskLink />
      <MainCard title={<Typography variant="h3">Hostel Revenue</Typography>}>
        <SnackError open={!!error} setOpen={() => setError(null)} message={error} />

        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 3 },
            mb: 3,
            borderColor: '#bfdbfe',
            background: 'linear-gradient(120deg, #eff6ff 0%, #f8fafc 65%, #ecfdf5 100%)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Avatar sx={{ bgcolor: '#dbeafe', color: '#1d4ed8' }}>
              <QueryStatsOutlined />
            </Avatar>
            <Box>
              <Typography variant="h4">Revenue summary</Typography>
              <Typography variant="body2" color="text.secondary">
                {period?.dateFrom && period?.dateTo
                  ? `System reporting period: ${formatDate(period.dateFrom)} – ${formatDate(period.dateTo)}`
                  : 'The system administrator has not set a reporting period yet.'}
              </Typography>
            </Box>
          </Box>

          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(fetchRevenueReport)}>
              <Grid container spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={8} md={6}>
                  <RHFAutocomplete name="hostel" control={control} options={hostels} label="Select Hostel" />
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <Chip
                    icon={<ApartmentOutlined />}
                    label={
                      period?.dateFrom && period?.dateTo
                        ? `${formatDate(period.dateFrom)} – ${formatDate(period.dateTo)}`
                        : 'Period not set'
                    }
                    variant="outlined"
                    sx={{ maxWidth: '100%', bgcolor: 'background.paper', height: 40 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ minHeight: 40 }}>
                    View Report
                  </Button>
                </Grid>
              </Grid>
            </form>
          </FormProvider>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              {statCards.map((card) => {
                const Icon = card.icon;
                const value = card.key === 'commission' ? commission : stats[card.key];
                return (
                  <Grid item xs={12} sm={6} key={card.key}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: { xs: 2, sm: 2.5 },
                        height: '100%',
                        borderColor: `${card.color}30`,
                        background: `linear-gradient(135deg, #fff 0%, ${card.soft} 150%)`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2
                      }}
                    >
                      <Avatar sx={{ bgcolor: card.soft, color: card.color, width: 52, height: 52 }}>
                        <Icon />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" color="text.secondary" fontWeight={700}>
                          {card.label}
                        </Typography>
                        <Typography variant="h3" sx={{ color: card.color, mt: 0.5 }}>
                          {card.format(value)}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table sx={{ minWidth: 650 }} aria-label="hostel revenue table">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Subscriber</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Hostel</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Payment Mode</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Subscription Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedRevenueData.length > 0 ? (
                    paginatedRevenueData.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.subscriber_name}</TableCell>
                        <TableCell>{row.hostel_name}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>GHS {Number(row.plan_amount || 0).toFixed(2)}</TableCell>
                        <TableCell>{row.mode_of_payment}</TableCell>
                        <TableCell>{row.payment_date}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <Typography fontWeight={700}>No revenue found for this period</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Try another hostel or check back after the system reporting period is set.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {revenueData.length > rowsPerPage && (
              <Pagination
                count={pageCount}
                page={page + 1}
                onChange={(_, newPage) => setPage(newPage - 1)}
                color="primary"
                showFirstButton
                showLastButton
                sx={{ display: 'flex', justifyContent: 'center', p: 2 }}
              />
            )}
          </>
        )}
      </MainCard>
    </>
  );
};

export default HostelOwnerRevenue;
