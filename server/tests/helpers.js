import http from 'http';
import supertest from 'supertest';
import app from '../app.js';

/**
 * Small helpers so each test reads as a story, not as HTTP plumbing.
 *
 * One HTTP server per test file. Passing the bare `app` to supertest instead
 * starts and stops a fresh server for every request; Node reuses sockets by
 * default, so a reused socket occasionally reaches a server that has already
 * closed and the test fails with "Parse Error: Expected HTTP/". One long-lived
 * server makes every request go to the same place.
 */
const server = http.createServer(app);

beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
});

/** `request().get('/api/v1/health')` */
export const request = () => supertest(server);

let counter = 0;
export const uniqueEmail = (tag = 'user') => `${tag}${++counter}@example.com`;

/** Registers a user and returns { token, user, email, password }. */
export const registerUser = async (overrides = {}) => {
  const email = overrides.email ?? uniqueEmail();
  const body = { name: 'Test User', password: 'secret123', ...overrides, email };
  const res = await request().post('/api/v1/auth/register').send(body);
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user, email, password: body.password };
};

/**
 * Returns a function that sends the Bearer token and, optionally, the
 * X-Org-Id header on every request.
 *
 *   const as = authed(token, orgId);
 *   await as('get', '/api/v1/jobs');
 *   await as('post', '/api/v1/jobs').send({...});
 */
export const authed =
  (token, orgId) =>
  (method, path) => {
    let req = request()[method](path).set('Authorization', `Bearer ${token}`);
    if (orgId) req = req.set('X-Org-Id', String(orgId));
    return req;
  };

export { app };
