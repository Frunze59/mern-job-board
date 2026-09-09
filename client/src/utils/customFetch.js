import axios from 'axios';

/**
 * Single axios instance for the whole app.
 *  - baseURL '/api/v1' (Vite proxy forwards to http://localhost:5000 in dev)
 *  - request interceptor: attach `Authorization: Bearer <token>` from localStorage
 *  - response interceptor: on 401 -> clear storage and redirect to /register
 */
const customFetch = axios.create({
  baseURL: '/api/v1',
});

customFetch.interceptors.request.use((config) => {
  // TODO: const token = localStorage.getItem('token');
  //       if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

customFetch.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: if (error.response?.status === 401) {
    //         localStorage.removeItem('token'); localStorage.removeItem('user');
    //         window.location.href = '/register';
    //       }
    return Promise.reject(error);
  }
);

export default customFetch;
