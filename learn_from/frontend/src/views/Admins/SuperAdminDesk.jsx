import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import {
  AccountBalanceWalletOutlined,
  ArrowForwardOutlined,
  ApartmentOutlined,
  AssessmentOutlined,
  GroupsOutlined,
  ManageAccountsOutlined,
  PaymentsOutlined,
  PersonAddAltOutlined,
  RedeemOutlined,
  SmsOutlined,
  ChatOutlined,
  HistoryOutlined,
  SpeedOutlined
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MainCard from 'ui-component/cards/MainCard';

const deskTools = [
  { title: 'Subscribers', description: 'Manage subscriber records and admin-only actions.', icon: GroupsOutlined, url: '/admins/subscribers', accent: '#db2777', soft: '#fce7f3' },
  { title: 'Clients', description: 'View and update client accounts.', icon: ManageAccountsOutlined, url: '/admins/clients', accent: '#0891b2', soft: '#cffafe' },
  { title: 'Client History', description: 'Search clients and review every subscription.', icon: HistoryOutlined, url: '/admins/client-history', accent: '#7c3aed', soft: '#ede9fe' },
  { title: 'Bulk SMS', description: 'Send updates to selected recipients.', icon: SmsOutlined, url: '/admins/bulk-sms', accent: '#4f46e5', soft: '#e0e7ff' },
  { title: 'SMS Settings', description: 'Edit or disable purchase and expiry messages.', icon: SmsOutlined, url: '/admins/sms-settings', accent: '#0369a1', soft: '#e0f2fe' },
  { title: 'WhatsApp API', description: 'Send approved templates and run template tests.', icon: ChatOutlined, url: '/admins/whatsapp-api', accent: '#16a34a', soft: '#dcfce7' },
  { title: 'Bonus', description: 'Issue subscription bonuses and messages.', icon: RedeemOutlined, url: '/admins/bonus', accent: '#ca8a04', soft: '#fef3c7' },
  { title: 'Receive Revenue', description: 'Record and review received agent revenue.', icon: PaymentsOutlined, url: '/admins/receive-revenue', accent: '#059669', soft: '#d1fae5' },
  { title: 'Revenue Report', description: 'Review subscription and payment revenue.', icon: AssessmentOutlined, url: '/admins/revenue-report', accent: '#7c3aed', soft: '#ede9fe' },
  { title: 'Agents Settings', description: 'Manage agent roles and hostel access.', icon: PersonAddAltOutlined, url: '/admins/agent-settings', accent: '#ea580c', soft: '#ffedd5' },
  { title: 'Hostel Settings', description: 'Manage hostels and assignments.', icon: ApartmentOutlined, url: '/admins/hostel-settings', accent: '#be123c', soft: '#ffe4e6' },
  { title: 'Plan Settings', description: 'Configure plans and fair-use limits.', icon: SpeedOutlined, url: '/admins/plan-settings', accent: '#0f766e', soft: '#ccfbf1' }
];

const SuperAdminDesk = () => {
  const navigate = useNavigate();

  return (
    <MainCard title={<Typography variant="h3">Super Admin Desk</Typography>}>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3, bgcolor: 'primary.lighter' }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1 }}>
          <AccountBalanceWalletOutlined color="primary" />
          <Typography variant="h4">Operations Hub</Typography>
        </Box>
        <Typography color="text.secondary">Manage subscribers, payments, people, plans, and communications from one place.</Typography>
      </Paper>

      <Grid container spacing={2.5}>
        {deskTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Grid item xs={12} sm={6} lg={4} key={tool.title}>
              <Paper
                variant="outlined"
                role="button"
                tabIndex={0}
                onClick={() => navigate(tool.url)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') navigate(tool.url);
                }}
                sx={{
                  background: `linear-gradient(145deg, #ffffff 0%, ${tool.soft} 160%)`, cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 185, overflow: 'hidden', p: 2.5, position: 'relative', transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                  '&::after': { background: tool.accent, bottom: 0, content: '""', height: 3, left: 0, position: 'absolute', transform: 'scaleX(0)', transformOrigin: 'left', transition: 'transform 180ms ease', width: '100%' },
                  '&:hover': { borderColor: tool.accent, boxShadow: `0 16px 30px ${tool.accent}2e`, transform: 'translateY(-6px)', '&::after': { transform: 'scaleX(1)' }, '& .desk-icon': { bgcolor: tool.accent, color: '#ffffff', transform: 'rotate(-7deg) scale(1.08)' }, '& .desk-arrow': { opacity: 1, transform: 'translateX(0)' } },
                  '&:focus-visible': { borderColor: tool.accent, boxShadow: `0 0 0 3px ${tool.accent}45`, outline: 'none' }
                }}
              >
                <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5, mb: 1.25 }}>
                  <Box className="desk-icon" sx={{ bgcolor: tool.soft, borderRadius: 2, color: tool.accent, display: 'grid', height: 44, placeItems: 'center', transition: 'background-color 180ms ease, color 180ms ease, transform 180ms ease', width: 44 }}><Icon /></Box>
                  <Typography variant="h4">{tool.title}</Typography>
                </Box>
                <Typography color="text.secondary" sx={{ flexGrow: 1, lineHeight: 1.55 }}>{tool.description}</Typography>
                <Box sx={{ alignItems: 'center', color: tool.accent, display: 'flex', fontSize: 13, fontWeight: 700, gap: 0.5, mt: 2 }}>
                  Open workspace
                  <ArrowForwardOutlined className="desk-arrow" fontSize="small" sx={{ opacity: 0.5, transform: 'translateX(-4px)', transition: 'opacity 180ms ease, transform 180ms ease' }} />
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </MainCard>
  );
};

export default SuperAdminDesk;
