import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { defaultRoute } from 'constants/appRoutes';

export default function DashboardIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(defaultRoute);
  }, [navigate]);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
      <CircularProgress />
    </Box>
  );
}
