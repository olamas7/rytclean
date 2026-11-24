import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import GoogleMap, { MapFitBounds } from 'ui-component/maps/GoogleMap';
import { MapShape } from 'ui-component/maps/MapOverlays';
import { polygonPaths } from 'services/googleMaps';

const ZonesCoverageMap = ({ zones }) => {
    const boundaries = zones.map((zone) => ({ zone, paths: polygonPaths(zone.boundary_geojson) })).filter(({ paths }) => paths[0]?.length >= 3);
    return <Box sx={{ mb: 2.5 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>Zone Coverage Map</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>Saved coverage boundaries. Select a zone on the map to see its details.</Typography>
        <GoogleMap height={360} label="Zone coverage boundaries">
            <MapFitBounds points={boundaries.flatMap(({ paths }) => paths[0])} maxZoom={14} />
            {boundaries.map(({ zone, paths }) => <MapShape key={zone.id} paths={paths} polygon popup={[zone.name, zone.zone_code, zone.city].filter(Boolean).join('\n')} />)}
        </GoogleMap>
        {!boundaries.length && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>No saved zone boundaries to display yet.</Typography>}
    </Box>;
};

ZonesCoverageMap.propTypes = { zones: PropTypes.array.isRequired };
export default ZonesCoverageMap;
