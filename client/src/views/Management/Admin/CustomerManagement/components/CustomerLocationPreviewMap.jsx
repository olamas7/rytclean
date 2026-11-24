import PropTypes from 'prop-types';
import { Alert, Stack } from '@mui/material';
import { Navigation } from '@mui/icons-material';
import GoogleMap from 'ui-component/maps/GoogleMap';
import { MapMarker } from 'ui-component/maps/MapOverlays';
import { toMapPoint } from 'services/googleMaps';
import { LdButton } from 'utils/myButtons';

const CustomerLocationPreviewMap = ({ latitude, longitude, label }) => {
    const position = toMapPoint(latitude, longitude);
    if (!position) return <Alert severity="warning">No valid location has been saved for this customer.</Alert>;
    const destination = encodeURIComponent(`${position.lat},${position.lng}`);
    return <Stack spacing={1.5}>
        <GoogleMap center={position} zoom={16} height={340} label="Customer location">
            <MapMarker position={position} title={label || 'Customer location'} popup={label || `${position.lat}, ${position.lng}`} />
        </GoogleMap>
        <LdButton component="a" href={`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<Navigation />} sx={{ alignSelf: 'flex-start' }}>Navigate with Google Maps</LdButton>
    </Stack>;
};

CustomerLocationPreviewMap.propTypes = { latitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired, longitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired, label: PropTypes.string };
export default CustomerLocationPreviewMap;
