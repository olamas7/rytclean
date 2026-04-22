import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { MapContainer, Polygon, Popup, TileLayer } from 'react-leaflet';

const DEFAULT_CENTER = [5.6037, -0.187];

const parsePolygon = (zone) => {
    if (!zone.boundary_geojson) {
        return null;
    }

    try {
        const geo = typeof zone.boundary_geojson === 'string' ? JSON.parse(zone.boundary_geojson) : zone.boundary_geojson;
        if (geo.type !== 'Polygon' || !geo.coordinates || !geo.coordinates[0]) {
            return null;
        }

        const ring = geo.coordinates[0];
        const trimmed = ring.length > 1 ? ring.slice(0, -1) : ring;
        return trimmed.map(([lng, lat]) => [lat, lng]);
    } catch (error) {
        return null;
    }
};

const ZonesCoverageMap = ({ zones }) => {
    const polygons = zones
        .map((zone) => ({
            zone,
            points: parsePolygon(zone)
        }))
        .filter((item) => item.points && item.points.length >= 3);

    const center = polygons.length ? polygons[0].points[0] : DEFAULT_CENTER;

    return (
        <Box sx={{ mb: 2.5 }}>
            <Typography variant="h4" sx={{ mb: 1 }}>
                Zone Coverage Map
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                Active zone boundaries for operational planning and customer coverage checks.
            </Typography>
            <Box sx={{ height: 360, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {polygons.map(({ zone, points }) => (
                        <Polygon key={zone.id} positions={points} pathOptions={{ color: '#265074', fillColor: '#9bcec2', fillOpacity: 0.35 }}>
                            <Popup>
                                <strong>{zone.name}</strong>
                                <br />
                                {zone.zone_code} - {zone.city}
                            </Popup>
                        </Polygon>
                    ))}
                </MapContainer>
            </Box>
        </Box>
    );
};

ZonesCoverageMap.propTypes = {
    zones: PropTypes.array.isRequired
};

export default ZonesCoverageMap;
