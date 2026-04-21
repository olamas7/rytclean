import Axios from 'axios';

async function isAuthenticated() {
  const token = localStorage.getItem('token');
  if (!token) {
    return false;
  } else {
    try {
      const res = await Axios.get('/api/login/isUserAuth', {
        headers: {
          'x-access-token': token
        }
      });
      return res.data.user === true;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }
}

export default isAuthenticated;