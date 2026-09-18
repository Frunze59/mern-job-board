import mongoose from 'mongoose';
import { registerUser, authed } from './helpers.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Membership from '../models/Membership.js';
import Job from '../models/Job.js';
import {
  buildStatsPipeline,
  shapeStats,
  monthWindow,
  MONTHS_REPORTED,
} from '../controllers/statsController.js';

const userIdOf = async (email) => (await User.findOne({ email }))._id;

beforeAll(async () => {
  await Promise.all([Organization.init(), Membership.init(), Job.init(), User.init()]);
});

/** An org with an owner and a viewer. */
const makeOrg = async (name = 'Acme Recruiting') => {
  const owner = await registerUser({ name: 'Owner Person' });
  const { body } = await authed(owner.token)('post', '/api/v1/orgs').send({ name });
  const orgId = body.org._id;
  const viewer = await registerUser({ name: 'Viewer Person' });
  await Membership.create({
    user: await userIdOf(viewer.email),
    organization: orgId,
    role: 'viewer',
  });
  return {
    orgId,
    owner: { ...owner, as: authed(owner.token, orgId) },
    viewer: { ...viewer, as: authed(viewer.token, orgId) },
  };
};

/** Insert jobs with a chosen createdAt, bypassing the timestamps default. */
const seedJobs = async (orgId, rows) => {
  const createdBy = new mongoose.Types.ObjectId();
  await Job.collection.insertMany(
    rows.map(({ company, status = 'pending', jobType = 'full-time', createdAt }) => ({
      company,
      position: `${company} role`,
      jobLocation: 'Riga',
      status,
      jobType,
      createdBy,
      organization: new mongoose.Types.ObjectId(String(orgId)),
      createdAt,
      updatedAt: createdAt,
    }))
  );
};

/** Run the pipeline directly against a pinned clock. */
const statsAt = async (orgId, now) => {
  const [result] = await Job.aggregate(buildStatsPipeline(orgId, now));
  return shapeStats(result, now);
};

const utc = (year, month, day = 15) => new Date(Date.UTC(year, month - 1, day, 12));

describe('GET /stats', () => {
  describe('against a fixed fixture and clock', () => {
    const NOW = utc(2026, 9, 17);

    /**
     * Deterministic fixture. Months are relative to NOW = September 2026, so
     * the six-month window is April..September.
     *   Apr: 1   May: 0   Jun: 2   Jul: 0   Aug: 3   Sep: 4
     * Statuses: 5 pending, 3 interview, 2 declined (plus one older job).
     * Companies: Acme 4, Beta 3, Delta 2, Cobalt 2, Ember 1.
     */
    const fixture = [
      { company: 'Acme', status: 'pending', createdAt: utc(2026, 9, 2) },
      { company: 'Acme', status: 'interview', createdAt: utc(2026, 9, 8) },
      { company: 'Acme', status: 'pending', createdAt: utc(2026, 9, 14) },
      { company: 'Beta', status: 'declined', createdAt: utc(2026, 9, 16) },
      { company: 'Beta', status: 'pending', createdAt: utc(2026, 8, 3) },
      { company: 'Beta', status: 'interview', createdAt: utc(2026, 8, 19) },
      { company: 'Cobalt', status: 'pending', createdAt: utc(2026, 8, 28) },
      { company: 'Cobalt', status: 'declined', createdAt: utc(2026, 6, 6) },
      { company: 'Delta', status: 'interview', createdAt: utc(2026, 6, 21) },
      { company: 'Delta', status: 'pending', createdAt: utc(2026, 4, 9) },
      // older than the window: counted in statuses and companies, not in months
      { company: 'Acme', status: 'pending', createdAt: utc(2026, 1, 5) },
      { company: 'Ember', status: 'pending', createdAt: utc(2025, 11, 5) },
    ];

    let orgId;

    beforeEach(async () => {
      ({ orgId } = await makeOrg());
      await seedJobs(orgId, fixture);
    });

    it('returns exactly the three keys the brief specifies', async () => {
      const stats = await statsAt(orgId, NOW);
      expect(Object.keys(stats).sort()).toEqual([
        'applicationsPerMonth',
        'countsByStatus',
        'topCompanies',
      ]);
    });

    it('countsByStatus matches the fixture', async () => {
      const { countsByStatus } = await statsAt(orgId, NOW);
      expect(countsByStatus).toEqual({ pending: 7, interview: 3, declined: 2 });
    });

    it('applicationsPerMonth has 6 entries, oldest first, zeros filled', async () => {
      const { applicationsPerMonth } = await statsAt(orgId, NOW);
      expect(applicationsPerMonth).toEqual([
        { month: '2026-04', count: 1 },
        { month: '2026-05', count: 0 },
        { month: '2026-06', count: 2 },
        { month: '2026-07', count: 0 },
        { month: '2026-08', count: 3 },
        { month: '2026-09', count: 4 },
      ]);
    });

    it('excludes jobs older than the window from the months, but not the totals', async () => {
      const { applicationsPerMonth, countsByStatus } = await statsAt(orgId, NOW);
      const inWindow = applicationsPerMonth.reduce((sum, m) => sum + m.count, 0);
      const total = Object.values(countsByStatus).reduce((sum, n) => sum + n, 0);
      expect(inWindow).toBe(10);
      expect(total).toBe(12);
    });

    it('topCompanies is at most 3, count desc, ties broken by name asc', async () => {
      const { topCompanies } = await statsAt(orgId, NOW);
      expect(topCompanies).toEqual([
        { company: 'Acme', count: 4 },
        { company: 'Beta', count: 3 },
        // Cobalt and Delta both have 2; Cobalt wins on name
        { company: 'Cobalt', count: 2 },
      ]);
    });

    it('rolls the window forward with the clock', async () => {
      const { applicationsPerMonth } = await statsAt(orgId, utc(2026, 11, 3));
      expect(applicationsPerMonth.map((m) => m.month)).toEqual([
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
        '2026-11',
      ]);
      expect(applicationsPerMonth.map((m) => m.count)).toEqual([2, 0, 3, 4, 0, 0]);
    });

    it('counts a job at the very first instant of the window', async () => {
      const boundary = new Date(Date.UTC(2026, 3, 1, 0, 0, 0, 0)); // 2026-04-01T00:00:00Z
      await seedJobs(orgId, [{ company: 'Edge', createdAt: boundary }]);
      const { applicationsPerMonth } = await statsAt(orgId, NOW);
      expect(applicationsPerMonth[0]).toEqual({ month: '2026-04', count: 2 });
    });

    it('filters the month window in the database, not afterwards in JS', async () => {
      // The shaping step would hide out-of-window months anyway, so assert on
      // the raw facet output: the database must not return them at all.
      const [raw] = await Job.aggregate(buildStatsPipeline(orgId, NOW));

      expect(raw.perMonth.map((row) => row._id)).toEqual([
        '2026-04',
        '2026-06',
        '2026-08',
        '2026-09',
      ]);
      // the two jobs older than the window are counted by the other branches
      expect(raw.perMonth.reduce((sum, row) => sum + row.count, 0)).toBe(10);
      expect(raw.countsByStatus.reduce((sum, row) => sum + row.count, 0)).toBe(12);
    });

    it('is scoped to the org: another org sees only its own jobs', async () => {
      const other = await makeOrg('Other Agency');
      await seedJobs(other.orgId, [{ company: 'Solo', createdAt: utc(2026, 9, 1) }]);

      const mine = await statsAt(orgId, NOW);
      const theirs = await statsAt(other.orgId, NOW);

      expect(mine.topCompanies.map((c) => c.company)).not.toContain('Solo');
      expect(theirs.topCompanies).toEqual([{ company: 'Solo', count: 1 }]);
      expect(theirs.countsByStatus).toEqual({ pending: 1, interview: 0, declined: 0 });
    });
  });

  describe('over HTTP', () => {
    it('serves the active org and is open to viewers', async () => {
      const { orgId, owner, viewer } = await makeOrg();
      await seedJobs(orgId, [
        { company: 'Acme', status: 'interview', createdAt: new Date() },
        { company: 'Acme', status: 'pending', createdAt: new Date() },
      ]);

      const asOwner = await owner.as('get', '/api/v1/stats');
      const asViewer = await viewer.as('get', '/api/v1/stats');

      expect(asOwner.status).toBe(200);
      expect(asViewer.status).toBe(200);
      expect(asOwner.body).toEqual(asViewer.body);
      expect(asOwner.body.countsByStatus).toEqual({ pending: 1, interview: 1, declined: 0 });
      expect(asOwner.body.topCompanies).toEqual([{ company: 'Acme', count: 2 }]);
      expect(asOwner.body.applicationsPerMonth).toHaveLength(MONTHS_REPORTED);
    });

    it('falls back to the Personal org when no X-Org-Id is sent', async () => {
      const { token } = await registerUser();
      await authed(token)('post', '/api/v1/jobs').send({
        company: 'Solo Co',
        position: 'Dev',
        jobLocation: 'Riga',
      });

      const res = await authed(token)('get', '/api/v1/stats');

      expect(res.status).toBe(200);
      expect(res.body.topCompanies).toEqual([{ company: 'Solo Co', count: 1 }]);
    });

    it('an org with no jobs returns zeros, not an error', async () => {
      const { owner } = await makeOrg();
      const res = await owner.as('get', '/api/v1/stats');

      expect(res.status).toBe(200);
      expect(res.body.countsByStatus).toEqual({ pending: 0, interview: 0, declined: 0 });
      expect(res.body.topCompanies).toEqual([]);
      expect(res.body.applicationsPerMonth).toHaveLength(MONTHS_REPORTED);
      expect(res.body.applicationsPerMonth.every((m) => m.count === 0)).toBe(true);
    });

    it('needs a token, and refuses an org the caller is not in', async () => {
      const { orgId } = await makeOrg();
      const outsider = await registerUser();

      expect((await authed('')('get', '/api/v1/stats')).status).toBe(401);
      expect((await authed(outsider.token, orgId)('get', '/api/v1/stats')).status).toBe(403);
    });

    it('ignores query parameters: the brief specifies none', async () => {
      const { orgId, owner } = await makeOrg();
      await seedJobs(orgId, [
        { company: 'Acme', status: 'pending', createdAt: new Date() },
        { company: 'Beta', status: 'declined', createdAt: new Date() },
      ]);

      const plain = await owner.as('get', '/api/v1/stats');
      const noisy = await owner.as('get', '/api/v1/stats?status=pending&limit=1&company=Beta');

      expect(noisy.body).toEqual(plain.body);
    });
  });

  describe('the pipeline itself', () => {
    it('is a single $match -> $facet -> $project aggregation', () => {
      const pipeline = buildStatsPipeline(new mongoose.Types.ObjectId(), new Date());
      expect(pipeline.map((stage) => Object.keys(stage)[0])).toEqual([
        '$match',
        '$facet',
        '$project',
      ]);
      expect(Object.keys(pipeline[1].$facet).sort()).toEqual([
        'countsByStatus',
        'perMonth',
        'topCompanies',
      ]);
    });

    it('matches on a real ObjectId, so a string org id still works', async () => {
      const { orgId } = await makeOrg();
      await seedJobs(orgId, [{ company: 'Acme', createdAt: new Date() }]);

      // orgId is a string here, as it is on req.org
      const stats = await statsAt(String(orgId), new Date());
      expect(stats.topCompanies).toEqual([{ company: 'Acme', count: 1 }]);
    });

    it('uses the { organization, createdAt } index rather than scanning', async () => {
      const { orgId } = await makeOrg();
      await seedJobs(
        orgId,
        Array.from({ length: 50 }, (_, i) => ({ company: `C${i % 7}`, createdAt: new Date() }))
      );

      const explained = await Job.collection
        .aggregate(buildStatsPipeline(orgId, new Date()))
        .explain();
      const plan = JSON.stringify(explained);

      expect(plan).toContain('IXSCAN');
      expect(plan).toContain('organization_1_createdAt_-1');
      expect(plan).not.toContain('COLLSCAN');
    });

    it('monthWindow always returns six ascending months', () => {
      const window = monthWindow(utc(2026, 1, 31));
      expect(window).toEqual(['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01']);
      expect([...window].sort()).toEqual(window);
    });

    it('shapes an empty result without throwing', () => {
      expect(shapeStats(undefined, utc(2026, 9, 17))).toMatchObject({
        countsByStatus: { pending: 0, interview: 0, declined: 0 },
        topCompanies: [],
      });
    });
  });
});
