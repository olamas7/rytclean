import React from 'react';
import { Dialog, DialogContent, DialogTitle, Typography, Button, Box } from '@mui/material';
import logo from '../../../public/kayfilogo.png';

const InstallPWA = ({ open, onClose, onInstall }) => {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>
                <Box display="flex" alignItems="center" justifyContent="center" flexDirection="column">
                    <img src={logo} alt="App Logo" width="80" />
                    <Typography variant="h6" component="div" sx={{ mt: 2 }}>
                        Install Our App
                    </Typography>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body1" align="center">
                    For a better experience, install our app on your device. It's fast, reliable, and works offline!
                </Typography>
                <Box display="flex" justifyContent="center" sx={{ mt: 3 }}>
                    <Button onClick={onInstall} variant="contained" color="primary" sx={{ mr: 2 }}>
                        Install
                    </Button>
                    <Button onClick={onClose} variant="outlined" color="secondary">
                        Cancel
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default InstallPWA;
