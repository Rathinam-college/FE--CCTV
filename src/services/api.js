import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.BASE_URL}api`,
});

// Request Interceptor: Automatically add the Bearer token
api.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('cctv_user'));
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized request. Clearing session.');
      localStorage.removeItem('cctv_user');
      window.location.href = `${import.meta.env.BASE_URL}login`;
    }
    return Promise.reject(error);
  }
);

export default api;
