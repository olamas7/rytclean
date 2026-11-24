import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Paper, Typography } from '@mui/material';
import GoogleMap, { MapFitBounds } from 'ui-component/maps/GoogleMap';
import { MapMarker } from 'ui-component/maps/MapOverlays';
import { TableFilter, TableToolbar } from 'utils/controls/Tables';
import { LdButton } from 'utils/myButtons';
import { toMapPoint } from 'services/googleMaps';

const emptyFilters = { status: 'all', zone: 'all', plan: 'all', category: 'all' };

const CustomerLocationsMap = ({ customers, initialFilters = emptyFilters, initialQuery = '', zoneOptions = [], planOptions = [], categoryOptions = [] }) => {
    const [query, setQuery] = useState(initialQuery);
    const [filters, setFilters] = useState({ ...emptyFilters, ...initialFilters });
    const matches = useMemo(() => {
        const search = query.trim().toLowerCase();
        return customers.filter((customer) =>
            (filters.status === 'all' || customer.status === filters.status)
            && (filters.zone === 'all' || customer.zoneId === filters.zone)
            && (filters.plan === 'all' || customer.planId === filters.plan)
            && (filters.category === 'all' || (filters.category === 'unassigned' ? !customer.categoryId : String(customer.categoryId) === filters.category))
            && (!search || [customer.id, customer.fullName, customer.phone, customer.email, customer.locationAddress, customer.locationDescription]
                .some((value) => String(value || '').toLowerCase().includes(search)))
        );
    }, [customers, query, filters]);
    const locations = matches.map((customer) => ({ customer, point: toMapPoint(customer.latitude, customer.longitude) })).filter(({ point }) => point);
    const missingLocations = matches.length - locations.length;
    const selectFilter = (name, label, options, allLabel) => <TableFilter label={label} value={filters[name]} options={options} allLabel={allLabel} onChange={(value) => setFilters((prev) => ({ ...prev, [name]: value }))} />;

    return <Box>
        <Paper variant="outlined" sx={{ borderRadius: 2, mb: 1.5 }}>
            <TableToolbar title="Customer Locations" count={locations.length} searchValue={query} onSearchChange={setQuery} searchLabel="Search name, ID or phone" filters={<>
                {selectFilter('status', 'Status', [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], 'All statuses')}
                {selectFilter('category', 'Categories', [...categoryOptions, { value: 'unassigned', label: 'Not assigned' }])}
                {selectFilter('zone', 'Zones', zoneOptions)}
                {selectFilter('plan', 'Plans', planOptions)}
            </>} actions={<LdButton variant="text" onClick={() => { setQuery(''); setFilters({ ...emptyFilters }); }}>Reset Filters</LdButton>} />
        </Paper>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {locations.length} of {customers.length} customers shown. Each pin displays the customer ID and name. Zoom in where labels overlap; select a pin for full details.
        </Typography>
        {missingLocations > 0 && <Alert severity="info" sx={{ mb: 1 }}>{missingLocations} matching customer{missingLocations === 1 ? ' has' : 's have'} no valid map location.</Alert>}
        {!locations.length && <Alert severity="info" sx={{ mb: 1 }}>No customer locations match these filters. Change the filters or reset them to see all customers.</Alert>}
        <GoogleMap height="calc(100dvh - 310px)" label="Filtered customer pickup locations">
            <MapFitBounds points={locations.map(({ point }) => point)} />
            {locations.map(({ customer, point }) => {
                const name = String(customer.fullName || '').toUpperCase();
                const label = `${customer.id} · ${name}`;
                return <MapMarker key={customer.id} position={point} title={label} label={label}
                    popup={[name, `Customer ID: ${customer.id}`, customer.categoryName, customer.zoneName, customer.phone, customer.locationAddress || customer.address || `${point.lat}, ${point.lng}`, customer.locationDescription].filter(Boolean).join('\n')} />;
            })}
        </GoogleMap>
    </Box>;
};

CustomerLocationsMap.propTypes = {
    customers: PropTypes.array.isRequired,
    initialFilters: PropTypes.object,
    initialQuery: PropTypes.string,
    zoneOptions: PropTypes.array,
    planOptions: PropTypes.array,
    categoryOptions: PropTypes.array
};
export default CustomerLocationsMap;
