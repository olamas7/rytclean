import * as React from 'react';
import MainCard from 'ui-component/cards/MainCard';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom'; // for navigation if using react-router-dom

const NotFoundPage = () => {
    const navigate = useNavigate(); // use this if you want a "Back Home" button

    const handleGoHome = () => {
        navigate('/'); // navigate to home or any other route
    };

    return (
        <>
            <MainCard title="Page 404!">
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" textAlign="center">
                    <Typography variant="h1" color="primary" gutterBottom>
                        404
                    </Typography>
                    <Typography variant="h5" color="textSecondary" gutterBottom>
                        Oops! Page not found.
                    </Typography>
                    <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
                        The page you are looking for might have been removed or is temporarily unavailable.
                    </Typography>
                    <Button variant="contained" color="primary" onClick={handleGoHome}>
                        Back to Home
                    </Button>
                </Box>
            </MainCard>
        </>
    );
};
export default NotFoundPage;
