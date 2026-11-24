import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Skeleton, Stack, Typography } from '@mui/material';
import { getCustomerHousePhoto } from 'services/api/customersService';
import { LdButton } from 'utils/myButtons';

const HousePhotoPreview = ({ customerId, hasPhoto, name = 'Customer', height = 280, version }) => {
    const [photo, setPhoto] = useState('');
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let disposed = false;
        let url;
        const controller = new AbortController();
        setPhoto('');
        setError('');
        if (customerId && hasPhoto) {
            getCustomerHousePhoto(customerId, controller.signal).then((blob) => {
                if (disposed) return;
                url = URL.createObjectURL(blob);
                setPhoto(url);
            }).catch(() => { if (!disposed) setError('Unable to load the house photo.'); });
        }
        return () => { disposed = true; controller.abort(); if (url) URL.revokeObjectURL(url); };
    }, [customerId, hasPhoto, version, attempt]);

    if (!hasPhoto) return <Typography variant="body2" color="text.secondary">No house/frontage photo attached.</Typography>;
    if (error) return <Stack spacing={1} alignItems="flex-start"><Alert severity="warning">{error}</Alert><LdButton variant="outlined" onClick={() => setAttempt((prev) => prev + 1)}>Retry Photo</LdButton></Stack>;
    if (!photo) return <Skeleton variant="rounded" height={height} aria-label="Loading house photo" />;
    return <Box component="img" src={photo} alt={`House frontage for ${name}`} onError={() => setError('This house photo could not be displayed. Please replace it with another image.')} sx={{ width: '100%', height, objectFit: 'contain', borderRadius: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }} />;
};

HousePhotoPreview.propTypes = { customerId: PropTypes.string, hasPhoto: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]), name: PropTypes.string, height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), version: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) };
export default HousePhotoPreview;
