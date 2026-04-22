import { lazy } from 'react';

// project imports
import MainLayout from 'layout/MainLayout';
import Loadable from 'ui-component/Loadable';
import { MainProvider } from 'utils/context/MainContextMenu';
import { appRoutes } from 'constants/appRoutes';
import { allAppPages } from 'constants/appPages';
import ProtectedRoute from './checkAuth/protectRoutes';

// routing views
const Unauthorized = Loadable(lazy(() => import('views/Pages/Unauthorized')));
const PagePlaceholder = Loadable(lazy(() => import('views/AppPages/PagePlaceholder')));
const CustomerDashboard = Loadable(lazy(() => import('views/Customer/CustomerDashboard')));
const SubscriptionPlans = Loadable(lazy(() => import('views/Customer/SubscriptionPlans')));
const BookPickup = Loadable(lazy(() => import('views/Customer/BookPickup')));
const PickupTracking = Loadable(lazy(() => import('views/Customer/PickupTracking')));
const CustomerPayments = Loadable(lazy(() => import('views/Customer/CustomerPayments')));
const CustomerComplaints = Loadable(lazy(() => import('views/Customer/CustomerComplaints')));
const CustomerProfile = Loadable(lazy(() => import('views/Customer/CustomerProfile')));
const AdminDashboard = Loadable(lazy(() => import('views/Management/Admin/AdminDashboard')));
const UserManager = Loadable(lazy(() => import('views/Management/Admin/UserManager')));
const CustomerManagement = Loadable(lazy(() => import('views/Management/Admin/CustomerManagement')));
const PickupManagement = Loadable(lazy(() => import('views/Management/Admin/PickupManagement')));
const DriverAssignment = Loadable(lazy(() => import('views/Management/Admin/DriverAssignment')));
const ZonesRoutes = Loadable(lazy(() => import('views/Management/Admin/ZonesRoutes')));
const ComplaintsOverview = Loadable(lazy(() => import('views/Management/Admin/ComplaintsOverview')));
const ReportsOverview = Loadable(lazy(() => import('views/Management/Admin/ReportsOverview')));
const DriverDashboard = Loadable(lazy(() => import('views/Management/Driver/DriverDashboard')));
const AssignedPickups = Loadable(lazy(() => import('views/Management/Driver/AssignedPickups')));
const PickupDetail = Loadable(lazy(() => import('views/Management/Driver/PickupDetail')));
const DriverRoute = Loadable(lazy(() => import('views/Management/Driver/DriverRoute')));
const SupportDashboard = Loadable(lazy(() => import('views/Management/Support/SupportDashboard')));
const TicketManagement = Loadable(lazy(() => import('views/Management/Support/TicketManagement')));
const CustomerIssueDetail = Loadable(lazy(() => import('views/Management/Support/CustomerIssueDetail')));
const AccountantDashboard = Loadable(lazy(() => import('views/Management/Accountant/AccountantDashboard')));
const PaymentsManagement = Loadable(lazy(() => import('views/Management/Accountant/PaymentsManagement')));
const Invoices = Loadable(lazy(() => import('views/Management/Accountant/Invoices')));
const FinancialReports = Loadable(lazy(() => import('views/Management/Accountant/FinancialReports')));
const SupervisorDashboard = Loadable(lazy(() => import('views/Management/Supervisor/SupervisorDashboard')));
const DriverMonitoring = Loadable(lazy(() => import('views/Management/Supervisor/DriverMonitoring')));
const PickupOversight = Loadable(lazy(() => import('views/Management/Supervisor/PickupOversight')));

// dashboard default for users
const DashboardDefault = Loadable(lazy(() => import('views/Dashboard')));

const buildPageElement = (page) => {
    if (page.path === appRoutes.customer.dashboard) {
        return <CustomerDashboard />;
    }

    if (page.path === appRoutes.customer.subscription) {
        return <SubscriptionPlans />;
    }

    if (page.path === appRoutes.customer.bookPickup) {
        return <BookPickup />;
    }

    if (page.path === appRoutes.customer.tracking) {
        return <PickupTracking />;
    }

    if (page.path === appRoutes.customer.payments) {
        return <CustomerPayments />;
    }

    if (page.path === appRoutes.customer.complaints) {
        return <CustomerComplaints />;
    }

    if (page.path === appRoutes.customer.profile) {
        return <CustomerProfile />;
    }

    if (page.path === appRoutes.management.admin.dashboard) {
        return <AdminDashboard />;
    }

    if (page.path === appRoutes.management.admin.users) {
        return <UserManager />;
    }

    if (page.path === appRoutes.management.admin.customers) {
        return <CustomerManagement />;
    }

    if (page.path === appRoutes.management.admin.pickups) {
        return <PickupManagement />;
    }

    if (page.path === appRoutes.management.admin.assignments) {
        return <DriverAssignment />;
    }

    if (page.path === appRoutes.management.admin.routes) {
        return <ZonesRoutes />;
    }

    if (page.path === appRoutes.management.admin.complaints) {
        return <ComplaintsOverview />;
    }

    if (page.path === appRoutes.management.admin.reports) {
        return <ReportsOverview />;
    }

    if (page.path === appRoutes.management.driver.dashboard) {
        return <DriverDashboard />;
    }

    if (page.path === appRoutes.management.driver.assignedPickups) {
        return <AssignedPickups />;
    }

    if (page.path === appRoutes.management.driver.pickupDetail) {
        return <PickupDetail />;
    }

    if (page.path === appRoutes.management.driver.route) {
        return <DriverRoute />;
    }

    if (page.path === appRoutes.management.support.dashboard) {
        return <SupportDashboard />;
    }

    if (page.path === appRoutes.management.support.tickets) {
        return <TicketManagement />;
    }

    if (page.path === appRoutes.management.support.issueDetail) {
        return <CustomerIssueDetail />;
    }

    if (page.path === appRoutes.management.accountant.dashboard) {
        return <AccountantDashboard />;
    }

    if (page.path === appRoutes.management.accountant.payments) {
        return <PaymentsManagement />;
    }

    if (page.path === appRoutes.management.accountant.invoices) {
        return <Invoices />;
    }

    if (page.path === appRoutes.management.accountant.reports) {
        return <FinancialReports />;
    }

    if (page.path === appRoutes.management.supervisor.dashboard) {
        return <SupervisorDashboard />;
    }

    if (page.path === appRoutes.management.supervisor.monitoring) {
        return <DriverMonitoring />;
    }

    if (page.path === appRoutes.management.supervisor.oversight) {
        return <PickupOversight />;
    }

    return <PagePlaceholder title={page.title} section={page.section} />;
};

const appPageChildren = allAppPages.map((page) => ({
    path: page.path.replace(/^\//, ''),
    element: buildPageElement(page)
}));

const MainRoutes = {
    path: '/',
    element: <ProtectedRoute element={<MainProvider><MainLayout /></MainProvider>} />,
    children: [
        {
            path: '*',
            element: <DashboardDefault />
        },
        ...appPageChildren,
        {
            path: 'unauthorized',
            element: <Unauthorized />
        }
    ]
};

export default MainRoutes;
