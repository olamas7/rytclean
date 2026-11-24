import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Grid, IconButton, Paper, TextField, Tooltip, Typography } from '@mui/material';
import {
  AccountBalanceWalletOutlined,
  AccountCircleOutlined,
  EditCalendarOutlined,
  GroupsOutlined,
  HourglassBottomOutlined,
  SubscriptionsOutlined
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/en-gb';
import MainCard from 'ui-component/cards/MainCard';
import AdminSubscribers from './AdminSubscribers';

const cards = [
  { key: 'today_subscriptions', icon: SubscriptionsOutlined, accent: '#2563eb', soft: '#dbeafe', format: (value) => Number(value || 0).toLocaleString(), url: '/admins/subscribers' },
  { key: 'today_amount', icon: AccountBalanceWalletOutlined, accent: '#059669', soft: '#d1fae5', format: (value) => `GHS ${Number(value || 0).toFixed(2)}` },
  { key: 'month_amount', label: `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date())} Total Amount`, icon: AccountBalanceWalletOutlined, accent: '#0f766e', soft: '#ccfbf1', format: (value) => `GHS ${Number(value || 0).toFixed(2)}` },
  { key: 'expired_today', icon: HourglassBottomOutlined, accent: '#dc2626', soft: '#fee2e2', format: (value) => Number(value || 0).toLocaleString() },
  { key: 'active_subscriptions', label: 'Active Subscriptions', icon: GroupsOutlined, accent: '#7c3aed', soft: '#ede9fe', format: (value) => Number(value || 0).toLocaleString() }
];

const createMetricState = () => Object.fromEntries(cards.map((card) => [card.key, { status: 'loading', value: null, error: null }]));
const getLocalDateValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const SuperAdminDashboard = () => {
  const [metrics, setMetrics] = useState(createMetricState);
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getLocalDateValue);
  const [editingDate, setEditingDate] = useState(false);
  const issuedBy = localStorage.getItem('userId');
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    const loadMetrics = async () => {
      setMetrics(createMetricState());
      setMetricsLoaded(false);
      for (const card of cards) {
        try {
          const dateSpecific = ['today_subscriptions', 'today_amount', 'expired_today'].includes(card.key);
          const response = await axios.get(`/api/api/admins/super-admin-dashboard/${card.key}`, {
            params: { issuedBy, ...(dateSpecific ? { date: selectedDate } : {}) },
            signal: controller.signal
          });
          setMetrics((current) => ({ ...current, [card.key]: { status: 'ready', value: response.data.value, error: null } }));
        } catch (err) {
          if (controller.signal.aborted) return;
          setMetrics((current) => ({
            ...current,
            [card.key]: { status: 'error', value: null, error: err.response?.data?.error || 'Unavailable' }
          }));
        }
      }
      if (!controller.signal.aborted) setMetricsLoaded(true);
    };
    loadMetrics();
    return () => controller.abort();
  }, [issuedBy, selectedDate]);

  const dateLabel = dayjs(selectedDate).format('DD/MM/YYYY');
  const isToday = selectedDate === getLocalDateValue();
  const labels = {
    today_subscriptions: isToday ? "Today's Subscriptions" : `Subscriptions — ${dateLabel}`,
    today_amount: isToday ? "Today's Total Amount" : `Total Amount — ${dateLabel}`,
    month_amount: cards.find((card) => card.key === 'month_amount').label,
    expired_today: isToday ? 'Expiring Today' : `Expiring — ${dateLabel}`,
    active_subscriptions: 'Active Subscriptions'
  };

  return (
    <MainCard title={<Typography variant="h3">Super Admin Dashboard</Typography>}>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3, bgcolor: 'primary.lighter' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Typography variant="h4">{isToday ? 'Today at KayFi' : `KayFi on ${dateLabel}`}</Typography>
          <Tooltip title="View Client Dashboard">
            <IconButton aria-label="View Client Dashboard" size="small" onClick={() => navigate('/app?view=user')} sx={{ ml: 'auto' }}>
              <AccountCircleOutlined />
            </IconButton>
          </Tooltip>
          <IconButton size="small" aria-label="Choose dashboard date" onClick={() => setEditingDate((current) => !current)}>
            <EditCalendarOutlined fontSize="small" />
          </IconButton>
          {editingDate && (
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
              <DatePicker
                value={dayjs(selectedDate)}
                onChange={(date) => {
                  if (date?.isValid()) setSelectedDate(date.format('YYYY-MM-DD'));
                }}
                format="DD/MM/YYYY"
                slotProps={{ textField: { size: 'small', inputProps: { 'aria-label': 'Dashboard date' }, sx: { ml: 1, maxWidth: 180 } } }}
              />
            </LocalizationProvider>
          )}
        </Box>
        <Typography color="text.secondary">Subscription activity and account status at a glance.</Typography>
      </Paper>
      <Grid container spacing={2.5}>
        {cards.map((card) => {
          const Icon = card.icon;
          const metric = metrics[card.key];
          return (
            <Grid item xs={12} sm={6} lg={2.4} key={card.key}>
              <Paper
                variant="outlined"
                role={card.url ? 'button' : undefined}
                tabIndex={card.url ? 0 : undefined}
                onClick={card.url ? () => navigate(card.url) : undefined}
                onKeyDown={card.url ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') navigate(card.url);
                } : undefined}
                sx={{ p: 2, height: '100%', background: `linear-gradient(145deg, #ffffff 0%, ${card.soft} 180%)`, cursor: card.url ? 'pointer' : 'default' }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography color="text.secondary" fontWeight={700}>{labels[card.key]}</Typography>
                  <Box sx={{ bgcolor: card.soft, color: card.accent, borderRadius: 2, display: 'grid', placeItems: 'center', width: 36, height: 36 }}><Icon fontSize="small" /></Box>
                </Box>
                <Box sx={{ minHeight: 46, display: 'flex', alignItems: 'center' }} aria-live="polite">
                  {metric.status === 'loading' && <CircularProgress size={24} sx={{ color: card.accent }} />}
                  {metric.status === 'ready' && <Typography variant="h3" sx={{ color: card.accent }}>{card.format(metric.value)}</Typography>}
                  {metric.status === 'error' && <Typography variant="body2" color="error">{metric.error}</Typography>}
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
      {metricsLoaded && <Box sx={{ mt: 4 }}><AdminSubscribers embedded rowsPerPage={20} /></Box>}
    </MainCard>
  );
};

export default SuperAdminDashboard;
