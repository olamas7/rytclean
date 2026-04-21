import React from 'react';
import { Snackbar, IconButton, Box, Typography, Alert, LinearProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { InfoOutlined } from '@mui/icons-material';

function SnackError({ message, open, setOpen }) {
    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpen(false);
    };

    return (
        <Snackbar
            open={open}
            autoHideDuration={8000} // Automatically hide after 3 seconds
            onClose={handleClose}
            action={
                <IconButton size="small" aria-label="close" color="inherit" onClick={handleClose}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            }
            // Set position to bottom-center
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            // Override the Snackbar's content styling to apply full color
            ContentProps={{
                sx: {
                    backgroundColor: '#f44336' || 'default', // Apply custom background color
                    color: '#fff' // Ensure the text is readable
                }
            }}
            // Customize the message to include the icon and message text
            message={
                <Box display="flex" alignItems="center">
                    {/* Start icon */}
                    {<ErrorIcon /> && (
                        <Box component="span" sx={{ marginRight: 1 }}>
                            <ErrorIcon />
                        </Box>
                    )}
                    <Typography>{message}</Typography> {/* Message text */}
                </Box>
            }
        />
    );
}

function SnackSuccess({ message, open, setOpen }) {
    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpen(false);
    };

    return (
        <Snackbar
            open={open}
            autoHideDuration={8000} // Automatically hide after 3 seconds
            onClose={handleClose}
            action={
                <IconButton size="small" aria-label="close" color="inherit" onClick={handleClose}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            }
            // Set position to bottom-center
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            // Override the Snackbar's content styling to apply full color
            ContentProps={{
                sx: {
                    backgroundColor: '#4caf50' || 'default', // Apply custom background color
                    color: '#fff' // Ensure the text is readable
                }
            }}
            // Customize the message to include the icon and message text
            message={
                <Box display="flex" alignItems="center">
                    {/* Start icon */}
                    {<CheckCircleIcon /> && (
                        <Box component="span" sx={{ marginRight: 1 }}>
                            <CheckCircleIcon />
                        </Box>
                    )}
                    <Typography>{message}</Typography> {/* Message text */}
                </Box>
            }
        />
    );
}

function SnackInfo({ message, open, setOpen }) {
    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpen(false);
    };

    return (
        <Snackbar
            open={open}
            autoHideDuration={8000} // Automatically hide after 3 seconds
            onClose={handleClose}
            action={
                <IconButton size="small" aria-label="close" color="inherit" onClick={handleClose}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            }
            // Set position to bottom-center
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            // Override the Snackbar's content styling to apply full color
            ContentProps={{
                sx: {
                    backgroundColor: '#fae607' || 'default', // Apply custom background color
                    color: '#000000' // Ensure the text is readable
                }
            }}
            // Customize the message to include the icon and message text
            message={
                <Box display="flex" alignItems="center">
                    {/* Start icon */}
                    {<InfoOutlined /> && (
                        <Box component="span" sx={{ marginRight: 1 }}>
                            <InfoOutlined />
                        </Box>
                    )}
                    <Typography>{message}</Typography> {/* Message text */}
                </Box>
            }
        />
    );
}

function SnackProgressLoading({ snackbarMessage, snackbarSeverity, snackbarColor, uploadProgress, open }) {
    return (
        <Snackbar
            open={open}
            autoHideDuration={null} // Keep snackbar open while uploading
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
            <Alert
                severity={snackbarSeverity}
                sx={{
                    backgroundColor: snackbarColor,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: '300px'
                }}
            >
                {uploadProgress < 100 ? (
                    <>
                        <Box sx={{ width: '100%', mr: 1 }}>
                            <LinearProgress
                                variant="determinate"
                                value={uploadProgress}
                                sx={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                    '& .MuiLinearProgress-bar': {
                                        backgroundColor: snackbarColor === '#673AB7' ? '#fff200' : 'green'
                                    }
                                }}
                            />
                        </Box>
                        <Box sx={{ minWidth: 35 }}>
                            <span>{uploadProgress}%</span>
                        </Box>
                    </>
                ) : (
                    snackbarMessage
                )}
            </Alert>
        </Snackbar>
    );
}

export { SnackError, SnackSuccess, SnackInfo, SnackProgressLoading };