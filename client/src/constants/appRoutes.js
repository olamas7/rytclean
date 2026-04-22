export const appRoutes = {
    customer: {
        dashboard: '/customer/dashboard',
        subscription: '/customer/subscription',
        bookPickup: '/customer/book-pickup',
        tracking: '/customer/tracking',
        payments: '/customer/payments',
        complaints: '/customer/complaints',
        profile: '/customer/profile'
    },
    management: {
        admin: {
            dashboard: '/management/admin/dashboard',
            users: '/management/admin/users',
            customers: '/management/admin/customers',
            pickups: '/management/admin/pickups',
            assignments: '/management/admin/assignments',
            routes: '/management/admin/routes',
            complaints: '/management/admin/complaints',
            reports: '/management/admin/reports'
        },
        driver: {
            dashboard: '/management/driver/dashboard',
            assignedPickups: '/management/driver/assigned-pickups',
            pickupDetail: '/management/driver/pickup-detail',
            route: '/management/driver/route'
        },
        accountant: {
            dashboard: '/management/accountant/dashboard',
            payments: '/management/accountant/payments',
            invoices: '/management/accountant/invoices',
            reports: '/management/accountant/reports'
        },
        support: {
            dashboard: '/management/support/dashboard',
            tickets: '/management/support/tickets',
            issueDetail: '/management/support/issue-detail'
        },
        supervisor: {
            dashboard: '/management/supervisor/dashboard',
            monitoring: '/management/supervisor/monitoring',
            oversight: '/management/supervisor/oversight'
        }
    }
};

export const defaultRoute = appRoutes.customer.dashboard;
