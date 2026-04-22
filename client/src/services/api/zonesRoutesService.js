import Axios from 'axios';

const authHeaders = () => ({
    'x-access-token': localStorage.getItem('token') || ''
});

export const getZones = async () => {
    const res = await Axios.get('/api/admin/zones', { headers: authHeaders() });
    return res.data;
};

export const createZone = async (payload) => {
    const res = await Axios.post('/api/admin/zones', payload, { headers: authHeaders() });
    return res.data;
};

export const getRoutes = async () => {
    const res = await Axios.get('/api/admin/routes', { headers: authHeaders() });
    return res.data;
};

export const createRoute = async (payload) => {
    const res = await Axios.post('/api/admin/routes', payload, { headers: authHeaders() });
    return res.data;
};
