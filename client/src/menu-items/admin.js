import {
    Dashboard,
    Subscriptions,
    LocalShipping,
    Timeline,
    Payments,
    SupportAgent,
    Person,
    AdminPanelSettings,
    Engineering,
    AccountBalanceWallet,
    SupervisorAccount,
    People,
    AssignmentTurnedIn,
    Route,
    Hub,
    Insights,
    ReceiptLong,
    MonitorHeart,
    ManageAccounts
} from '@mui/icons-material';
import { appRoutes } from 'constants/appRoutes';

const customerPortal = {
    id: 'customer-portal-group',
    title: 'Customer Portal',
    type: 'group',
    children: [
        {
            id: 'customer-dashboard',
            title: 'Dashboard',
            type: 'item',
            url: appRoutes.customer.dashboard,
            icon: Dashboard,
            color: '#1565c0',
            breadcrumbs: false
        },
        {
            id: 'customer-subscription',
            title: 'Subscription',
            type: 'item',
            url: appRoutes.customer.subscription,
            icon: Subscriptions,
            color: '#2e7d32',
            breadcrumbs: false
        },
        {
            id: 'customer-book-pickup',
            title: 'Book Pickup',
            type: 'item',
            url: appRoutes.customer.bookPickup,
            icon: LocalShipping,
            color: '#ef6c00',
            breadcrumbs: false
        },
        {
            id: 'customer-tracking',
            title: 'Tracking',
            type: 'item',
            url: appRoutes.customer.tracking,
            icon: Timeline,
            color: '#6a1b9a',
            breadcrumbs: false
        },
        {
            id: 'customer-payments',
            title: 'Payments',
            type: 'item',
            url: appRoutes.customer.payments,
            icon: Payments,
            color: '#00838f',
            breadcrumbs: false
        },
        {
            id: 'customer-complaints',
            title: 'Complaints',
            type: 'item',
            url: appRoutes.customer.complaints,
            icon: SupportAgent,
            color: '#c62828',
            breadcrumbs: false
        },
        {
            id: 'customer-profile',
            title: 'Profile',
            type: 'item',
            url: appRoutes.customer.profile,
            icon: Person,
            color: '#37474f',
            breadcrumbs: false
        }
    ]
};

const managementPortal = {
    id: 'management-portal-group',
    title: 'Management Portal',
    type: 'group',
    children: [
        {
            id: 'management-admin',
            title: 'Admin',
            type: 'collapse',
            icon: AdminPanelSettings,
            color: '#1e88e5',
            children: [
                {
                    id: 'admin-dashboard',
                    title: 'Dashboard',
                    type: 'item',
                    url: appRoutes.management.admin.dashboard,
                    icon: Dashboard,
                    breadcrumbs: false
                },
                {
                    id: 'admin-users',
                    title: 'User Manager',
                    type: 'item',
                    url: appRoutes.management.admin.users,
                    icon: ManageAccounts,
                    breadcrumbs: false
                },
                {
                    id: 'admin-customers',
                    title: 'Customer Management',
                    type: 'item',
                    url: appRoutes.management.admin.customers,
                    icon: People,
                    breadcrumbs: false
                },
                {
                    id: 'admin-pickups',
                    title: 'Pickup Management',
                    type: 'item',
                    url: appRoutes.management.admin.pickups,
                    icon: AssignmentTurnedIn,
                    breadcrumbs: false
                },
                {
                    id: 'admin-assignments',
                    title: 'Driver Assignment',
                    type: 'item',
                    url: appRoutes.management.admin.assignments,
                    icon: Engineering,
                    breadcrumbs: false
                },
                {
                    id: 'admin-routes',
                    title: 'Zones & Routes',
                    type: 'item',
                    url: appRoutes.management.admin.routes,
                    icon: Route,
                    breadcrumbs: false
                },
                {
                    id: 'admin-complaints',
                    title: 'Complaints Overview',
                    type: 'item',
                    url: appRoutes.management.admin.complaints,
                    icon: Hub,
                    breadcrumbs: false
                },
                {
                    id: 'admin-reports',
                    title: 'Reports Overview',
                    type: 'item',
                    url: appRoutes.management.admin.reports,
                    icon: Insights,
                    breadcrumbs: false
                }
            ]
        },
        {
            id: 'management-driver',
            title: 'Driver',
            type: 'collapse',
            icon: LocalShipping,
            color: '#2e7d32',
            children: [
                {
                    id: 'driver-dashboard',
                    title: 'Dashboard',
                    type: 'item',
                    url: appRoutes.management.driver.dashboard,
                    icon: Dashboard,
                    breadcrumbs: false
                },
                {
                    id: 'driver-assigned-pickups',
                    title: 'Assigned Pickups',
                    type: 'item',
                    url: appRoutes.management.driver.assignedPickups,
                    icon: AssignmentTurnedIn,
                    breadcrumbs: false
                },
                {
                    id: 'driver-pickup-detail',
                    title: 'Pickup Detail',
                    type: 'item',
                    url: appRoutes.management.driver.pickupDetail,
                    icon: ReceiptLong,
                    breadcrumbs: false
                },
                {
                    id: 'driver-route',
                    title: 'Route',
                    type: 'item',
                    url: appRoutes.management.driver.route,
                    icon: Route,
                    breadcrumbs: false
                }
            ]
        },
        {
            id: 'management-accountant',
            title: 'Accountant',
            type: 'collapse',
            icon: AccountBalanceWallet,
            color: '#00838f',
            children: [
                {
                    id: 'accountant-dashboard',
                    title: 'Dashboard',
                    type: 'item',
                    url: appRoutes.management.accountant.dashboard,
                    icon: Dashboard,
                    breadcrumbs: false
                },
                {
                    id: 'accountant-payments',
                    title: 'Payments Management',
                    type: 'item',
                    url: appRoutes.management.accountant.payments,
                    icon: Payments,
                    breadcrumbs: false
                },
                {
                    id: 'accountant-invoices',
                    title: 'Invoices',
                    type: 'item',
                    url: appRoutes.management.accountant.invoices,
                    icon: ReceiptLong,
                    breadcrumbs: false
                },
                {
                    id: 'accountant-reports',
                    title: 'Financial Reports',
                    type: 'item',
                    url: appRoutes.management.accountant.reports,
                    icon: Insights,
                    breadcrumbs: false
                }
            ]
        },
        {
            id: 'management-support',
            title: 'Support',
            type: 'collapse',
            icon: SupportAgent,
            color: '#ef6c00',
            children: [
                {
                    id: 'support-dashboard',
                    title: 'Dashboard',
                    type: 'item',
                    url: appRoutes.management.support.dashboard,
                    icon: Dashboard,
                    breadcrumbs: false
                },
                {
                    id: 'support-tickets',
                    title: 'Ticket Management',
                    type: 'item',
                    url: appRoutes.management.support.tickets,
                    icon: Hub,
                    breadcrumbs: false
                },
                {
                    id: 'support-issue-detail',
                    title: 'Customer Issue Detail',
                    type: 'item',
                    url: appRoutes.management.support.issueDetail,
                    icon: ReceiptLong,
                    breadcrumbs: false
                }
            ]
        },
        {
            id: 'management-supervisor',
            title: 'Supervisor',
            type: 'collapse',
            icon: SupervisorAccount,
            color: '#6a1b9a',
            children: [
                {
                    id: 'supervisor-dashboard',
                    title: 'Dashboard',
                    type: 'item',
                    url: appRoutes.management.supervisor.dashboard,
                    icon: Dashboard,
                    breadcrumbs: false
                },
                {
                    id: 'supervisor-monitoring',
                    title: 'Driver Monitoring',
                    type: 'item',
                    url: appRoutes.management.supervisor.monitoring,
                    icon: MonitorHeart,
                    breadcrumbs: false
                },
                {
                    id: 'supervisor-oversight',
                    title: 'Pickup Oversight',
                    type: 'item',
                    url: appRoutes.management.supervisor.oversight,
                    icon: AssignmentTurnedIn,
                    breadcrumbs: false
                }
            ]
        }
    ]
};

export const appMenuGroups = [customerPortal, managementPortal];
