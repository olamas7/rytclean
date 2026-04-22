export const pickupRequests = [
    {
        id: 'PK-2026-001',
        customerId: 'CUST-001',
        driverId: 'DRV-001',
        zoneId: 'ZONE-AC-01',
        wasteType: 'Household',
        pickupDate: '2026-04-24',
        pickupTime: '08:30',
        status: 'scheduled',
        emergency: false,
        extraBin: true,
        address: '14 Palm Street, East Legon, Accra'
    },
    {
        id: 'PK-2026-002',
        customerId: 'CUST-002',
        driverId: 'DRV-002',
        zoneId: 'ZONE-AC-02',
        wasteType: 'Recyclables',
        pickupDate: '2026-04-27',
        pickupTime: '09:00',
        status: 'assigned',
        emergency: false,
        extraBin: false,
        address: '6 Ring Road Central, Accra'
    },
    {
        id: 'PK-2026-003',
        customerId: 'CUST-003',
        driverId: 'DRV-003',
        zoneId: 'ZONE-TM-01',
        wasteType: 'Commercial',
        pickupDate: '2026-04-23',
        pickupTime: '07:40',
        status: 'on the way',
        emergency: true,
        extraBin: true,
        address: '22 Liberation Road, Tema'
    },
    {
        id: 'PK-2026-004',
        customerId: 'CUST-005',
        driverId: 'DRV-004',
        zoneId: 'ZONE-AC-03',
        wasteType: 'General Waste',
        pickupDate: '2026-04-20',
        pickupTime: '10:15',
        status: 'completed',
        emergency: false,
        extraBin: false,
        address: '17 Spintex Road, Accra'
    }
];
