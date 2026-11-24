import React, { forwardRef } from 'react';
import { Dialog, AppBar, Toolbar, IconButton, Typography, Slide, Box, Grid, useMediaQuery, DialogTitle } from '@mui/material';
import { Close, Close as CloseIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// Transition for fullscreen dialog
const Transition = forwardRef(function Transition(props, ref) {
    return <Slide direction="down" ref={ref} {...props} />;
});

/**
 * Reusable medium dialog
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - title: string
 * - children: React.ReactNode
 */
const MediumDialog = ({ open, onClose, title, children }) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

    return (
        <Dialog
            fullScreen={fullScreen}
            maxWidth="md" // Set dialog size to medium
            fullWidth
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
            open={open}
            onClose={onClose}
            TransitionComponent={Transition}
        >
            <DialogTitle id="alert-dialog-title" mt={2} mb={1}>
                <Typography variant="body2">{title}</Typography>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        color: (theme) => theme.palette.grey[600],
                        backgroundColor: 'transparent',
                        '&:hover': {
                            backgroundColor: 'red',
                            color: '#fff'
                        }
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <Grid>
                <Box sx={{ p: 1 }}>{children}</Box>
            </Grid>
        </Dialog>
    );
};

export default MediumDialog;
