import Axios from 'axios';

const authHeaders = () => ({
    'x-access-token': localStorage.getItem('token') || ''
});

export const getPlans = async () => {
    const res = await Axios.get('/api/admin/plans', { headers: authHeaders() });
    return res.data;
};

export const createPlan = async (payload) => {
    const res = await Axios.post('/api/admin/plans', payload, { headers: authHeaders() });
    return res.data;
};

export const updatePlan = async (id, payload) => {
    const res = await Axios.patch(`/api/admin/plans/${id}`, payload, { headers: authHeaders() });
    return res.data;
};
