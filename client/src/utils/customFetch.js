import axios from 'axios';
import { ACTIVE_ORG_KEY } from './constants';

/** localStorage keys, shared so pages and interceptors cannot drift apart. */
export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

/**
 * Single axios instance for the whole app.
 *  - baseURL '/api/v1' (the Vite proxy forwards this to the Express server in dev)
 *  - request interceptor: attach `Authorization: Bearer <token>` from localStorage
 *  - response interceptor: on an expired or invalid session, log out and redirect
 */
const customFetch = axios.create({
  baseURL: '/api/v1',
});

customFetch.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // The active org is read from storage rather than from React state because
  // this file lives outside the component tree. DashboardContext writes the
  // key before it sets its own state, so the two can never disagree on the
  // org a request belongs to.
  //
  // When the header is absent the server falls back to the Personal org, which
  // is what keeps the pre-v2 client working against the v2 API.
  const orgId = localStorage.getItem(ACTIVE_ORG_KEY);
  if (orgId) {
    config.headers['X-Org-Id'] = orgId;
  }
  return config;
});

customFetch.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 from /auth/login or /auth/register means "those credentials are
    // wrong", not "your session expired". Redirecting there would reload the
    // page and wipe the inline error the form is about to show, so let the
    // calling page handle it.
    const isAuthRequest = error.config?.url?.startsWith('/auth');

    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      // The org id belongs to the session that just ended. Leaving it behind
      // would send the next account's first requests at an org it may well
      // not belong to.
      localStorage.removeItem(ACTIVE_ORG_KEY);
      // Full reload rather than a router navigate: this file is outside the
      // router, and a reload guarantees no stale authenticated state survives.
      window.location.assign('/register');
    }

    return Promise.reject(error);
  }
);

/**
 * Pull the server's message out of a failed request.
 * The API always answers errors with { msg }, but a network failure has no
 * response at all, so fall back to something printable.
 */
export const getErrorMessage = (error) =>
  error?.response?.data?.msg || error?.message || 'Something went wrong';

export default customFetch;
