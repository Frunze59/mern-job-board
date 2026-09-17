import { request, app, registerUser } from './helpers.js';

/**
 * Proves the harness works: the real app, an in-memory database, a real JWT.
 * If this file fails, nothing else in the suite can be trusted.
 */
describe('test harness', () => {
  it('serves the health check', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('registers a user against the in-memory database', async () => {
    const { token, user } = await registerUser({ name: 'Harness' });
    expect(token.split('.')).toHaveLength(3);
    expect(user).toEqual({ name: 'Harness', email: expect.any(String) });
  });

  it('wipes data between tests', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'harness@example.com', password: 'secret123' });
    expect(res.status).toBe(401);
  });
});
