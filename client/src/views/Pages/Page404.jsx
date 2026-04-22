import React from 'react';
import { Box, Button, Typography, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PointOfSale, Home } from '@mui/icons-material';
import { APP_NAME } from 'constants/branding';

const Page404 = () => {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                textAlign: 'center',
                bgcolor: 'background.paper'
            }}
        >
            <Container maxWidth="md">
                <PointOfSale sx={{ fontSize: 100, color: 'primary.light', mb: 2, opacity: 0.5 }} />
                <Typography variant="h1" sx={{ fontSize: '6rem', fontWeight: 900, color: 'primary.main', mb: 1 }}>
                    404
                </Typography>
                <Typography variant="h2" sx={{ mb: 3, fontWeight: 700 }}>
                    Oops! Page Not Found
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
                    The page you are looking for might have been removed, had its name changed, or is temporarily unavailable in the {APP_NAME} system.
                </Typography>
                <Button 
                    variant="contained" 
                    size="large" 
                    startIcon={<Home />} 
                    onClick={() => navigate('/')}
                    sx={{ px: 4, py: 1.5, borderRadius: 2 }}
                >
                    Back to Dashboard
                </Button>
            </Container>
        </Box>
    );
};

export default Page404;
