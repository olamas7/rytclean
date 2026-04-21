import { lazy } from 'react';

// project imports
import Loadable from 'ui-component/Loadable';
import MinimalLayout from 'layout/MinimalLayout';
import ProtectLogin from './checkAuth/protectLogin';

// login option 3 routing
const Logins = Loadable(lazy(() => import('views/Logins')));
const Page404 = Loadable(lazy(() => import('views/Pages/Page404')));

// ==============================|| AUTHENTICATION ROUTING ||============================== //

const AuthenticationRoutes = {
  path: '/',
  element: <MinimalLayout />,
  children: [
    {
      path: '/',
      element: <ProtectLogin element={<Logins />} />
    },
    {
      path: '/login',
      element: <ProtectLogin element={<Logins />} />
    }
  ]
};

export default AuthenticationRoutes;
