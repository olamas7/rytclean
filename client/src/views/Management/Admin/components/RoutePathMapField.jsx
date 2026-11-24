import PropTypes from 'prop-types';
import { useRef } from 'react';
import { Stack, Typography } from '@mui/material';
import GoogleMap, { MapFitBounds } from 'ui-component/maps/GoogleMap';
import { MapMarker, MapShape } from 'ui-component/maps/MapOverlays';
import { linePoints, toLineGeoJson } from 'services/googleMaps';
import { LdButton } from 'utils/myButtons';

const RoutePathMapField = ({ value, onChange }) => {
    const points = linePoints(value);
    const initialPoints = useRef(points);
    return <Stack spacing={1.25}>
        <Typography variant="subtitle2">Route Path</Typography>
        <Typography variant="caption" color="text.secondary">Click to add at least 2 points. Drag the points or midpoint handles to adjust the path. This is a manually planned line, not a calculated driving route.</Typography>
        <GoogleMap height={340} label="Edit collection route path" onClick={(point) => onChange(toLineGeoJson([...points, point]))}>
            <MapFitBounds points={initialPoints.current} />
            {points.length === 1 && <MapMarker position={points[0]} title="Route start" />}
            {points.length > 0 && <MapShape paths={[points]} editable onChange={(paths) => onChange(toLineGeoJson(paths[0] || []))} />}
        </GoogleMap>
        <Typography variant="caption" color="text.secondary">{points.length} route point{points.length === 1 ? '' : 's'} selected</Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <LdButton variant="outlined" color="secondary" onClick={() => onChange(toLineGeoJson(points.slice(0, -1)))} disabled={!points.length}>Remove Last Point</LdButton>
            <LdButton variant="outlined" color="error" onClick={() => onChange(null)} disabled={!points.length}>Clear Route Path</LdButton>
        </Stack>
    </Stack>;
};

RoutePathMapField.propTypes = { value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]), onChange: PropTypes.func.isRequired };
export default RoutePathMapField;
