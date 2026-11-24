import { createContext, useContext, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import { DEFAULT_MAP_CENTER, GOOGLE_MAP_ID, loadGoogleMaps, MAP_AUTH_ERROR_EVENT } from 'services/googleMaps';
import { LdButton } from 'utils/myButtons';

const MapContext = createContext(null);
export const useGoogleMap = () => useContext(MapContext);

const GoogleMap = ({ children, center = DEFAULT_MAP_CENTER, zoom = 13, height = 340, label = 'Google map', onClick }) => {
    const containerRef = useRef(null);
    const onClickRef = useRef(onClick);
    onClickRef.current = onClick;
    const [map, setMap] = useState(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const initialView = useRef({ center, zoom });
    initialView.current = { center, zoom };
    const previousView = useRef(null);

    useEffect(() => {
        let cancelled = false;
        let instance;
        let listener;
        let capabilities;
        setError('');
        setMap(null);
        const authFailure = () => setError('Google Maps access was denied. Check billing, API activation and allowed website addresses.');
        window.addEventListener(MAP_AUTH_ERROR_EVENT, authFailure);
        loadGoogleMaps().then((maps) => {
            if (cancelled || !containerRef.current) return;
            instance = new maps.Map(containerRef.current, {
                ...initialView.current, mapId: GOOGLE_MAP_ID, streetViewControl: false,
                mapTypeControl: true, fullscreenControl: true, gestureHandling: 'cooperative'
            });
            listener = instance.addListener('click', (event) => {
                if (!onClickRef.current || !event.latLng) return;
                event.stop?.(); // Places/POI clicks can still be used to select a precise pin.
                onClickRef.current({ lat: Number(event.latLng.lat().toFixed(7)), lng: Number(event.latLng.lng().toFixed(7)) });
            });
            capabilities = instance.addListener('mapcapabilities_changed', () => {
                if (!instance.getMapCapabilities().isAdvancedMarkersAvailable) {
                    setError('This map ID does not support advanced markers. Check that it is a valid JavaScript map ID.');
                } else {
                    setError((previous) => previous === 'This map ID does not support advanced markers. Check that it is a valid JavaScript map ID.' ? '' : previous);
                }
            });
            setMap(instance);
        }).catch((err) => { if (!cancelled) setError(err.message); });
        return () => {
            cancelled = true;
            listener?.remove();
            capabilities?.remove();
            window.removeEventListener(MAP_AUTH_ERROR_EVENT, authFailure);
            if (instance) window.google.maps.event.clearInstanceListeners(instance);
        };
    }, [attempt]);

    useEffect(() => {
        if (!map) return;
        // Don't overwrite a child's initial fitBounds when a map is first created.
        if (previousView.current !== map) {
            previousView.current = map;
            return;
        }
        map.panTo({ lat: center.lat, lng: center.lng });
        map.setZoom(zoom);
    }, [map, center.lat, center.lng, zoom]);

    return (
        <Box sx={{ position: 'relative', height, minHeight: 240, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Box ref={containerRef} role="region" aria-label={label} sx={{ width: '100%', height: '100%' }} />
            {(!map || error) && <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, bgcolor: 'background.paper', p: 2, overflowY: 'auto' }}>
                {error ? <><Alert severity="error">{error}</Alert><LdButton variant="outlined" onClick={() => setAttempt((prev) => prev + 1)}>Retry Map</LdButton></> : <><CircularProgress size={26} /><Typography role="status" variant="body2">Loading Google Maps…</Typography></>}
            </Stack>}
            {map && !error && <MapContext.Provider value={map}>{children}</MapContext.Provider>}
        </Box>
    );
};

GoogleMap.propTypes = {
    children: PropTypes.node,
    center: PropTypes.shape({ lat: PropTypes.number.isRequired, lng: PropTypes.number.isRequired }),
    zoom: PropTypes.number,
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    label: PropTypes.string,
    onClick: PropTypes.func
};

export const MapFitBounds = ({ points, maxZoom = 15 }) => {
    const map = useGoogleMap();
    const pointsKey = JSON.stringify(points);
    useEffect(() => {
        const positions = JSON.parse(pointsKey);
        if (!map || !positions.length) return;
        if (positions.length === 1) {
            map.setCenter(positions[0]);
            map.setZoom(maxZoom);
            return;
        }
        const bounds = new window.google.maps.LatLngBounds();
        positions.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, 40);
        const listener = map.addListener('idle', () => {
            listener.remove();
            if (map.getZoom() > maxZoom) map.setZoom(maxZoom);
        });
        return () => listener.remove();
    }, [map, pointsKey, maxZoom]);
    return null;
};

MapFitBounds.propTypes = { points: PropTypes.array.isRequired, maxZoom: PropTypes.number };
export default GoogleMap;
