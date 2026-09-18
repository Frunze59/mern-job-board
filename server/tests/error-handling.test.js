import mongoose from 'mongoose';
import { vi } from 'vitest';
import { request, registerUser, authed } from './helpers.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Membership from '../models/Membership.js';

/**
 * The global error handler's four mappings, which the brief calls out by name,
 * exercised through real requests rather than by calling the middleware.
 */

beforeAll(async () => {
  await Promise.all([Organization.init(), Membership.init(), Job.init(), User.init()]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('error handling', () => {
  it('an unknown route is 404 with the { msg } shape', async () => {
    // A path under /jobs is answered by the auth middleware first, so these
    // are paths that actually reach the not-found handler.
    const results = await Promise.all([
      request().get('/api/v1/nope'),
      request().post('/api/v1/also/nope').send({}),
      // not under a protected mount, so it reaches the not-found handler
      request().get('/api/v1/organisations'),
    ]);

    for (const res of results) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ msg: 'Route does not exist' });
    }
  });

  it('a Mongoose ValidationError becomes 400 listing every failing field', async () => {
    const res = await request()
      .post('/api/v1/auth/register')
      .send({ name: 'x', email: 'not-an-email', password: '1' });

    expect(res.status).toBe(400);
    expect(res.body.msg).toContain('Name must be at least 3 characters');
    expect(res.body.msg).toContain('Please provide a valid email');
    expect(res.body.msg).toContain('Password must be at least 6 characters');
    // Mongoose's own prefix is stripped
    expect(res.body.msg).not.toMatch(/^User validation failed/);
  });

  it('a duplicate key becomes 400 naming the field', async () => {
    // The controller's friendly check catches the ordinary case, so this
    // races several registrations to reach the unique index itself.
    const email = `race${Date.now()}@example.com`;
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        request().post('/api/v1/auth/register').send({ name: 'Racer', email, password: 'secret123' })
      )
    );

    expect(attempts.filter((res) => res.status === 201)).toHaveLength(1);
    const rejected = attempts.filter((res) => res.status !== 201);
    expect(rejected.every((res) => res.status === 400)).toBe(true);
    // at least one lost at the index rather than at the friendly check
    expect(rejected.some((res) => /field has to be unique/.test(res.body.msg))).toBe(true);
    expect(await User.countDocuments({ email })).toBe(1);
  });

  it('a malformed id becomes 404, not a 500', async () => {
    const { token } = await registerUser();
    const as = authed(token);

    const results = await Promise.all([
      as('get', '/api/v1/jobs/not-a-real-id'),
      as('patch', '/api/v1/jobs/12345').send({ status: 'declined' }),
      as('delete', '/api/v1/jobs/not@an@id'),
    ]);

    for (const res of results) {
      expect(res.status).toBe(404);
      expect(res.body.msg).toMatch(/No item found with id|No job with id/);
    }
  });

  it('an unexpected error is logged but answered generically', async () => {
    const { token } = await registerUser();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Job, 'countDocuments').mockRejectedValueOnce(
      new Error('connection pool exhausted at /srv/app/node_modules/driver.js:42')
    );

    const res = await authed(token)('get', '/api/v1/jobs');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ msg: 'Something went wrong, try again later' });
    // the detail reaches the server log, never the client
    expect(JSON.stringify(res.body)).not.toContain('connection pool');
    expect(logged).toHaveBeenCalled();
    expect(String(logged.mock.calls[0])).toContain('connection pool');
  });

  it('deliberate errors keep their own status and message', async () => {
    const { token } = await registerUser();
    const as = authed(token);

    const cases = [
      [await request().get('/api/v1/jobs'), 401, 'Authentication invalid'],
      [await as('post', '/api/v1/jobs').send({}), 400, /company, position and job location/],
      [await as('get', `/api/v1/jobs/${new mongoose.Types.ObjectId()}`), 404, /No job with id/],
      [await authed(token, new mongoose.Types.ObjectId())('get', '/api/v1/jobs'), 403, /not a member/],
    ];

    for (const [res, status, message] of cases) {
      expect(res.status).toBe(status);
      expect(res.body.msg).toMatch(message);
      expect(Object.keys(res.body)).toEqual(['msg']);
    }
  });

  it('no response ever carries a stack trace', async () => {
    const { token } = await registerUser();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Job, 'countDocuments').mockRejectedValueOnce(new Error('boom'));

    const responses = [
      await request().get('/api/v1/nope'),
      await request().post('/api/v1/auth/login').send({}),
      await authed(token)('get', '/api/v1/jobs'),
    ];

    for (const res of responses) {
      expect(String(res.body.msg)).not.toMatch(/\s+at\s|node_modules|\.js:\d+/);
    }
  });
});

describe('model fallbacks', () => {
  it('a JWT lasts a day when JWT_LIFETIME is unset', async () => {
    const user = new User({ name: 'Token Person', email: 't@example.com', password: 'secret123' });
    vi.stubEnv('JWT_LIFETIME', '');
    try {
      const [, payload] = user.createJWT().split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url'));
      expect(claims.exp - claims.iat).toBe(86400);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('createWithUniqueSlug rethrows an error that is not a slug clash', async () => {
    vi.spyOn(Organization, 'create').mockRejectedValueOnce(
      Object.assign(new Error('disk full'), { code: 14031 })
    );
    await expect(Organization.createWithUniqueSlug('Acme')).rejects.toThrow('disk full');
  });

  it('findOrCreatePersonal rethrows an error that is not a duplicate', async () => {
    vi.spyOn(Organization, 'create').mockRejectedValueOnce(
      Object.assign(new Error('network down'), { code: 14031 })
    );
    await expect(
      Organization.findOrCreatePersonal(new mongoose.Types.ObjectId())
    ).rejects.toThrow('network down');
  });

  it('gives up rather than looping forever when every slug is taken', async () => {
    vi.spyOn(Organization, 'create').mockRejectedValue(
      Object.assign(new Error('dup'), { code: 11000, keyPattern: { slug: 1 } })
    );
    await expect(Organization.createWithUniqueSlug('Acme')).rejects.toThrow(/Could not find a free slug/);
  });
});
