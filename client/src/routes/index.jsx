import { createBrowserRouter } from 'react-router-dom';

// routes
import MainRoutes from './MainRoutes';
import AuthenticationRoutes from './AuthenticationRoutes';
import CustomerPaymentCheckout from 'views/Customer/CustomerPaymentCheckout';

// ==============================|| ROUTING RENDER ||============================== //
const router = createBrowserRouter([{ path: '/pay', element: <CustomerPaymentCheckout /> }, AuthenticationRoutes, MainRoutes]);

export default router;
