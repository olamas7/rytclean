import Axios from 'axios';

const authHeaders = () => ({
    'x-access-token': localStorage.getItem('token') || ''
});

export const getUsers = async (workTitle = '') => {
    const params = workTitle ? { workTitle } : {};
    const res = await Axios.get('/api/admin/users', { headers: authHeaders(), params });
    return res.data;
};

export const createUser = async (payload) => {
    const res = await Axios.post('/api/admin/users', payload, { headers: authHeaders() });
    return res.data;
};
