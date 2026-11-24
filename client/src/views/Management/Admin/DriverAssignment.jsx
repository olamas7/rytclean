import { Box, Tab, Tabs } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import FleetWorkspace from 'views/Management/Fleet/FleetWorkspace';
import DriverProfiles from './components/DriverProfiles';

export default function DriverAssignment() {
    const [params, setParams] = useSearchParams();
    const profiles = params.get('tab') === 'profiles' || ['new-driver', 'edit-driver'].includes(params.get('view'));
    return <Box>
        {!params.get('fleetView') && !params.get('view') && <Tabs value={profiles ? 'profiles' : 'routes'} onChange={(_, tab) => setParams({ tab })} aria-label="Driver assignment sections" sx={{ mb: 2 }}><Tab value="routes" label="Route Assignments & Vehicles" /><Tab value="profiles" label="Driver Profiles" /></Tabs>}
        {profiles ? <DriverProfiles /> : <FleetWorkspace />}
    </Box>;
}
