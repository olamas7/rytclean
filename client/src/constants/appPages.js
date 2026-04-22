import { appRoutes } from './appRoutes';

export const customerPages = [
    { path: appRoutes.customer.dashboard, title: 'Customer Dashboard', section: 'Customer Portal' },
    { path: appRoutes.customer.subscription, title: 'Subscription / Plans', section: 'Customer Portal' },
    { path: appRoutes.customer.bookPickup, title: 'Book Pickup', section: 'Customer Portal' },
    { path: appRoutes.customer.tracking, title: 'Pickup Tracking', section: 'Customer Portal' },
    { path: appRoutes.customer.payments, title: 'Payments', section: 'Customer Portal' },
    { path: appRoutes.customer.complaints, title: 'Complaints / Support', section: 'Customer Portal' },
    { path: appRoutes.customer.profile, title: 'Profile', section: 'Customer Portal' }
];

export const managementPages = [
    { path: appRoutes.management.admin.dashboard, title: 'Admin Dashboard', section: 'Admin' },
    { path: appRoutes.management.admin.users, title: 'User Manager', section: 'Admin' },
    { path: appRoutes.management.admin.customers, title: 'Customer Management', section: 'Admin' },
    { path: appRoutes.management.admin.pickups, title: 'Pickup Management', section: 'Admin' },
    { path: appRoutes.management.admin.assignments, title: 'Driver Assignment', section: 'Admin' },
    { path: appRoutes.management.admin.routes, title: 'Zones and Routes', section: 'Admin' },
    { path: appRoutes.management.admin.complaints, title: 'Complaints Overview', section: 'Admin' },
    { path: appRoutes.management.admin.reports, title: 'Reports Overview', section: 'Admin' },
    { path: appRoutes.management.driver.dashboard, title: 'Driver Dashboard', section: 'Driver' },
    { path: appRoutes.management.driver.assignedPickups, title: 'Assigned Pickups', section: 'Driver' },
    { path: appRoutes.management.driver.pickupDetail, title: 'Pickup Detail', section: 'Driver' },
    { path: appRoutes.management.driver.route, title: 'Route', section: 'Driver' },
    { path: appRoutes.management.accountant.dashboard, title: 'Accountant Dashboard', section: 'Accountant' },
    { path: appRoutes.management.accountant.payments, title: 'Payments Management', section: 'Accountant' },
    { path: appRoutes.management.accountant.invoices, title: 'Invoices', section: 'Accountant' },
    { path: appRoutes.management.accountant.reports, title: 'Financial Reports', section: 'Accountant' },
    { path: appRoutes.management.support.dashboard, title: 'Support Dashboard', section: 'Support' },
    { path: appRoutes.management.support.tickets, title: 'Ticket Management', section: 'Support' },
    { path: appRoutes.management.support.issueDetail, title: 'Customer Issue Detail', section: 'Support' },
    { path: appRoutes.management.supervisor.dashboard, title: 'Supervisor Dashboard', section: 'Supervisor' },
    { path: appRoutes.management.supervisor.monitoring, title: 'Driver Monitoring', section: 'Supervisor' },
    { path: appRoutes.management.supervisor.oversight, title: 'Pickup Oversight', section: 'Supervisor' }
];

export const allAppPages = [...customerPages, ...managementPages];
