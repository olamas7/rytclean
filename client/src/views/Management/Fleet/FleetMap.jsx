import PropTypes from 'prop-types';
import { Stack, Typography, useTheme } from '@mui/material';
import GoogleMap, { MapFitBounds } from 'ui-component/maps/GoogleMap';
import { MapMarker, MapShape } from 'ui-component/maps/MapOverlays';

export default function FleetMap({ run }) {
    const theme = useTheme();
    const route = run.route_geojson?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || [];
    const stops = run.stops || [];
    const trails = [];
    (run.trail || []).forEach((point, index, source) => {
        if (!index || Date.parse(point.captured_at) - Date.parse(source[index - 1].captured_at) > 120000) trails.push([]);
        trails.at(-1).push({ lat: Number(point.latitude), lng: Number(point.longitude) });
    });
    const position = run.latest_lat !== null && run.latest_lat !== undefined ? { lat: Number(run.latest_lat), lng: Number(run.latest_lng) } : null;
    return <Stack spacing={1}>
        <Typography variant="body2">Map: red = open complaint · green = collected · amber = visited/not collected · blue = pending. Proximity never confirms collection.</Typography>
        <GoogleMap height={420} label="Assigned route, customer stops and actual vehicle trail">
            <MapFitBounds points={route.length ? route : stops.map((stop) => ({ lat: Number(stop.latitude), lng: Number(stop.longitude) }))} />
            {route.length > 1 && <MapShape paths={[route]} color={theme.palette.primary.main} popup="Planned route (drawn path, not calculated road directions)" />}
            {trails.map((trail, index) => trail.length > 1 && <MapShape key={index} paths={[trail]} color={theme.palette.success.main} popup="Accepted GPS trail; gaps are not included in the distance total" />)}
            {stops.map((stop) => <MapMarker key={stop.id} position={{ lat: Number(stop.latitude), lng: Number(stop.longitude) }} label={`${stop.stop_order}. ${stop.customer_name} · ${stop.complaint ? 'COMPLAINT · ' : ''}${stop.status}`} color={stop.complaint ? theme.palette.error.main : stop.status === 'collected' ? theme.palette.success.main : ['visited', 'not_collected'].includes(stop.status) ? theme.palette.warning.main : theme.palette.primary.main} popup={`${stop.customer_code} · ${stop.customer_name}\n${stop.address}\n${stop.complaint_note || stop.note || stop.status}`} />)}
            {position && <MapMarker position={position} color={theme.palette.secondary.main} label={`${run.driver_name} · ${run.tracking}`} popup={`Last accepted position: ${run.latest_at}\nAccuracy: ${run.latest_accuracy} m\n${run.registration}`} />}
        </GoogleMap>
    </Stack>;
}
FleetMap.propTypes = { run: PropTypes.object.isRequired };

export function FleetOverviewMap({ runs }) {
    const theme = useTheme();
    const located = runs.filter((run) => ['assigned', 'started'].includes(run.status) && run.latest_lat !== null && run.latest_lat !== undefined);
    if (!located.length) return <Typography variant="body2" color="text.secondary">No GPS positions have been transmitted for open assignments. Start the assigned route and enable driver GPS to populate this map.</Typography>;
    return <Stack spacing={1}>
        <Typography variant="h4" component="h2">Fleet Movement Overview</Typography>
        <Typography variant="body2">Green = on route · red = sustained deviation · amber = stale/checking. These are last reported device positions, not proof of collection.</Typography>
        <GoogleMap height={380} label="Last reported positions of authorised route assignments">
            <MapFitBounds points={located.map((run) => ({ lat: Number(run.latest_lat), lng: Number(run.latest_lng) }))} />
            {located.map((run) => <MapMarker key={run.id} position={{ lat: Number(run.latest_lat), lng: Number(run.latest_lng) }} label={`${run.registration} · ${run.driver_name} · ${run.tracking}`} color={run.tracking === 'off route' ? theme.palette.error.main : run.tracking === 'on route' ? theme.palette.success.main : theme.palette.warning.main} popup={`${run.route_name}\n${run.movement}\n${run.latest_at}\n${Number(run.distanceKm).toFixed(2)} km recorded GPS\nOpen the assignment below for customer stops and evidence.`} />)}
        </GoogleMap>
    </Stack>;
}
FleetOverviewMap.propTypes = { runs: PropTypes.array.isRequired };
