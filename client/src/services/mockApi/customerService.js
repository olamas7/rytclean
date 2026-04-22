import { customers, complaints, subscriptionPlans } from 'mocks/data';
import { withMockResponse } from './utils';

export const getCustomers = (options) => withMockResponse(() => customers, options);

export const getCustomerById = (customerId, options) =>
    withMockResponse(() => customers.find((customer) => customer.id === customerId) || null, options);

export const getCustomerPlans = (options) => withMockResponse(() => subscriptionPlans, options);

export const getCustomerComplaints = (customerId, options) =>
    withMockResponse(() => complaints.filter((complaint) => (customerId ? complaint.customerId === customerId : true)), options);
