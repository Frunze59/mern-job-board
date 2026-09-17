import { request, app, registerUser, authed } from './helpers.js';

/**
 * v1 behaviour that must survive v2 untouched. This is the brief's regression
 * check: register -> create job -> filter -> paginate -> delete.
 *
 * These tests hit the real app on a real (in-memory) MongoDB, so they exercise
 * validation, indexes and the query pipeline, not mocks.
 */

const jobBody = (overrides = {}) => ({
  company: 'Acme',
  position: 'Developer',
  jobLocation: 'Riga',
  ...overrides,
});

describe('v1 regression', () => {
  it('register -> login round trip returns the same user', async () => {
    const { email, password, user } = await registerUser({ name: 'Round Trip' });

    const res = await request(app).post('/api/v1/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
    expect(res.body.token.split('.')).toHaveLength(3);
    // no password hash anywhere in the response
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[ab]\$/);
  });

  it('create job -> appears in the list for its creator', async () => {
    const { token } = await registerUser();
    const as = authed(token);

    const created = await as('post', '/api/v1/jobs').send(jobBody());
    expect(created.status).toBe(201);
    expect(created.body.job).toMatchObject({
      company: 'Acme',
      position: 'Developer',
      status: 'pending',
      jobType: 'full-time',
    });

    const list = await as('get', '/api/v1/jobs');
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ totalJobs: 1, numOfPages: 1 });
    expect(list.body.jobs[0]._id).toBe(created.body.job._id);

    // a different user does not see it
    const other = authed((await registerUser()).token);
    const otherList = await other('get', '/api/v1/jobs');
    expect(otherList.body.totalJobs).toBe(0);
  });

  it('status / jobType / search filters narrow the list', async () => {
    const { token } = await registerUser();
    const as = authed(token);
    const seed = [
      ['Backend Dev', 'pending', 'remote'],
      ['Backend Engineer', 'interview', 'full-time'],
      ['Frontend Dev', 'declined', 'remote'],
      ['QA Engineer', 'pending', 'part-time'],
    ];
    for (const [position, status, jobType] of seed) {
      await as('post', '/api/v1/jobs').send(jobBody({ position, status, jobType }));
    }
    const count = async (query) => (await as('get', `/api/v1/jobs${query}`)).body.totalJobs;

    expect(await count('')).toBe(4);
    expect(await count('?status=pending')).toBe(2);
    expect(await count('?jobType=remote')).toBe(2);
    expect(await count('?search=backend')).toBe(2);
    expect(await count('?search=BACKEND')).toBe(2);
    expect(await count('?status=pending&jobType=remote')).toBe(1);
    expect(await count('?status=all&jobType=all')).toBe(4);
    // regex metacharacters are matched literally
    expect(await count(`?search=${encodeURIComponent('.*')}`)).toBe(0);

    const sorted = await as('get', '/api/v1/jobs?sort=a-z');
    const positions = sorted.body.jobs.map((j) => j.position);
    expect(positions).toEqual([...positions].sort());
  });

  it('pagination: limit=5 over 12 jobs gives 3 non-overlapping pages', async () => {
    const { token } = await registerUser();
    const as = authed(token);
    for (let i = 1; i <= 12; i += 1) {
      await as('post', '/api/v1/jobs').send(
        jobBody({ position: `Role ${String(i).padStart(2, '0')}` })
      );
    }

    const pages = await Promise.all(
      [1, 2, 3].map((page) => as('get', `/api/v1/jobs?limit=5&page=${page}`))
    );

    expect(pages.map((p) => p.body.jobs.length)).toEqual([5, 5, 2]);
    expect(pages[0].body.numOfPages).toBe(3);
    expect(pages[0].body.totalJobs).toBe(12);

    const ids = pages.flatMap((p) => p.body.jobs.map((j) => j._id));
    expect(new Set(ids).size).toBe(12);

    const beyond = await as('get', '/api/v1/jobs?limit=5&page=9');
    expect(beyond.status).toBe(200);
    expect(beyond.body.jobs).toEqual([]);

    // junk paging input is clamped, never a 500
    const junk = await as('get', '/api/v1/jobs?page=0&limit=abc');
    expect(junk.status).toBe(200);
  });

  it('delete removes the job; second delete is 404', async () => {
    const { token } = await registerUser();
    const as = authed(token);
    const {
      body: { job: created },
    } = await as('post', '/api/v1/jobs').send(jobBody());

    const first = await as('delete', `/api/v1/jobs/${created._id}`);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ msg: 'Job removed' });

    const second = await as('delete', `/api/v1/jobs/${created._id}`);
    expect(second.status).toBe(404);

    const list = await as('get', '/api/v1/jobs');
    expect(list.body.totalJobs).toBe(0);
  });

  it('missing token is 401 on every jobs route', async () => {
    const id = '507f1f77bcf86cd799439011';
    const results = await Promise.all([
      request(app).get('/api/v1/jobs'),
      request(app).post('/api/v1/jobs').send(jobBody()),
      request(app).get(`/api/v1/jobs/${id}`),
      request(app).patch(`/api/v1/jobs/${id}`).send({ status: 'declined' }),
      request(app).delete(`/api/v1/jobs/${id}`),
    ]);

    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    for (const res of results) {
      expect(res.body).toEqual({ msg: 'Authentication invalid' });
    }
  });
});
