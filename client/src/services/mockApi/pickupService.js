import { pickupRequests, drivers, routes, zones } from 'mocks/data';
import { withMockResponse } from './utils';

export const getPickupRequests = (options) => withMockResponse(() => pickupRequests, options);

export const getPickupById = (pickupId, options) =>
    withMockResponse(() => pickupRequests.find((pickup) => pickup.id === pickupId) || null, options);

export const getDrivers = (options) => withMockResponse(() => drivers, options);

export const getRoutes = (options) => withMockResponse(() => routes, options);

export const getZones = (options) => withMockResponse(() => zones, options);
