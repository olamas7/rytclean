import Axios from 'axios';

const authHeaders = () => ({
    'x-access-token': localStorage.getItem('token') || ''
});

export const getCustomers = async () => {
    const res = await Axios.get('/api/admin/customers', { headers: authHeaders() });
    return res.data;
};

const customerBody = (payload) => {
    const { housePhoto, ...details } = payload;
    if (!housePhoto?.file) return { ...details, removeHousePhoto: Boolean(housePhoto?.remove) };
    const body = new FormData();
    Object.entries(details).forEach(([key, value]) => { if (value !== undefined && value !== null) body.append(key, String(value)); });
    body.append('housePhoto', housePhoto.file);
    return body;
};

export const getCustomerHousePhoto = async (id, signal) => {
    const response = await Axios.get(`/api/admin/customers/${encodeURIComponent(id)}/house-photo`, { headers: authHeaders(), responseType: 'blob', signal });
    return response.data;
};

export const createCustomer = async (payload) => {
    const res = await Axios.post('/api/admin/customers', customerBody(payload), { headers: authHeaders() });
    return res.data;
};

export const updateCustomer = async (id, payload) => {
    const res = await Axios.patch(`/api/admin/customers/${encodeURIComponent(id)}`, customerBody(payload), { headers: authHeaders() });
    return res.data;
};
