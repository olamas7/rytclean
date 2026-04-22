import React from 'react';
import { Box, Typography, Grid, Stack, Paper } from '@mui/material';
import { motion } from 'framer-motion';

import { PointOfSale, Storefront, TrendingUp, Security } from '@mui/icons-material';
import SimpleLogin from './SimpleLogin';
import { APP_MOTTO, APP_NAME } from 'constants/branding';

export default function LoginPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.paper' }}>
      <Grid container>
        {/* Left Side: Brand Panel */}
        <Grid
          item
          xs={false}
          md={6}
          sx={{
            bgcolor: 'primary.main',
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            p: 6
          }}
        >
          {/* Background decoration */}
          <Box
            sx={{
              position: 'absolute',
              top: -100,
              left: -100,
              width: 400,
              height: 400,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.05)'
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -50,
              right: -50,
              width: 300,
              height: 300,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.05)'
            }}
          />

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <Stack spacing={4} alignItems="center" sx={{ textAlign: 'center', zIndex: 1 }}>
              <Box
                sx={{
                  bgcolor: 'white',
                  p: 2,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 10
                }}
              >
                <PointOfSale sx={{ fontSize: 80, color: 'primary.main' }} />
              </Box>

              <Box>
                <Typography variant="h1" sx={{ color: 'white', fontWeight: 900, fontSize: '4rem', mb: 1, letterSpacing: -1 }}>
                  {APP_NAME}
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' }}
                >
                  {APP_MOTTO}
                </Typography>
              </Box>

              <Stack direction="row" spacing={4} sx={{ mt: 4 }}>
                <Stack alignItems="center" spacing={1}>
                  <Storefront />
                  <Typography variant="caption">Inventory</Typography>
                </Stack>
                <Stack alignItems="center" spacing={1}>
                  <TrendingUp />
                  <Typography variant="caption">Analytics</Typography>
                </Stack>
                <Stack alignItems="center" spacing={1}>
                  <Security />
                  <Typography variant="caption">Security</Typography>
                </Stack>
              </Stack>

              <Typography variant="body1" sx={{ maxWidth: 450, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, mt: 4 }}>
                Manage smarter waste operations across customer and management portals with one clean workflow.
              </Typography>
            </Stack>
          </motion.div>
        </Grid>

        {/* Right Side: Login Form */}
        <Grid
          item
          xs={12}
          md={6}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            p: { xs: 3, md: 8 },
            bgcolor: 'background.default'
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 450 }}>
            {/* Mobile Branding */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', alignItems: 'center', mb: 6 }}>
              <PointOfSale sx={{ fontSize: 50, color: 'primary.main', mb: 1 }} />
              <Typography variant="h2" sx={{ fontWeight: 900, color: 'primary.main' }}>
                {APP_NAME}
              </Typography>
            </Box>

            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
              <Paper elevation={0} sx={{ p: { xs: 0, sm: 4 }, bgcolor: 'transparent' }}>
                <SimpleLogin />
              </Paper>

              <Box sx={{ mt: 8, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6 }}>
                  © {new Date().getFullYear()} {APP_NAME}. <br />
                  {APP_MOTTO}
                </Typography>
              </Box>
            </motion.div>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
