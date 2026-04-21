import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import {
    Dialog,
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Slide,
    Box,
    Grid,
    useMediaQuery,
    DialogTitle,
    DialogActions,
    DialogContent,
    DialogContentText,
    Button
} from '@mui/material';
import { Close, Close as CloseIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// Transition for fullscreen dialog
const TransitionUp = forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

// Transition for medium dialog
const TransitionDown = forwardRef(function Transition(props, ref) {
    return <Slide direction="down" ref={ref} {...props} />;
});

/**
 * Reusable fullscreen dialog
 * ...
 */
export const FullscreenDialog = ({ open, onClose, title, children, topColor }) => {
    const theme = useTheme();
    return (
        <Dialog fullScreen open={open} onClose={onClose} TransitionComponent={TransitionUp} scroll="vertical">
            <AppBar
                sx={{
                    position: 'relative',
                    backgroundColor: '#820f22ff'
                }}
            >
                <Toolbar>
                    {/* Title (Centered) */}
                    <Typography variant="h3" sx={{ flexGrow: 1, textAlign: 'center', fontWeight: 'bold', fontSize: '16', color: 'white' }}>
                        {title}
                    </Typography>

                    {/* Close Button */}
                    <IconButton
                        edge="end"
                        color="error"
                        onClick={onClose}
                        aria-label="close"
                        sx={{
                            position: 'absolute',
                            right: theme.spacing(2),
                            color: '#fff'
                        }}
                    >
                        {<Close />}
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Grid
                sx={{
                    marginRight: { xs: 0, md: 10 },
                    marginLeft: { xs: 0, md: 10 }
                }}
            >
                <Box sx={{ p: 2 }}>{children}</Box>
            </Grid>
        </Dialog>
    );
};

/**
 * Reusable medium dialog
 * ...
 */
export const MediumDialog = ({ open, onClose, title, children }) => {
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
            TransitionComponent={TransitionDown}
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

export const ConfirmationDialog = ({
    open,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmColor = 'error',
    cancelColor = 'primary'
}) => {
    return (
        <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
            {title && <DialogTitle style={{ fontSize: '14px', fontWeight: 'normal' }}>{title}</DialogTitle>}
            <DialogContent>
                {message && <DialogContentText style={{ fontSize: '14px', fontWeight: 'bold' }}>{message}</DialogContentText>}
            </DialogContent>
            <DialogActions>
                <Button varient="outlined" onClick={onCancel} color={cancelColor}>
                    {cancelText}
                </Button>
                <Button onClick={onConfirm} color={confirmColor} variant="contained" autoFocus>
                    {confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

ConfirmationDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    title: PropTypes.string,
    message: PropTypes.string,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    confirmText: PropTypes.string,
    cancelText: PropTypes.string,
    confirmColor: PropTypes.string,
    cancelColor: PropTypes.string
};

export const DeleteConfirmation = ({ open, message = 'Are you sure you want to delete this item?', onConfirm, handleClose }) => {
    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle style={{ fontSize: '14px', fontWeight: 'normal' }}>{'Confirm Delete'}</DialogTitle>
            <DialogContent>
                {message && <DialogContentText style={{ fontSize: '14px', fontWeight: 'bold' }}>{message}</DialogContentText>}
            </DialogContent>
            <DialogActions>
                <Button varient="outlined" onClick={handleClose} color={'info'}>
                    {'Cancel'}
                </Button>
                <Button onClick={onConfirm} color={'error'} variant="contained" autoFocus>
                    {'Delete'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export const ConfirmDialog = ({
    open,
    message = 'Are you sure you want to proceed with this action?',
    onConfirm,
    handleClose,
    title = 'Confirm Process',
    confirmButton = 'Confirm'
}) => {
    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle style={{ fontSize: '14px', fontWeight: 'normal' }}>{title}</DialogTitle>
            <DialogContent>
                {message && <DialogContentText style={{ fontSize: '14px', fontWeight: 'bold' }}>{message}</DialogContentText>}
            </DialogContent>
            <DialogActions>
                <Button varient="outlined" onClick={handleClose} color={'error'}>
                    {'Cancel'}
                </Button>
                <Button onClick={onConfirm} color={'success'} variant="contained" autoFocus>
                    {confirmButton}
                </Button>
            </DialogActions>
        </Dialog>
    );
};