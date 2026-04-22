import Axios from 'axios';

const authHeaders = () => ({
    'x-access-token': localStorage.getItem('token') || ''
});

export const getDrivers = async () => {
    const res = await Axios.get('/api/admin/drivers', { headers: authHeaders() });
    return res.data;
};

export const createDriver = async (payload) => {
    const res = await Axios.post('/api/admin/drivers', payload, { headers: authHeaders() });
    return res.data;
};
