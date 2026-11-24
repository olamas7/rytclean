import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import imageCompression from 'browser-image-compression';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import { AddAPhoto, DeleteOutline, UploadFile } from '@mui/icons-material';
import { LdButton } from 'utils/myButtons';
import HousePhotoPreview from './HousePhotoPreview';

const HousePhotoField = ({ value, onChange, customer, disabled = false, onBusyChange }) => {
    const gallery = useRef(null);
    const camera = useRef(null);
    const [preview, setPreview] = useState('');
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const request = useRef(0);
    const current = useRef({ onChange, onBusyChange });
    current.current = { onChange, onBusyChange };
    useEffect(() => () => { request.current += 1; current.current.onBusyChange?.(false); }, []);
    useEffect(() => { onBusyChange?.(processing); }, [processing, onBusyChange]);
    useEffect(() => {
        if (!value?.file) { setPreview(''); return; }
        const url = URL.createObjectURL(value.file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [value?.file]);

    const selectPhoto = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const version = ++request.current;
        setError('');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPG, PNG or WebP photo. If your phone uses HEIC, select its JPEG/Most Compatible camera setting.'); return; }
        if (file.size > 15 * 1024 * 1024) { setError('Choose a photo smaller than 15 MB.'); return; }
        setProcessing(true);
        try {
            // Resize for field uploads and re-encode without retaining EXIF/GPS metadata.
            const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1800, useWebWorker: true, fileType: 'image/jpeg', preserveExif: false });
            if (version !== request.current) return;
            if (compressed.size > 5 * 1024 * 1024) throw new Error('Photo too large.');
            const photo = new File([compressed], 'house-frontage.jpg', { type: 'image/jpeg' });
            current.current.onChange({ file: photo, remove: false });
        } catch {
            if (version === request.current) setError('Unable to process this photo. Please choose a different image.');
        } finally {
            if (version === request.current) setProcessing(false);
        }
    };
    const hasPhoto = Boolean(value?.file || (customer?.hasHousePhoto && !value?.remove));

    return <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack spacing={1.5}>
            <Typography variant="h4" component="h2">House Photo (optional)</Typography>
            <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} disabled={disabled || processing} aria-label="Choose house frontage photo" style={{ display: 'none' }} />
            <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={selectPhoto} disabled={disabled || processing} aria-label="Take house frontage photo" style={{ display: 'none' }} />
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <LdButton variant="outlined" startIcon={<AddAPhoto />} loading={processing} disabled={disabled} onClick={() => camera.current?.click()}>Take Photo</LdButton>
                <LdButton variant="outlined" startIcon={<UploadFile />} disabled={disabled || processing} onClick={() => gallery.current?.click()}>{hasPhoto ? 'Replace Photo' : 'Choose Photo'}</LdButton>
                {hasPhoto && <LdButton variant="outlined" color="error" startIcon={<DeleteOutline />} disabled={disabled || processing} onClick={() => { setError(''); onChange({ file: null, remove: Boolean(customer?.hasHousePhoto) }); }}>Remove Photo</LdButton>}
                {Boolean(customer?.hasHousePhoto) && Boolean(value?.file || value?.remove) && <LdButton variant="text" disabled={disabled || processing} onClick={() => { setError(''); onChange({ file: null, remove: false }); }}>Keep Saved Photo</LdButton>}
            </Stack>
            {error && <Alert severity="warning">{error}</Alert>}
            {processing && <Typography role="status" variant="caption" color="text.secondary">Preparing photo for upload…</Typography>}
            {preview && <Box component="img" src={preview} alt="Selected house frontage preview" sx={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 2, bgcolor: 'grey.50' }} />}
            {!value?.file && !value?.remove && Boolean(customer?.hasHousePhoto) && <HousePhotoPreview customerId={customer.id} hasPhoto={customer.hasHousePhoto} name={customer.fullName} version={customer.updated_at} />}
            {value?.remove && <Typography variant="caption" color="text.secondary">Photo marked for removal.</Typography>}
        </Stack>
    </Paper>;
};

HousePhotoField.propTypes = { value: PropTypes.shape({ file: PropTypes.object, remove: PropTypes.bool }), onChange: PropTypes.func.isRequired, customer: PropTypes.object, disabled: PropTypes.bool, onBusyChange: PropTypes.func };
export default HousePhotoField;
