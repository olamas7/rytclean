import { payments, revenueSummary } from 'mocks/data';
import { withMockResponse } from './utils';

export const getPayments = (options) => withMockResponse(() => payments, options);

export const getCustomerPayments = (customerId, options) =>
    withMockResponse(() => payments.filter((payment) => (customerId ? payment.customerId === customerId : true)), options);

export const getRevenueSummary = (options) => withMockResponse(() => revenueSummary, options);
