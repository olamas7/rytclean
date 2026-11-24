import { lazy } from 'react';

// project imports
import MainLayout from 'layout/MainLayout';
import Loadable from 'ui-component/Loadable';
import ProtectedRoute from './checkAuth/protectRoutes';
import { MainProvider } from 'utils/context/MainContextMenu';

// dashboard routing
const WifiDashboard = Loadable(lazy(() => import('views/Dashboard/WifiDashboard')));
const QuickPurchase = Loadable(lazy(() => import('views/Pages/QuickPurchase')));
const UserProfile = Loadable(lazy(() => import('views/UserProfile')));

// agents routing
const SubscribersList = Loadable(lazy(() => import('views/Agents/SubscribersList')));
const Revenue = Loadable(lazy(() => import('views/Agents/Revenue')));
const ClientsList = Loadable(lazy(() => import('views/Agents/ClientsList')));
const AddFriendWrapper = Loadable(lazy(() => import('views/Agents/AddFriendWrapper')));
const ReceiveRevenue = Loadable(lazy(() => import('views/Admins/receive_revenue')));
const RevenueReport = Loadable(lazy(() => import('views/Admins/RevenueReport')));
const AdminSubscribers = Loadable(lazy(() => import('views/Admins/AdminSubscribers')));
const AdminClients = Loadable(lazy(() => import('views/Admins/AdminClients')));
const ClientHistory = Loadable(lazy(() => import('views/Admins/ClientHistory')));
const AgentSettings = Loadable(lazy(() => import('views/Admins/AgentSettings')));
const BulkSms = Loadable(lazy(() => import('views/Admins/BulkSms')));
const Bonus = Loadable(lazy(() => import('views/Admins/Bonus')));
const HostelSettings = Loadable(lazy(() => import('views/Admins/HostelSettings')));
const PlanSettings = Loadable(lazy(() => import('views/Admins/PlanSettings')));
const SmsSettings = Loadable(lazy(() => import('views/Admins/SmsSettings')));
const WhatsAppApi = Loadable(lazy(() => import('views/Admins/WhatsAppApi')));
const SuperAdminDesk = Loadable(lazy(() => import('views/Admins/SuperAdminDesk')));
const HostelOwnerClients = Loadable(lazy(() => import('views/Admins/HostelOwnerClients')));
const HostelOwnerSubscribers = Loadable(lazy(() => import('views/Admins/HostelOwnerSubscribers')));
const HostelOwnerRevenue = Loadable(lazy(() => import('views/Admins/HostelOwnerRevenue')));
const HostelOwnersDesk = Loadable(lazy(() => import('views/Admins/HostelOwnersDesk')));
const AgentsDesk = Loadable(lazy(() => import('views/Agents/AgentsDesk')));
const ContactUs = Loadable(lazy(() => import('views/Pages/ContactUs')));

// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
  path: '/',
  element: (
    <ProtectedRoute
      element={
        <MainProvider>
          <MainLayout />
        </MainProvider>
      }
    />
  ),
  children: [
    {
      path: '*',
      element: <WifiDashboard />
    },
    {
      path: 'app',
      element: <WifiDashboard />
    },
    {
      path: 'purchase',
      element: <QuickPurchase />
    },
    {
      path: 'contact-us',
      element: <ContactUs />
    },
    {
      path: 'dashboard',
      children: [
        {
          path: 'default',
          element: <WifiDashboard />
        }
      ]
    },
    {
      path: 'user-profile',
      element: <UserProfile />
    },
    {
      path: 'add-friend',
      element: <AddFriendWrapper />
    },
    {
      path: 'buy-friend',
      element: <QuickPurchase />
    },
    {
      path: 'agents',
      children: [
        {
          index: true,
          element: <AgentsDesk />
        },
        {
          path: 'subscribers',
          element: <SubscribersList />
        },
        {
          path: 'my-subscribers',
          element: <SubscribersList agentView />
        },
        {
          path: 'revenue',
          element: <Revenue />
        },
        {
          path: 'clients',
          element: <ClientsList />
        }
      ]
    },
    {
      path: 'super_admins',
      element: <SuperAdminDesk />
    },
    {
      path: 'admins',
      children: [
        {
          path: 'receive-revenue',
          element: <ReceiveRevenue />
        },
        {
          path: 'revenue-report',
          element: <RevenueReport />
        },
        {
          path: 'subscribers',
          element: <AdminSubscribers />
        },
        {
          path: 'clients',
          element: <AdminClients />
        },
        {
          path: 'client-history',
          element: <ClientHistory />
        },
        {
          path: 'agent-settings',
          element: <AgentSettings />
        },
        {
          path: 'bulk-sms',
          element: <BulkSms />
        },
        {
          path: 'bonus',
          element: <Bonus />
        },
        {
          path: 'hostel-settings',
          element: <HostelSettings />
        },
        {
          path: 'plan-settings',
          element: <PlanSettings />
        },
        {
          path: 'sms-settings',
          element: <SmsSettings />
        },
        {
          path: 'whatsapp-api',
          element: <WhatsAppApi />
        }
      ]
    },
    {
      path: 'hostel-owners',
      children: [
        {
          index: true,
          element: <HostelOwnersDesk />
        },
        {
          path: 'subscribers',
          element: <HostelOwnerSubscribers />
        },
        {
          path: 'clients',
          element: <HostelOwnerClients />
        },
        {
          path: 'revenue',
          element: <HostelOwnerRevenue />
        }
      ]
    }
  ]
};

export default MainRoutes;
