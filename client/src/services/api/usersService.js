import Axios from 'axios';

const authHeaders = () => ({
    'x-access-token': localStorage.getItem('token') || ''
});

export const getUsers = async (options = {}) => {
    const params = {};

    if (typeof options === 'string') {
        if (options) {
            params.workTitle = options;
        }
    } else {
        if (options.workTitle) {
            params.workTitle = options.workTitle;
        }
        if (options.withoutDriver) {
            params.withoutDriver = 1;
        }
    }

    const res = await Axios.get('/api/admin/users', { headers: authHeaders(), params });
    return res.data;
};

export const createUser = async (payload) => {
    const res = await Axios.post('/api/admin/users', payload, { headers: authHeaders() });
    return res.data;
};

export const updateUser = async (id, payload) => {
    const res = await Axios.patch(`/api/admin/users/${id}`, payload, { headers: authHeaders() });
    return res.data;
};
