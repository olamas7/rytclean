import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { MapContainer, Polygon, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import { LdButton } from 'utils/myButtons';

const DEFAULT_CENTER = [5.6037, -0.187];

const toLatLngRing = (geoJson) => {
    if (!geoJson || geoJson.type !== 'Polygon' || !Array.isArray(geoJson.coordinates) || !geoJson.coordinates[0]) {
        return [];
    }

    const ring = geoJson.coordinates[0];
    const first = ring[0];
    const last = ring[ring.length - 1];
    const isClosed =
        ring.length > 3 &&
        Array.isArray(first) &&
        Array.isArray(last) &&
        first.length === 2 &&
        last.length === 2 &&
        Number(first[0]) === Number(last[0]) &&
        Number(first[1]) === Number(last[1]);

    const trimmed = isClosed ? ring.slice(0, -1) : ring;
    return trimmed.map(([lng, lat]) => [lat, lng]);
};

const toGeoJsonPolygon = (latLngRing) => {
    if (!latLngRing || !latLngRing.length) {
        return null;
    }

    const coordinates = latLngRing.map(([lat, lng]) => [Number(lng), Number(lat)]);
    if (coordinates.length >= 3) {
        coordinates.push(coordinates[0]);
    }

    return {
        type: 'Polygon',
        coordinates: [coordinates]
    };
};

const ZoneClickCapture = ({ onAddPoint }) => {
    useMapEvents({
        click: (event) => {
            const { lat, lng } = event.latlng;
            onAddPoint([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
        }
    });

    return null;
};

ZoneClickCapture.propTypes = {
    onAddPoint: PropTypes.func.isRequired
};

const ZoneBoundaryMapField = ({ value, onChange }) => {
    const points = useMemo(() => toLatLngRing(value), [value]);
    const hasPolygon = points.length >= 3;

    const mapCenter = hasPolygon ? points[0] : DEFAULT_CENTER;

    const addPoint = (point) => {
        const next = [...points, point];
        onChange(toGeoJsonPolygon(next));
    };

    const removeLast = () => {
        if (!points.length) {
            return;
        }
        const next = points.slice(0, -1);
        onChange(toGeoJsonPolygon(next));
    };

    const clearAll = () => {
        onChange(null);
    };

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                Zone Boundary (click map to add points)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Add at least 3 points to define coverage.
            </Typography>

            <Box sx={{ height: 320, borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <ZoneClickCapture onAddPoint={addPoint} />
                    {points.length >= 3 && <Polygon positions={points} pathOptions={{ color: '#2c9596', fillColor: '#9bcec2', fillOpacity: 0.35 }} />}
                    {points.length > 0 && points.length < 3 && <Polyline positions={points} pathOptions={{ color: '#2c9596' }} />}
                </MapContainer>
            </Box>

            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <LdButton variant="outlined" color="secondary" onClick={removeLast} disabled={!points.length}>
                    Remove Last Point
                </LdButton>
                <LdButton variant="outlined" color="error" onClick={clearAll} disabled={!points.length}>
                    Clear Boundary
                </LdButton>
            </Stack>
        </Box>
    );
};

ZoneBoundaryMapField.propTypes = {
    value: PropTypes.object,
    onChange: PropTypes.func.isRequired
};

export default ZoneBoundaryMapField;
