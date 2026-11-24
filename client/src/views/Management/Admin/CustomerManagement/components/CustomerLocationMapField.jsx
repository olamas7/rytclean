import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Grid, Stack, TextField, Typography } from '@mui/material';
import { MyLocation } from '@mui/icons-material';
import GoogleMap from 'ui-component/maps/GoogleMap';
import { MapMarker } from 'ui-component/maps/MapOverlays';
import PlaceSearch from 'ui-component/maps/PlaceSearch';
import { DEFAULT_MAP_CENTER, toMapPoint } from 'services/googleMaps';
import { LdButton } from 'utils/myButtons';

const CustomerLocationMapField = ({ value, onChange, onLocatingChange }) => {
    const position = toMapPoint(value?.latitude, value?.longitude);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState('');
    const [gpsFix, setGpsFix] = useState(null);
    const mounted = useRef(true);
    const current = useRef({ onChange, onLocatingChange });
    current.current = { onChange, onLocatingChange };
    const geoVersion = useRef(0);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; geoVersion.current += 1; current.current.onLocatingChange?.(false); };
    }, []);
    useEffect(() => { onLocatingChange?.(locating); }, [locating, onLocatingChange]);

    const cancelCapture = () => {
        geoVersion.current += 1;
        setLocating(false);
        setGpsFix(null);
        setLocationError('');
    };

    const pick = (point) => {
        cancelCapture();
        onChange({ latitude: point.lat, longitude: point.lng, locationAddress: '' });
    };
    const locate = () => {
        if (!window.isSecureContext) { setLocationError('GPS capture requires HTTPS on a phone. Open the secure app address and allow location access.'); return; }
        if (!navigator.geolocation) { setLocationError('Your browser does not support location sharing. Select a map pin instead.'); return; }
        const version = ++geoVersion.current;
        setLocating(true);
        setLocationError('');
        setGpsFix(null);
        navigator.geolocation.getCurrentPosition((result) => {
            if (!mounted.current || version !== geoVersion.current) return;
            const point = toMapPoint(result.coords.latitude, result.coords.longitude);
            if (!point) { setLocationError('The device returned an invalid position. Please capture GPS again.'); setLocating(false); return; }
            const latitude = Number(point.lat.toFixed(7));
            const longitude = Number(point.lng.toFixed(7));
            setGpsFix({ latitude, longitude, accuracy: Number.isFinite(result.coords.accuracy) ? Math.max(1, Math.round(result.coords.accuracy)) : null });
            current.current.onChange({ latitude, longitude, locationAddress: '' });
            setLocating(false);
        }, (error) => {
            if (!mounted.current || version !== geoVersion.current) return;
            const messages = {
                1: 'Location permission was denied. Allow location for this site in the browser/phone settings, then try again.',
                2: 'Your position is unavailable. Turn on phone location services, move outdoors and try again.',
                3: 'GPS capture timed out. Move to an open area near the customer’s property and capture again.'
            };
            setLocationError(messages[error.code] || 'Unable to get your position. Allow location access or select a pin manually.');
            setLocating(false);
        }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    };

    const currentFix = gpsFix && position && gpsFix.latitude === position.lat && gpsFix.longitude === position.lng ? gpsFix : null;

    return <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <LdButton startIcon={<MyLocation />} loading={locating} onClick={locate}>{locating ? 'Capturing GPS…' : 'Capture GPS Location'}</LdButton>
            <LdButton variant="outlined" color="error" disabled={!position && !locating} onClick={() => { cancelCapture(); onChange({ latitude: '', longitude: '', locationAddress: '' }); }}>Clear Location</LdButton>
        </Stack>
        {locating && <Typography role="status" variant="caption" color="text.secondary">Getting current location…</Typography>}
        {locationError && <Alert severity="warning">{locationError}</Alert>}
        {currentFix && <Alert severity={currentFix.accuracy === null || currentFix.accuracy > 50 ? 'warning' : 'success'}>
            GPS captured{currentFix.accuracy !== null ? ` · Accuracy ±${currentFix.accuracy} m.` : ' · Accuracy unavailable.'}
            {currentFix.accuracy === null || currentFix.accuracy > 50 ? ' Low accuracy—retry outdoors or adjust the pin.' : ''}
        </Alert>}
        <PlaceSearch onSelect={(selected) => { cancelCapture(); onChange(selected); }} />
        <GoogleMap center={position || DEFAULT_MAP_CENTER} zoom={position ? 16 : 13} height={320} label="Choose customer pickup location" onClick={pick}>
            {position && <MapMarker position={position} title="Customer pickup point — drag to adjust" draggable onDragEnd={pick} />}
        </GoogleMap>
        <Grid container spacing={1}>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="number" label="Latitude" value={value?.latitude ?? ''} inputProps={{ min: -90, max: 90, step: 'any' }} onChange={(event) => { cancelCapture(); onChange({ ...value, latitude: event.target.value, locationAddress: '' }); }} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="number" label="Longitude" value={value?.longitude ?? ''} inputProps={{ min: -180, max: 180, step: 'any' }} onChange={(event) => { cancelCapture(); onChange({ ...value, longitude: event.target.value, locationAddress: '' }); }} /></Grid>
        </Grid>
        <TextField fullWidth size="small" label="Location Address (optional)" value={value?.locationAddress || ''} inputProps={{ maxLength: 255 }} onChange={(event) => onChange({ ...value, locationAddress: event.target.value })} />
    </Stack>;
};

CustomerLocationMapField.propTypes = {
    value: PropTypes.shape({ latitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), longitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), locationAddress: PropTypes.string }),
    onChange: PropTypes.func.isRequired,
    onLocatingChange: PropTypes.func
};
export default CustomerLocationMapField;
