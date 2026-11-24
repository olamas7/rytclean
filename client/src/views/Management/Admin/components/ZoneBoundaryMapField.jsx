import PropTypes from 'prop-types';
import { useRef } from 'react';
import { Stack, Typography } from '@mui/material';
import GoogleMap, { MapFitBounds } from 'ui-component/maps/GoogleMap';
import { MapMarker, MapShape } from 'ui-component/maps/MapOverlays';
import { polygonPaths, toPolygonGeoJson } from 'services/googleMaps';
import { LdButton } from 'utils/myButtons';

const ZoneBoundaryMapField = ({ value, onChange }) => {
    const paths = polygonPaths(value);
    const points = paths[0] || [];
    const initialPoints = useRef(points);
    const updatePoints = (next) => onChange(toPolygonGeoJson([next, ...paths.slice(1)]));

    return <Stack spacing={1.25}>
        <Typography variant="subtitle2">Zone Boundary</Typography>
        <Typography variant="caption" color="text.secondary">Click the map to add at least 3 boundary points. Drag the vertices or their midpoint handles to adjust the shape. Existing interior boundaries are retained.</Typography>
        <GoogleMap height={340} label="Edit zone boundary" onClick={(point) => updatePoints([...points, point])}>
            <MapFitBounds points={initialPoints.current} />
            {points.length === 1 && <MapMarker position={points[0]} title="First boundary point" />}
            {points.length > 0 && <MapShape paths={points.length >= 3 ? paths : [points]} polygon={points.length >= 3} editable onChange={(nextPaths) => points.length >= 3 ? onChange(toPolygonGeoJson(nextPaths)) : updatePoints(nextPaths[0] || [])} />}
        </GoogleMap>
        <Typography variant="caption" color="text.secondary">{points.length} boundary point{points.length === 1 ? '' : 's'} selected</Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <LdButton variant="outlined" color="secondary" onClick={() => updatePoints(points.slice(0, -1))} disabled={!points.length}>Remove Last Point</LdButton>
            <LdButton variant="outlined" color="error" onClick={() => onChange(null)} disabled={!points.length}>Clear Boundary</LdButton>
        </Stack>
    </Stack>;
};

ZoneBoundaryMapField.propTypes = { value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]), onChange: PropTypes.func.isRequired };
export default ZoneBoundaryMapField;
