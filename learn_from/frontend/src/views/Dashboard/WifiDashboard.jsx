import {
  Grid,
  Typography,
  Box,
  Chip,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Button,
  useTheme,
  Fab,
  Paper,
  LinearProgress
} from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { SnackError, SnackSuccess } from 'utils/Snackbars';
import PropTypes from 'prop-types';
import MediumDialog from 'views/Hooks/dialogMedium';
import NewSubscriber from 'views/Agents/NewSubscriber';
import SuperAdminDashboard from 'views/Admins/SuperAdminDashboard';
import {
  Wifi as WifiIcon,
  AccessTime as TimeIcon,
  ReceiptLong as ReceiptIcon,
  Person as PersonIcon,
  ContactSupport as SupportIcon,
  LockReset as PasswordIcon,
  AddShoppingCart as ShopIcon,
  Groups as GroupsIcon,
  ArrowBack as ArrowBackIcon,
  Paid as PaidIcon,
  AccountBalanceWallet as WalletIcon,
  TrendingUp as TrendingUpIcon,
  PersonAdd as PersonAddIcon,
  DataUsage as DataUsageIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';

export default function WifiDashboard() {
  const theme = useTheme();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [username, setUsername] = useState('');
  const [, setTick] = useState(0);
  const [adminStats, setAdminStats] = useState({
    collectedRevenue: 0,
    pendingRevenue: 0,
    recentPayments: 0
  });
  const [adminDashboardLoading, setAdminDashboardLoading] = useState(true);
  const [openAdminSubscriberDialog, setOpenAdminSubscriberDialog] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const userPermissions = String(localStorage.getItem('userPermissions') || '');
  const permissions = (userPermissions.match(/\d+/g) || []).map((permission) => Number(permission));
  const isUserView = new URLSearchParams(location.search).get('view') === 'user';
  const isMainAdmin = !isUserView && permissions.includes(13);
  const canManageSubscribers = permissions.includes(64);

  const formatAmount = (amount) => `GHS ${Number(amount || 0).toFixed(2)}`;

  const fetchAdminStatistics = async () => {
    setAdminDashboardLoading(true);
    setError(null);
    try {
      const [collectedRevenueResponse, pendingRevenueResponse] = await Promise.all([
        axios.get(`/api/api/admins/admin-revenue-report`),
        axios.get(`/api/api/admins/revenue-report`)
      ]);

      setAdminStats((current) => ({
        ...current,
        collectedRevenue: collectedRevenueResponse.data.stats?.totalAmountCollected || 0,
        pendingRevenue: pendingRevenueResponse.data.stats?.totalAmountCollected || 0,
        recentPayments: collectedRevenueResponse.data.stats?.totalSubscriptions || 0
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching admin dashboard statistics.');
    } finally {
      setAdminDashboardLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = localStorage.getItem('userId');
      if (!user) {
        setError('Phone number not found.');
        return;
      }
      setUsername(user);
      const response = await axios.post(`/api/api/wifi/dashboard`, { username: user });
      setDashboardData(response.data);
    } catch (err) {
      setError('Error fetching data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isMainAdmin) {
      fetchDashboardData();
    }
  }, [isMainAdmin]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  if (isMainAdmin) return <SuperAdminDashboard />;

  // Helpers
  const calculateTimeLeft = (rawDate, formattedDate) => {
    if (!rawDate) return 'N/A';
    const end = new Date(rawDate);
    const now = new Date();
    if (end < now) return 'Expired';

    const diffMs = end.getTime() - now.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (diffMs > oneDayMs) {
      return formattedDate;
    }

    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHrs > 0) return `${diffHrs}h ${diffMins}m left`;
    return `${diffMins}m left`;
  };

  if (loading) {
    return (
      <MainCard title="WiFi Dashboard">
        <Typography>Loading...</Typography>
      </MainCard>
    );
  }

  if (error) {
    return (
      <MainCard title="WiFi Dashboard">
        <Typography color="error">{error}</Typography>
      </MainCard>
    );
  }

  if (isMainAdmin) {
    const adminActionMenus = [
      ...(canManageSubscribers ? [{
        title: 'Subscribers',
        caption: 'Open Super Admin subscriber management',
        icon: GroupsIcon,
        color: theme.palette.primary.dark,
        onClick: () => navigate('/admins/subscribers')
      }] : []),
      {
        title: 'Add Subscriber',
        caption: 'Create a new subscription',
        icon: PersonAddIcon,
        color: theme.palette.success.dark,
        onClick: () => setOpenAdminSubscriberDialog(true)
      },
      {
        title: 'Client List',
        caption: 'Manage registered clients',
        icon: PersonIcon,
        color: theme.palette.primary.main,
        onClick: () => navigate('/admins/clients')
      },
      {
        title: 'User Dashboard',
        caption: 'Open the standard subscriber view',
        icon: PersonIcon,
        color: theme.palette.warning.dark,
        onClick: () => navigate('/app?view=user')
      },
      {
        title: 'Revenue Reports',
        caption: 'Review received payments',
        icon: PaidIcon,
        color: theme.palette.secondary.main,
        onClick: () => navigate('/admins/revenue-report')
      }
    ];
    const adminCards = [
      {
        title: 'Collected Revenue',
        value: formatAmount(adminStats.collectedRevenue),
        caption: 'Revenue already marked received',
        icon: PaidIcon,
        color: theme.palette.success.dark,
        background: 'linear-gradient(135deg, #e8f5e9 0%, #ffffff 100%)'
      },
      {
        title: 'Pending Revenue',
        value: formatAmount(adminStats.pendingRevenue),
        caption: 'Revenue waiting to be received',
        icon: WalletIcon,
        color: theme.palette.warning.dark,
        background: 'linear-gradient(135deg, #fff8e1 0%, #ffffff 100%)'
      },
      {
        title: 'Received Payments',
        value: adminStats.recentPayments,
        caption: 'Historical received subscriptions',
        icon: TrendingUpIcon,
        color: theme.palette.secondary.main,
        background: 'linear-gradient(135deg, #f3e5f5 0%, #ffffff 100%)'
      }
    ];

    return (
      <Box sx={{ pb: 4 }}>
        <Box
          sx={{
            mb: 3,
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            color: '#fff',
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, #0097a7 100%)`,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: theme.shadows[6]
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h2" color="inherit" gutterBottom>
              Admin Command Center
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: 680, opacity: 0.9 }}>
              Monitor active subscriptions, revenue movement, and customer activity from one dashboard.
            </Typography>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              right: -60,
              top: -60,
              width: 220,
              height: 220,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.13)'
            }}
          />
        </Box>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          {adminCards.map((card) => {
            const Icon = card.icon;
            return (
              <Grid item xs={12} sm={6} lg={3} key={card.title}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    height: '100%',
                    borderRadius: 3,
                    border: `1px solid ${theme.palette.divider}`,
                    background: card.background
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                        {card.title}
                      </Typography>
                      <Typography variant="h3" sx={{ mt: 0.75, color: card.color }}>
                        {card.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        {card.caption}
                      </Typography>
                    </Box>
                    <Avatar sx={{ width: 52, height: 52, bgcolor: `${card.color}18`, color: card.color }}>
                      <Icon />
                    </Avatar>
                  </Stack>
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        <MainCard title="Quick Admin Actions" sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            {adminActionMenus.map((menu) => {
              const Icon = menu.icon;
              return (
                <Grid item xs={12} sm={6} lg={3} key={menu.title}>
                  <Paper
                    elevation={0}
                    onClick={menu.onClick}
                    sx={{
                      p: 2,
                      height: '100%',
                      cursor: 'pointer',
                      borderRadius: 3,
                      border: `1px solid ${theme.palette.divider}`,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: theme.shadows[4],
                        borderColor: menu.color
                      }
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: `${menu.color}16`, color: menu.color, width: 44, height: 44, borderRadius: 2 }}>
                        <Icon fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography variant="h5">{menu.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {menu.caption}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </MainCard>

        <MediumDialog open={openAdminSubscriberDialog} onClose={() => setOpenAdminSubscriberDialog(false)}>
          <NewSubscriber
            onSuccess={(message) => {
              setOpenAdminSubscriberDialog(false);
              setSuccess(message);
              fetchAdminStatistics();
            }}
          />
        </MediumDialog>

        <SnackSuccess open={!!success} setOpen={setSuccess} message={success} />
        <SnackError open={!!error} setOpen={setError} message={error} />
      </Box>
    );
  }

  if (!dashboardData) {
    return (
      <MainCard title="WiFi Dashboard">
        <Typography>No data available.</Typography>
      </MainCard>
    );
  }

  const fairUseLimitGb = Number(dashboardData.fairUseLimitGb || 0);
  const fairUseUsedGb = Number(dashboardData.dataUsedVal || 0);
  const fairUseUsagePercent = fairUseLimitGb > 0 ? Math.min((fairUseUsedGb / fairUseLimitGb) * 100, 100) : 0;
  const serviceMode = dashboardData.planStatus !== 'Active'
    ? { label: 'No Active Plan', color: theme.palette.grey[700], background: theme.palette.grey[100], message: 'Buy a plan to get connected.' }
    : dashboardData.fairUseSuperThrottled
      ? { label: 'Speed Restricted', color: theme.palette.error.dark, background: theme.palette.error.light, message: 'A temporary speed restriction is currently applied. You remain connected until your plan expires.' }
      : dashboardData.fairUseThrottled
        ? { label: 'Fair-Use Speed Applied', color: theme.palette.warning.dark, background: theme.palette.warning.light, message: 'Your fair-use allowance has been used. You remain connected until your plan expires.' }
        : { label: 'Normal Speed', color: theme.palette.success.dark, background: theme.palette.success.light, message: 'Your connection is running at normal speed.' };

  const QuickAction = ({ icon: Icon, label, color, onClick }) => (
    <Grid item xs={3}>
      <Box
        onClick={onClick}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer',
          p: 1,
          borderRadius: 2,
          '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' }
        }}
      >
        <Avatar
          sx={{
            bgcolor: `${color}15`,
            color: color,
            width: { xs: 40, sm: 48 },
            height: { xs: 40, sm: 48 },
            mb: 1,
            borderRadius: '14px'
          }}
        >
          <Icon fontSize="small" />
        </Avatar>
        <Typography
          variant="caption"
          sx={{ fontWeight: '600', textAlign: 'center', fontSize: { xs: '0.65rem', sm: '0.75rem' }, lineHeight: 1.2 }}
        >
          {label}
        </Typography>
      </Box>
    </Grid>
  );

  QuickAction.propTypes = {
    icon: PropTypes.elementType.isRequired,
    label: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired
  };

  return (
    <Box sx={{ pb: 8 }}>
      {/* Header Greeting */}
      <Box sx={{ mb: 3 }}>
        {isUserView && permissions.includes(13) && (
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/app')} sx={{ mb: 2 }}>
            Back to Super Admin Dashboard
          </Button>
        )}
        <Typography variant="h2" gutterBottom>
          Hi, {dashboardData.fullname || username} 👋
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Welcome back to KayFi
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Status Card - Mobile First: Shows Status & Usage */}
        <Grid item xs={12} md={7}>
          <MainCard sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
            <Box sx={{ p: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h3" color="primary">
                  {dashboardData.planSubs || 'No Active Plan'}
                </Typography>
                <Chip
                  label={dashboardData.planStatus}
                  color={dashboardData.planStatus === 'Active' ? 'success' : 'error'}
                  variant="filled"
                  size="small"
                />
              </Box>

              {/* Metrics Grid */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Avatar sx={{ bgcolor: theme.palette.grey[100], color: theme.palette.grey[700], width: 32, height: 32 }}>
                      <TimeIcon fontSize="small" />
                    </Avatar>
                    <Typography variant="body2" color="textSecondary">
                      Time Left
                    </Typography>
                  </Stack>
                  <Typography variant="h4">{calculateTimeLeft(dashboardData.rawEndDate, dashboardData.endDate)}</Typography>
                </Grid>

                <Grid item xs={6}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Avatar sx={{ bgcolor: theme.palette.grey[100], color: theme.palette.grey[700], width: 32, height: 32 }}>
                      <WifiIcon fontSize="small" />
                    </Avatar>
                    <Typography variant="body2" color="textSecondary">
                      Plan Type
                    </Typography>
                  </Stack>
                  <Typography variant="h4">Unlimited</Typography>
                </Grid>
              </Grid>

              <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: serviceMode.background, border: `1px solid ${serviceMode.color}33` }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar sx={{ bgcolor: '#fff', color: serviceMode.color, width: 34, height: 34 }}>
                    <SpeedIcon fontSize="small" />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ color: serviceMode.color, fontWeight: 700 }}>
                      {serviceMode.label}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {serviceMode.message}
                    </Typography>
                  </Box>
                </Stack>

                {fairUseLimitGb > 0 && dashboardData.planStatus === 'Active' && (
                  <Box sx={{ mt: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <DataUsageIcon sx={{ color: serviceMode.color, fontSize: 18 }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Fair-use data</Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {fairUseUsedGb.toFixed(2)} / {fairUseLimitGb.toFixed(2)} GB
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={fairUseUsagePercent}
                      sx={{ height: 8, borderRadius: 4, bgcolor: '#fff', '& .MuiLinearProgress-bar': { bgcolor: serviceMode.color } }}
                    />
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.75 }}>
                      Data used during this active package. After the allowance is used, your speed is managed while your plan stays active.
                    </Typography>
                    <Typography variant="caption" color="primary" onClick={() => navigate('/fair-use-policy')} sx={{ display: 'inline-block', mt: 0.5, cursor: 'pointer', fontWeight: 700 }}>
                      View Fair Use Policy
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </MainCard>
        </Grid>

        {/* Action Center - Big Buy Button + Quick Actions */}
        <Grid item xs={12} md={5}>
          <MainCard sx={{ height: '100%' }}>
            {/* Prominent Buy Button */}
            <Box
              onClick={() => navigate('/purchase')}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                borderRadius: 3,
                p: 3,
                mb: 3,
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: theme.shadows[4],
                transition: 'transform 0.2s',
                '&:hover': { transform: 'scale(1.02)' }
              }}
            >
              <Box>
                <Typography variant="h3" color="inherit" gutterBottom>
                  Buy Data Plan
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffeb3b', fontWeight: '500' }}>
                  Tap to get connected instantly
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'white', color: theme.palette.primary.main, width: 48, height: 48 }}>
                <WifiIcon />
              </Avatar>
            </Box>

            {/* Quick Actions Grid */}
            <Typography variant="h5" sx={{ mb: 2, px: 1 }}>
              Quick Actions
            </Typography>
            <Grid container spacing={1}>
              <QuickAction icon={WifiIcon} label="Buy WiFi" color={theme.palette.primary.main} onClick={() => navigate('/purchase')} />
              <QuickAction
                icon={PersonIcon}
                label="Update Profile"
                color="#880e4f" // Wine
                onClick={() => navigate('/user-profile')}
              />
              <QuickAction
                icon={PasswordIcon}
                label="Change Password"
                color={theme.palette.secondary.main}
                onClick={() => navigate('/user-profile')}
              />
              <QuickAction icon={SupportIcon} label="Support" color={theme.palette.success.main} onClick={() => navigate('/contact-us')} />
            </Grid>
          </MainCard>
        </Grid>

        {/* Transactions Card */}
        <Grid item xs={12}>
          <MainCard title="Recent Transactions" content={false}>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dashboardData.transactions && dashboardData.transactions.length > 0 ? (
                    dashboardData.transactions.map((tx) => (
                      <TableRow key={tx.id} hover>
                        <TableCell>
                          <Typography variant="subtitle1" color="primary">
                            {tx.amount}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="textSecondary">
                            {tx.date}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={tx.status}
                            size="small"
                            color={tx.status === 'Active' ? 'success' : 'default'}
                            variant="filled"
                            sx={{ height: 20, fontSize: '0.75rem' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Box sx={{ py: 3 }}>
                          <ReceiptIcon sx={{ fontSize: 40, color: theme.palette.grey[300], mb: 1 }} />
                          <Typography color="textSecondary">No recent transactions</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </MainCard>
        </Grid>
      </Grid>

      {/* Floating Action Button for Mobile */}
      <Fab
        color="primary"
        aria-label="buy"
        onClick={() => navigate('/purchase')}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          boxShadow: theme.shadows[10],
          zIndex: 9999
        }}
      >
        <ShopIcon />
      </Fab>

      <SnackSuccess open={!!success} setOpen={setSuccess} message={success} />
      <SnackError open={!!error} setOpen={setError} message={error} />
    </Box>
  );
}
