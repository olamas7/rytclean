import Axios from 'axios';

async function isAuthenticated() {
  const token = localStorage.getItem('token');
  const loginExpiresAt = Number(localStorage.getItem('loginExpiresAt') || 0);
  const userId = localStorage.getItem('userId');
  const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('userId');
    localStorage.removeItem('loginExpiresAt');
  };

  if (!token) {
    return false; // No token found, return false
  } else if (userId && userId !== 'Paystack' && !/^0\d{9}$/.test(userId)) {
    clearAuth();
    return false;
  } else if (loginExpiresAt && Date.now() > loginExpiresAt) {
    clearAuth();
    return false;
  } else {
    try {
      const res = await Axios.get('' + '/api/login/isUserAuth', {
        headers: {
          'x-access-token': localStorage.getItem('token')
        }
      });
      // Check if the user is authenticated
      if (res.data.user === true) {
        return true; // User is authenticated, return true
      } else {
        clearAuth();
        return false; // User is not authenticated, return false
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      clearAuth();
      return false; // Return false in case of an error
    }
  }
}

export default isAuthenticated;
