import { complaints, tickets, notifications } from 'mocks/data';
import { withMockResponse } from './utils';

export const getTickets = (options) => withMockResponse(() => tickets, options);

export const getComplaints = (options) => withMockResponse(() => complaints, options);

export const getNotifications = (options) => withMockResponse(() => notifications, options);
