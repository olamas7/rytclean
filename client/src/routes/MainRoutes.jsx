import { lazy } from 'react';

// project imports
import MainLayout from 'layout/MainLayout';
import Loadable from 'ui-component/Loadable';
import { MainProvider } from 'utils/context/MainContextMenu';
import { allAppPages } from 'constants/appPages';

// routing views
const Unauthorized = Loadable(lazy(() => import('views/Pages/Unauthorized')));
const PagePlaceholder = Loadable(lazy(() => import('views/AppPages/PagePlaceholder')));

// dashboard default for users
const DashboardDefault = Loadable(lazy(() => import('views/Dashboard')));

const appPageChildren = allAppPages.map((page) => ({
  path: page.path.replace(/^\//, ''),
  element: <PagePlaceholder title={page.title} section={page.section} />
}));

const MainRoutes = {
  path: '/',
  element: (
    <MainProvider>
      <MainLayout />
    </MainProvider>
  ),
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
