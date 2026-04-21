import Axios from 'axios';

export const getPermissions = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return null;
  }

  try {
    const res = await Axios.get('/api/login/my-permissions', {
      headers: {
        'x-access-token': token
      }
    });

    if (res.data.code === 1) {
      return res.data;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return null;
  }
};
