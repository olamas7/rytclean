import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { AutoAwesome, Login, Widgets } from '@mui/icons-material';

const cards = [
  {
    title: 'Authentication Ready',
    description: 'JWT login, protected routes, and permission guard are wired and ready for your new app.',
    icon: <Login color="primary" />
  },
  {
    title: 'Reusable Components',
    description: 'Your custom UI components in ui-component and utils are kept for rapid feature building.',
    icon: <Widgets color="primary" />
  },
  {
    title: 'Starter Friendly',
    description: 'Business-specific POS screens are detached so you can rename and build a fresh product quickly.',
    icon: <AutoAwesome color="primary" />
  }
];

const AdminDashboard = () => {
  const name = localStorage.getItem('userMName') || 'there';

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h2" sx={{ fontWeight: 800, mb: 1 }}>
          Starter Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Welcome, <strong>{name}</strong>. Your template is clean and ready for a new project.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {cards.map((card) => (
          <Grid item xs={12} md={4} key={card.title}>
            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                {card.icon}
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {card.title}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {card.description}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
