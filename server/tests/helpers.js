import request from 'supertest';
import app from '../app.js';

/**
 * Small helpers so each test reads as a story, not as HTTP plumbing.
 */

let counter = 0;
export const uniqueEmail = (tag = 'user') => `${tag}${++counter}@example.com`;

/** Registers a user and returns { token, user, email }. */
export const registerUser = async (overrides = {}) => {
  const email = overrides.email ?? uniqueEmail();
  const body = { name: 'Test User', password: 'secret123', ...overrides, email };
  const res = await request(app).post('/api/v1/auth/register').send(body);
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user, email, password: body.password };
};

/**
 * Returns a supertest agent-like function that sends the Bearer token and,
 * optionally, the X-Org-Id header on every request.
 *
 *   const as = authed(token, orgId);
 *   await as('get', '/api/v1/jobs');
 *   await as('post', '/api/v1/jobs').send({...});
 */
export const authed =
  (token, orgId) =>
  (method, path) => {
    let req = request(app)[method](path).set('Authorization', `Bearer ${token}`);
    if (orgId) req = req.set('X-Org-Id', String(orgId));
    return req;
  };

export { request, app };
