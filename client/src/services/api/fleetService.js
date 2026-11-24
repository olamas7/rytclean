import Axios from 'axios';
const config = () => ({ headers: { 'x-access-token': localStorage.getItem('token') || '' } });
const result = (response) => { if (response.data.code !== 1) throw new Error(response.data.message); return response.data.data; };
export const fleetGet = async (path) => result(await Axios.get(`/api/fleet${path}`, config()));
export const fleetPost = async (path, payload) => result(await Axios.post(`/api/fleet${path}`, payload, config()));
export const fleetPut = async (path, payload) => result(await Axios.put(`/api/fleet${path}`, payload, config()));
export const fleetPatch = async (path, payload) => result(await Axios.patch(`/api/fleet${path}`, payload, config()));
export const fleetPhoto = async (run, stop) => (await Axios.get(`/api/fleet/runs/${run}/stops/${stop}/photo`, { ...config(), responseType: 'blob' })).data;
export const fleetRequestKey = () => crypto.randomUUID();
