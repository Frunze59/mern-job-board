import axios from 'axios';
import { ACTIVE_ORG_KEY } from './constants';

/** localStorage keys, shared so pages and interceptors cannot drift apart. */
export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

/**
 * Read the signed-in user saved at login. A malformed entry (hand-edited or
 * left over from an older version) must not crash a page, so treat it as
 * "no user" instead of letting JSON.parse throw during render.
 */
export const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Forget the signed-in session. Used by logout and by a rejected token. */
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ACTIVE_ORG_KEY);
};

/**
 * Paths whose 401 means something other than "your session expired", so the
 * page is left to explain it instead of being redirected out from under.
 *
 *   /auth         wrong credentials typed into the login form
 *   /invitations  a stale token on a public page whose URL must not be lost;
 *                 the accept page signs the user out and carries on in place
 */
const SELF_HANDLED_401 = ['/auth', '/invitations'];

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
    const url = error.config?.url ?? '';
    const selfHandled = SELF_HANDLED_401.some((prefix) => url.startsWith(prefix));

    if (error.response?.status === 401 && !selfHandled) {
      // The org id belongs to the session that just ended. Leaving it behind
      // would send the next account's first requests at an org it may well
      // not belong to.
      clearSession();
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
