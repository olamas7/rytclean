import { lazy } from 'react';

// project imports
import Loadable from 'ui-component/Loadable';
import MinimalLayout from 'layout/MinimalLayout';
import ProtectLogin from './checkAuth/protectLogin';

// login option 3 routing
const Logins = Loadable(lazy(() => import('views/Logins')));

// ==============================|| AUTHENTICATION ROUTING ||============================== //

const AuthenticationRoutes = {
  path: '/login',
  element: <MinimalLayout />,
  children: [
    {
      path: '',
      element: <ProtectLogin element={<Logins />} />
    }
  ]
};

export default AuthenticationRoutes;
