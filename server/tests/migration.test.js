import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import mongoose from 'mongoose';
import { vi } from 'vitest';
import { request } from './helpers.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Membership from '../models/Membership.js';
import Job from '../models/Job.js';
import { runMigration, formatSummary, main } from '../migrations/001-orgs.js';

const execFileAsync = promisify(execFile);
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quiet = { log: () => {} };

beforeAll(async () => {
  await Promise.all([Organization.init(), Membership.init(), Job.init(), User.init()]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * A pre-v2 user: created straight through the model, so no Personal org and
 * no membership, which is exactly what production users look like today.
 */
const legacyUser = async (name) =>
  User.create({ name, email: `${name.toLowerCase()}@legacy.test`, password: 'secret123' });

/**
 * Pre-v2 jobs: inserted raw, bypassing the schema that now requires
 * `organization`, so they have no organization field at all.
 */
const legacyJobs = async (user, count) => {
  const docs = Array.from({ length: count }, (_, i) => ({
    company: `Company ${i}`,
    position: `Role ${i}`,
    jobLocation: 'Riga',
    status: 'pending',
    jobType: 'full-time',
    createdBy: user._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  if (docs.length) await Job.collection.insertMany(docs);
};

/** Everything the migration can change, in a comparable form. */
const snapshot = async () => ({
  orgs: (await Organization.find().sort({ _id: 1 }).lean()).map((o) => ({
    id: String(o._id),
    personalFor: String(o.personalFor),
  })),
  memberships: (await Membership.find().sort({ _id: 1 }).lean()).map((m) => ({
    user: String(m.user),
    org: String(m.organization),
    role: m.role,
  })),
  jobs: (await Job.find().sort({ _id: 1 }).lean()).map((j) => ({
    id: String(j._id),
    org: String(j.organization),
    updatedAt: j.updatedAt.getTime(),
  })),
});

/** The standard fixture: three legacy users with 3, 2 and 0 jobs. */
const legacyFixture = async () => {
  const ana = await legacyUser('Ana');
  const ben = await legacyUser('Ben');
  const cleo = await legacyUser('Cleo');
  await legacyJobs(ana, 3);
  await legacyJobs(ben, 2);
  return { ana, ben, cleo };
};

describe('migration 001-orgs', () => {
  it('gives a pre-v2 user a Personal org, owner membership, and moves their jobs', async () => {
    const { ana } = await legacyFixture();

    await runMigration(quiet);

    const org = await Organization.findOne({ personalFor: ana._id });
    expect(org).toMatchObject({ name: 'Personal', slug: `personal-${ana._id}` });

    const memberships = await Membership.find({ user: ana._id });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ role: 'owner' });
    expect(memberships[0].organization.equals(org._id)).toBe(true);

    const jobs = await Job.find({ createdBy: ana._id });
    expect(jobs).toHaveLength(3);
    expect(jobs.every((j) => j.organization.equals(org._id))).toBe(true);
  });

  it('summary counts are accurate', async () => {
    await legacyFixture();

    const summary = await runMigration(quiet);

    expect(summary).toMatchObject({
      usersProcessed: 3,
      orgsCreated: 3,
      jobsMigrated: 5,
      usersSkipped: 0,
      usersResumed: 0,
      usersFailed: 0,
      jobsWithoutUser: 0,
    });
  });

  it('running it twice creates no extra orgs, memberships, or job changes', async () => {
    await legacyFixture();

    await runMigration(quiet);
    const afterFirst = await snapshot();
    const second = await runMigration(quiet);
    const afterSecond = await snapshot();

    expect(second).toMatchObject({
      usersProcessed: 3,
      orgsCreated: 0,
      jobsMigrated: 0,
      usersSkipped: 3,
      usersFailed: 0,
    });
    // byte-for-byte the same, including job updatedAt timestamps
    expect(afterSecond).toEqual(afterFirst);
    expect(afterFirst.orgs).toHaveLength(3);
    expect(afterFirst.memberships).toHaveLength(3);
  });

  it('concurrent runs still produce one org and one membership per user', async () => {
    await legacyFixture();

    await Promise.all([runMigration(quiet), runMigration(quiet), runMigration(quiet)]);

    expect(await Organization.countDocuments()).toBe(3);
    expect(await Membership.countDocuments()).toBe(3);
    expect(await Job.countDocuments({ organization: null })).toBe(0);
  });

  it('a user who already has a membership is skipped and counted as such', async () => {
    // A v2 user, registered through the API, so already set up.
    await request()
      .post('/api/v1/auth/register')
      .send({ name: 'Newcomer', email: 'new@example.com', password: 'secret123' });
    await legacyFixture();
    const before = await Organization.countDocuments();

    const summary = await runMigration(quiet);

    expect(summary).toMatchObject({ usersProcessed: 4, usersSkipped: 1, orgsCreated: 3 });
    expect(await Organization.countDocuments()).toBe(before + 3);
  });

  it('does not give a Personal org to a member of a shared org with nothing to move', async () => {
    const invitee = await legacyUser('Invitee');
    const shared = await Organization.createWithUniqueSlug('Shared Agency');
    await Membership.create({ user: invitee._id, organization: shared._id, role: 'viewer' });

    const summary = await runMigration(quiet);

    expect(summary.usersSkipped).toBe(1);
    expect(await Organization.exists({ personalFor: invitee._id })).toBeNull();
  });

  it('recovers when a Personal org exists but its membership is missing', async () => {
    // State left by a crash between "create org" and "create membership".
    const ana = await legacyUser('Ana');
    await legacyJobs(ana, 2);
    const { org } = await Organization.findOrCreatePersonal(ana._id);

    const summary = await runMigration(quiet);

    expect(summary).toMatchObject({ orgsCreated: 0, jobsMigrated: 2, usersResumed: 0 });
    expect(await Organization.countDocuments({ personalFor: ana._id })).toBe(1);
    const membership = await Membership.findOne({ user: ana._id });
    expect(membership.organization.equals(org._id)).toBe(true);
    expect(await Job.countDocuments({ organization: org._id })).toBe(2);
  });

  it('resumes a user whose membership exists but whose jobs were never moved', async () => {
    // State left by a crash after the membership, before the job update.
    // Following the brief literally would skip this user and strand the jobs.
    const ana = await legacyUser('Ana');
    await legacyJobs(ana, 4);
    await Organization.ensurePersonalFor(ana._id);

    const summary = await runMigration(quiet);

    expect(summary).toMatchObject({
      usersResumed: 1,
      usersSkipped: 0,
      orgsCreated: 0,
      jobsMigrated: 4,
    });
    expect(await Job.countDocuments({ organization: null })).toBe(0);
  });

  it('never moves a job that already belongs to an organization', async () => {
    const ana = await legacyUser('Ana');
    await legacyJobs(ana, 1);
    const shared = await Organization.createWithUniqueSlug('Shared Agency');
    const placed = await Job.create({
      company: 'Placed',
      position: 'Already placed',
      jobLocation: 'Riga',
      createdBy: ana._id,
      organization: shared._id,
    });

    const summary = await runMigration(quiet);

    expect(summary.jobsMigrated).toBe(1);
    const stillPlaced = await Job.findById(placed._id);
    expect(stillPlaced.organization.equals(shared._id)).toBe(true);
  });

  it("moves each user's jobs into that user's own org only", async () => {
    const { ana, ben } = await legacyFixture();

    await runMigration(quiet);

    const anaOrg = await Organization.findOne({ personalFor: ana._id });
    const benOrg = await Organization.findOne({ personalFor: ben._id });
    expect(await Job.countDocuments({ organization: anaOrg._id })).toBe(3);
    expect(await Job.countDocuments({ organization: benOrg._id })).toBe(2);
    expect(
      await Job.countDocuments({ organization: anaOrg._id, createdBy: { $ne: ana._id } })
    ).toBe(0);
  });

  it('a failure for one user leaves the others complete, and a rerun finishes', async () => {
    const { ana, ben, cleo } = await legacyFixture();
    const real = Organization.ensurePersonalFor.bind(Organization);
    const spy = vi.spyOn(Organization, 'ensurePersonalFor').mockImplementation((userId) =>
      String(userId) === String(ben._id)
        ? Promise.reject(new Error('simulated write failure'))
        : real(userId)
    );
    const logged = [];

    const first = await runMigration({ log: (line) => logged.push(line) });

    expect(first).toMatchObject({ usersFailed: 1, orgsCreated: 2, jobsMigrated: 3 });
    expect(first.failures).toEqual([
      { userId: String(ben._id), message: 'simulated write failure' },
    ]);
    expect(logged.join('\n')).toContain(`user ${ben._id} failed: simulated write failure`);
    expect(await Organization.exists({ personalFor: ana._id })).toBeTruthy();
    expect(await Organization.exists({ personalFor: cleo._id })).toBeTruthy();
    expect(await Organization.exists({ personalFor: ben._id })).toBeNull();
    expect(await Job.countDocuments({ createdBy: ben._id, organization: null })).toBe(2);

    spy.mockRestore();
    const second = await runMigration(quiet);

    expect(second).toMatchObject({
      usersFailed: 0,
      usersSkipped: 2,
      orgsCreated: 1,
      jobsMigrated: 2,
    });
    expect(await Job.countDocuments({ organization: null })).toBe(0);
  });

  it('reports jobs whose author no longer exists instead of guessing an org', async () => {
    const ghost = { _id: new mongoose.Types.ObjectId() };
    await legacyJobs(ghost, 2);
    await legacyFixture();

    const summary = await runMigration(quiet);

    expect(summary.jobsWithoutUser).toBe(2);
    expect(summary.usersFailed).toBe(0);
    expect(formatSummary(summary)).toContain('WARNING: 2 job(s) have no organization');
  });

  it('an empty database is a clean no-op', async () => {
    const summary = await runMigration(quiet);
    expect(summary).toMatchObject({
      usersProcessed: 0,
      orgsCreated: 0,
      jobsMigrated: 0,
      usersSkipped: 0,
      usersFailed: 0,
    });
  });

  describe('dry run', () => {
    it('reports what would change and writes nothing', async () => {
      await legacyFixture();
      const before = await snapshot();

      const summary = await runMigration({ ...quiet, dryRun: true });

      expect(summary).toMatchObject({
        dryRun: true,
        usersProcessed: 3,
        orgsCreated: 3,
        jobsMigrated: 5,
      });
      expect(await snapshot()).toEqual(before);
      expect(formatSummary(summary)).toContain('DRY RUN, nothing written');
    });

    it('predicts exactly what the real run then does', async () => {
      const { ana } = await legacyFixture();
      await Organization.findOrCreatePersonal(ana._id); // org exists, no membership

      const predicted = await runMigration({ ...quiet, dryRun: true });
      const actual = await runMigration(quiet);

      for (const key of ['usersProcessed', 'orgsCreated', 'jobsMigrated', 'usersSkipped']) {
        expect(predicted[key]).toBe(actual[key]);
      }
    });
  });

  describe('output', () => {
    it('prints the four figures the brief asks for', () => {
      const text = formatSummary({
        usersProcessed: 7,
        orgsCreated: 5,
        jobsMigrated: 40,
        usersSkipped: 2,
        usersResumed: 0,
        usersFailed: 0,
        jobsWithoutUser: 0,
        dryRun: false,
      });
      expect(text).toMatch(/users processed:\s+7/);
      expect(text).toMatch(/orgs created:\s+5/);
      expect(text).toMatch(/jobs migrated:\s+40/);
      expect(text).toMatch(/users already migrated \(skipped\):\s+2/);
      expect(text).not.toContain('WARNING');
    });
  });

  describe('main (CLI exit code)', () => {
    beforeEach(() => {
      // Reuse the test connection; main must not open or close its own here.
      vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
      vi.spyOn(mongoose, 'disconnect').mockResolvedValue();
    });

    it('exits 0 when every user succeeds', async () => {
      await legacyFixture();
      expect(await main({ argv: [], url: 'mongodb://unused', ...quiet })).toBe(0);
    });

    it('exits 1 when any user fails, so the deploy stops', async () => {
      await legacyFixture();
      vi.spyOn(Organization, 'ensurePersonalFor').mockRejectedValue(new Error('nope'));
      expect(await main({ argv: [], url: 'mongodb://unused', ...quiet })).toBe(1);
    });

    it('honours MIGRATE_DRY_RUN=1, which an npm wrapper cannot swallow', async () => {
      await legacyFixture();
      vi.stubEnv('MIGRATE_DRY_RUN', '1');
      try {
        await main({ argv: [], url: 'mongodb://unused', ...quiet });
      } finally {
        vi.unstubAllEnvs();
      }
      expect(await Organization.countDocuments()).toBe(0);
    });

    it('honours --dry-run', async () => {
      await legacyFixture();
      await main({ argv: ['node', 'x', '--dry-run'], url: 'mongodb://unused', ...quiet });
      expect(await Organization.countDocuments()).toBe(0);
    });
  });

  describe('as a real process (npm run migrate)', () => {
    // The project path contains a space; this proves the "run directly" check
    // still recognises the script, which a naive URL comparison would not.
    const uri = () =>
      `mongodb://${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`;
    const runCli = (args = []) =>
      execFileAsync(process.execPath, ['migrations/001-orgs.js', ...args], {
        cwd: serverDir,
        env: { ...process.env, MONGO_URL: uri() },
      });

    it('migrates, prints the summary and exits 0; a second run is a no-op', async () => {
      await legacyFixture();

      const first = await runCli();
      expect(first.stdout).toMatch(/orgs created:\s+3/);
      expect(first.stdout).toMatch(/jobs migrated:\s+5/);
      expect(await Organization.countDocuments()).toBe(3);

      const second = await runCli();
      expect(second.stdout).toMatch(/orgs created:\s+0/);
      expect(second.stdout).toMatch(/users already migrated \(skipped\):\s+3/);
    });

    it('--dry-run through the CLI writes nothing', async () => {
      await legacyFixture();
      const { stdout } = await runCli(['--dry-run']);
      expect(stdout).toContain('DRY RUN');
      expect(await Organization.countDocuments()).toBe(0);
    });

    it('exits 1 with a clear message when it cannot connect', async () => {
      const error = await execFileAsync(process.execPath, ['migrations/001-orgs.js'], {
        cwd: serverDir,
        env: { ...process.env, MONGO_URL: 'mongodb://127.0.0.1:1/nothing?serverSelectionTimeoutMS=500' },
      }).catch((e) => e);
      expect(error.code).toBe(1);
      expect(error.stderr).toContain('[migrate 001-orgs] aborted');
    });
  });

  it('after migrating, a legacy user sees their old jobs through the API', async () => {
    await legacyFixture();
    await runMigration(quiet);

    const login = await request()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@legacy.test', password: 'secret123' });
    const list = await request()
      .get('/api/v1/jobs')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(list.status).toBe(200);
    expect(list.body.totalJobs).toBe(3);
    expect(list.body.jobs.every((j) => j.createdByName === 'Ana')).toBe(true);
  });

  it('before migrating, the same user sees an error, not an empty list', async () => {
    await legacyFixture();
    const login = await request()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@legacy.test', password: 'secret123' });
    const list = await request()
      .get('/api/v1/jobs')
      .set('Authorization', `Bearer ${login.body.token}`);

    // Why the migration must run before the server starts.
    expect(list.status).toBe(403);
  });
});
