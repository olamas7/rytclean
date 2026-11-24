import Axios from 'axios';

const config = () => ({ headers: { 'x-access-token': localStorage.getItem('token') || '' } });

export const getClientCategories = async () => (await Axios.get('/api/admin/client-categories', config())).data;
export const createClientCategory = async (payload) => (await Axios.post('/api/admin/client-categories', payload, config())).data;
export const updateClientCategory = async (id, payload) => (await Axios.patch(`/api/admin/client-categories/${id}`, payload, config())).data;
