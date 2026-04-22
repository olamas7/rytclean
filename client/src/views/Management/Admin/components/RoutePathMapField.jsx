import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { MapContainer, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import { LdButton } from 'utils/myButtons';

const DEFAULT_CENTER = [5.6037, -0.187];

const toLatLngPoints = (geoJson) => {
    if (!geoJson || geoJson.type !== 'LineString' || !Array.isArray(geoJson.coordinates)) {
        return [];
    }

    return geoJson.coordinates.map(([lng, lat]) => [Number(lat), Number(lng)]);
};

const toLineString = (points) => {
    if (!points || !points.length) {
        return null;
    }

    return {
        type: 'LineString',
        coordinates: points.map(([lat, lng]) => [Number(lng), Number(lat)])
    };
};

const RouteClickCapture = ({ onAddPoint }) => {
    useMapEvents({
        click: (event) => {
            const { lat, lng } = event.latlng;
            onAddPoint([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
        }
    });

    return null;
};

RouteClickCapture.propTypes = {
    onAddPoint: PropTypes.func.isRequired
};

const RoutePathMapField = ({ value, onChange }) => {
    const points = useMemo(() => toLatLngPoints(value), [value]);
    const center = points.length ? points[0] : DEFAULT_CENTER;

    const addPoint = (point) => {
        onChange(toLineString([...points, point]));
    };

    const removeLast = () => {
        if (!points.length) {
            return;
        }
        onChange(toLineString(points.slice(0, -1)));
    };

    const clearAll = () => {
        onChange(null);
    };

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                Route Path (click map to add points)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Add at least 2 points to define the route line.
            </Typography>

            <Box sx={{ height: 320, borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <RouteClickCapture onAddPoint={addPoint} />
                    {points.length > 0 && <Polyline positions={points} pathOptions={{ color: '#265074', weight: 4 }} />}
                </MapContainer>
            </Box>

            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <LdButton variant="outlined" color="secondary" onClick={removeLast} disabled={!points.length}>
                    Remove Last Point
                </LdButton>
                <LdButton variant="outlined" color="error" onClick={clearAll} disabled={!points.length}>
                    Clear Route Path
                </LdButton>
            </Stack>
        </Box>
    );
};

RoutePathMapField.propTypes = {
    value: PropTypes.object,
    onChange: PropTypes.func.isRequired
};

export default RoutePathMapField;
