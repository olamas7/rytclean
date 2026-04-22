import Axios from 'axios';

const authHeaders = () => ({
    'x-access-token': localStorage.getItem('token') || ''
});

export const getPickups = async () => {
    const res = await Axios.get('/api/admin/pickups', { headers: authHeaders() });
    return res.data;
};

export const assignPickup = async (payload) => {
    const res = await Axios.post('/api/admin/assignments', payload, { headers: authHeaders() });
    return res.data;
};
