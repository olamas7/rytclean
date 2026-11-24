import Axios from 'axios';

const config = () => ({ headers: { 'x-access-token': localStorage.getItem('token') || '' } });
export const getBillingSettings = async () => (await Axios.get('/api/admin/billing-settings', config())).data;
export const updateBillingSettings = async (payload) => (await Axios.patch('/api/admin/billing-settings', payload, config())).data;
