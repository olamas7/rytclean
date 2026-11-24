import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { ApartmentOutlined, ArrowForwardOutlined, AssessmentOutlined, GroupsOutlined, ManageAccountsOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MainCard from 'ui-component/cards/MainCard';

const tools = [
  { title: 'Current Subscribers', description: 'Review active subscribers across your hostels.', icon: GroupsOutlined, url: '/hostel-owners/subscribers', accent: '#2563eb', soft: '#dbeafe' },
  { title: 'Client List', description: 'Find and review clients assigned to your hostels.', icon: ManageAccountsOutlined, url: '/hostel-owners/clients', accent: '#db2777', soft: '#fce7f3' },
  { title: 'Revenue', description: 'Review revenue for your managed hostels.', icon: AssessmentOutlined, url: '/hostel-owners/revenue', accent: '#059669', soft: '#d1fae5' }
];

const HostelOwnersDesk = () => {
  const navigate = useNavigate();

  return (
    <MainCard title={<Typography variant="h3">Hostel Owners Desk</Typography>}>
      <Paper variant="outlined" sx={{ bgcolor: 'primary.lighter', mb: 3, p: { xs: 2.5, md: 3 } }}>
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.25, mb: 1 }}><ApartmentOutlined color="primary" /><Typography variant="h4">Hostel workspace</Typography></Box>
        <Typography color="text.secondary">Monitor residents, clients, and revenue for hostels assigned to you.</Typography>
      </Paper>
      <Grid container spacing={2.5}>
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Grid item xs={12} md={4} key={tool.title}>
              <Paper
                variant="outlined"
                role="button"
                tabIndex={0}
                onClick={() => navigate(tool.url)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') navigate(tool.url);
                }}
                sx={{
                  background: `linear-gradient(145deg, #ffffff 0%, ${tool.soft} 180%)`,
                  cursor: 'pointer', height: '100%', minHeight: 190, p: 2.5, position: 'relative', transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                  '&::after': { background: tool.accent, bottom: 0, content: '""', height: 3, left: 0, position: 'absolute', transform: 'scaleX(0)', transformOrigin: 'left', transition: 'transform 180ms ease', width: '100%' },
                  '&:hover': { borderColor: tool.accent, boxShadow: `0 16px 30px ${tool.accent}2e`, transform: 'translateY(-6px)', '&::after': { transform: 'scaleX(1)' }, '& .desk-icon': { bgcolor: tool.accent, color: '#fff', transform: 'rotate(-7deg) scale(1.08)' }, '& .desk-arrow': { opacity: 1, transform: 'translateX(0)' } },
                  '&:focus-visible': { borderColor: tool.accent, boxShadow: `0 0 0 3px ${tool.accent}45`, outline: 'none' }
                }}
              >
                <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5, mb: 1.25 }}>
                  <Box className="desk-icon" sx={{ bgcolor: tool.soft, borderRadius: 2, color: tool.accent, display: 'grid', height: 44, placeItems: 'center', transition: 'background-color 180ms ease, color 180ms ease, transform 180ms ease', width: 44 }}><Icon /></Box>
                  <Typography variant="h4">{tool.title}</Typography>
                </Box>
                <Typography color="text.secondary" sx={{ lineHeight: 1.55 }}>{tool.description}</Typography>
                <Box sx={{ alignItems: 'center', color: tool.accent, display: 'flex', fontSize: 13, fontWeight: 700, gap: 0.5, mt: 2 }}>Open workspace<ArrowForwardOutlined className="desk-arrow" fontSize="small" sx={{ opacity: 0.5, transform: 'translateX(-4px)', transition: 'opacity 180ms ease, transform 180ms ease' }} /></Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </MainCard>
  );
};

export default HostelOwnersDesk;
