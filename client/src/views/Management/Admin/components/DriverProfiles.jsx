import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import { Edit } from '@mui/icons-material';
import { getDrivers, createDriver } from 'services/api/driversService';
import { getUsers } from 'services/api/usersService';
import { getZones } from 'services/api/zonesRoutesService';
import { fleetGet, fleetPatch } from 'services/api/fleetService';
import { PageHeader } from 'ui-component/PageLayout';
import { AppTable, TableActionButton, TablePrimaryText, TableToolbar } from 'utils/controls/Tables';
import { LdButton } from 'utils/myButtons';
import useInlineNavigation from 'utils/useInlineNavigation';
import StatusBadge from 'ui-component/StatusBadge';
import DriverForm from './DriverForm';

const sections = { 'new-driver': { label: 'New Driver Profile' }, 'edit-driver': { label: 'Edit Driver Profile' } };
export default function DriverProfiles() {
    const [drivers, setDrivers] = useState([]); const [users, setUsers] = useState([]); const [zones, setZones] = useState([]); const [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [feedback, setFeedback] = useState('');
    const lock = useRef(false);
    const inline = useInlineNavigation({ sections, rootLabel: 'Driver Assignment', contextKeys: ['driver'], blocked: saving });
    const selected = inline.view === 'edit-driver' ? drivers.find((driver) => String(driver.dbId) === inline.params.get('driver')) : null;
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [driverResponse, userResponse, zoneResponse, metadata] = await Promise.all([getDrivers(), getUsers({ workTitle: 'driver', withoutDriver: true }), getZones(), fleetGet('/options')]);
            for (const response of [driverResponse, userResponse, zoneResponse]) if (response.code !== 1) throw new Error(response.message);
            setDrivers(driverResponse.data); setUsers(userResponse.data.filter((user) => Number(user.status) === 1)); setZones(zoneResponse.data); setOptions(metadata);
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);
    const save = async (values) => {
        if (lock.current || (inline.view === 'edit-driver' && !selected)) return;
        lock.current = true; setSaving(true); setError('');
        try {
            if (selected) await fleetPatch(`/drivers/${selected.dbId}`, values);
            else { const response = await createDriver(values); if (response.code !== 1) throw new Error(response.message); }
            inline.close(); setFeedback('Driver profile saved. Vehicles are assigned separately per route.'); await load();
        } catch (err) { setError(err.response?.data?.message || err.message); }
        finally { lock.current = false; setSaving(false); }
    };
    return <Box sx={{ p: { xs: 1, md: 2 } }}><Stack spacing={2}>
        <PageHeader title={inline.view ? sections[inline.view].label : 'Driver Profiles'} inlineNavigation={inline.navigation} actions={!inline.view && <LdButton onClick={() => { setError(''); inline.open('new-driver'); }}>Add Driver Profile</LdButton>} />
        {error && <Alert severity="error">{error}</Alert>}{feedback && <Alert severity="success">{feedback}</Alert>}
        <Alert severity="info">Create the driver login in User Manager first. Vehicles belong to the fleet register and are selected for each route assignment, not permanently attached to a driver profile.</Alert>
        {inline.view ? loading ? <Typography role="status">Loading driver data…</Typography> : inline.view === 'edit-driver' && !selected ? <Alert severity="warning">Driver not found.</Alert> : <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, maxWidth: 1000 }}><DriverForm key={selected?.dbId || 'new'} open driverUsers={selected ? [{ id: selected.userId, fullname: selected.fullName, username: selected.id }] : users} zones={zones} initialValues={selected} loading={saving} onCancel={inline.back} onSubmit={save} /></Paper> : <AppTable ariaLabel="Driver profiles" rows={drivers} loading={loading} error={error} onRetry={load} columns={[
            { id: 'fullName', label: 'Driver', render: (driver) => <TablePrimaryText primary={driver.fullName} secondary={driver.id} /> }, { id: 'phone', label: 'Phone' }, { id: 'zoneName', label: 'Base Zone' },
            { id: 'status', label: 'Availability', render: (driver) => <StatusBadge label={Number(driver.userStatus) !== 1 ? 'inactive' : options?.drivers.find((item) => item.id === driver.dbId)?.open_run_id ? 'assigned' : driver.status} /> },
            { id: 'actions', label: 'Actions', render: (driver) => <TableActionButton label={`Edit ${driver.fullName}`} icon={<Edit />} disabled={Boolean(options?.drivers.find((item) => item.id === driver.dbId)?.open_run_id)} tooltip="Finish/cancel an open route before changing driver availability" onClick={() => inline.open('edit-driver', { driver: driver.dbId })} /> }
        ]} emptyTitle="No driver profiles" toolbar={<TableToolbar title="Driver Profiles" count={drivers.length} actions={<LdButton onClick={load} loading={loading}>Refresh</LdButton>} />} />}
    </Stack></Box>;
}
