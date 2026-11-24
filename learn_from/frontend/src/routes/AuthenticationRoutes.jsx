import { lazy } from 'react';

// project imports
import Loadable from 'ui-component/Loadable';
import MinimalLayout from 'layout/MinimalLayout';
import ProtectLogin from './checkAuth/protectLogin';

// login option 3 routing
const Logins = Loadable(lazy(() => import('views/Logins/new_Login')));
const Register = Loadable(lazy(() => import('views/Logins/Register')));
const ForgotPassword = Loadable(lazy(() => import('views/Logins/ForgotPassword')));
const QuickPurchase = Loadable(lazy(() => import('views/Pages/QuickPurchase'))); // Import
const FairUsePolicy = Loadable(lazy(() => import('views/Pages/FairUsePolicy')));
const Page404 = Loadable(lazy(() => import('views/Pages/Page404')));

// ==============================|| AUTHENTICATION ROUTING ||============================== //

const AuthenticationRoutes = {
    path: '/',
    element: <ProtectLogin element={<MinimalLayout />} />,
    children: [
        {
            path: '/',
            element: <Logins />
        },
        {
            path: '*',
            element: <Page404 />
        },
        {
            path: '/login',
            element: <Logins />
        },
        {
            path: '/register',
            element: <Register />
        },
        {
            path: '/forgot-password',
            element: <ForgotPassword />
        },
        {
            path: '/quick-purchase',
            element: <QuickPurchase />
        },
        {
            path: '/fair-use-policy',
            element: <FairUsePolicy />
        }
    ]
};
export default AuthenticationRoutes;
