import React from 'react';
import { Box, Button, Typography, Container, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { GppBad, ArrowBack } from '@mui/icons-material';

const Unauthorized = () => {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                textAlign: 'center',
                bgcolor: 'grey.50'
            }}
        >
            <Container maxWidth="sm">
                <Paper elevation={0} sx={{ p: 5, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                    <GppBad sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
                    <Typography variant="h2" sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}>
                        Access Denied
                    </Typography>
                    <Typography variant="h5" sx={{ mb: 3, color: 'error.main', fontWeight: 600 }}>
                        Unauthorized Access Attempted
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                        You do not have the necessary permissions to view this page. This incident may be logged for security purposes.
                    </Typography>
                    <Button 
                        variant="outlined" 
                        size="large" 
                        startIcon={<ArrowBack />} 
                        onClick={() => navigate(-1)}
                        sx={{ px: 4, py: 1, borderRadius: 2 }}
                    >
                        Go Back
                    </Button>
                </Paper>
            </Container>
        </Box>
    );
};

export default Unauthorized;
