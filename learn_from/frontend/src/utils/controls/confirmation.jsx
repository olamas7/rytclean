import React from 'react';
import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';

const ConfirmationDialog = ({
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

const DeleteConfirmation = ({ open, message = 'Are you sure you want to delete this item?', onConfirm, handleClose }) => {
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

const ConfirmDialog = ({
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

export { ConfirmationDialog, DeleteConfirmation, ConfirmDialog };
