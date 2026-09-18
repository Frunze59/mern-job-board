import mongoose from 'mongoose';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Membership from '../models/Membership.js';
import Job from '../models/Job.js';
import { runSeed, buildJobs, TOTAL_JOBS, TEAM, SEED_PASSWORD } from '../scripts/seed-team.js';
import { request } from './helpers.js';

const quiet = { log: () => {} };

beforeAll(async () => {
  await Promise.all([Organization.init(), Membership.init(), Job.init(), User.init()]);
});

describe('seed-team', () => {
  describe('the dataset', () => {
    it('creates one org, three members and 500 jobs', async () => {
      const summary = await runSeed(quiet);

      expect(summary).toMatchObject({ org: 'Acme Recruiting', members: 3, jobs: TOTAL_JOBS });
      expect(await Job.countDocuments()).toBe(TOTAL_JOBS);
      expect(await User.countDocuments()).toBe(3);
      // one team org plus a Personal org each, as registration would create
      expect(await Organization.countDocuments()).toBe(4);
      expect(await Membership.countDocuments()).toBe(6);
    });

    it('gives each member the role the brief asks for, and a usable password', async () => {
      await runSeed(quiet);

      for (const member of TEAM) {
        const user = await User.findOne({ email: member.email });
        const membership = await Membership.findOne({
          user: user._id,
          organization: (await Organization.findOne({ slug: 'acme-recruiting' }))._id,
        });
        expect(membership.role).toBe(member.role);
      }

      const login = await request()
        .post('/api/v1/auth/login')
        .send({ email: TEAM[0].email, password: SEED_PASSWORD });
      expect(login.status).toBe(200);
    });

    it('spreads jobs across statuses, types, authors and 12 months', async () => {
      await runSeed(quiet);

      const countBy = async (field) =>
        Object.fromEntries(
          (await Job.aggregate([{ $group: { _id: `$${field}`, n: { $sum: 1 } } }])).map((r) => [
            r._id,
            r.n,
          ])
        );

      const statuses = await countBy('status');
      const types = await countBy('jobType');
      expect(Object.keys(statuses).sort()).toEqual(['declined', 'interview', 'pending']);
      expect(Object.keys(types).sort()).toEqual(['full-time', 'part-time', 'remote']);
      // roughly even: no bucket below a fifth of the total
      for (const n of [...Object.values(statuses), ...Object.values(types)]) {
        expect(n).toBeGreaterThan(TOTAL_JOBS / 5);
      }

      const authors = await Job.distinct('createdBy');
      expect(authors).toHaveLength(3);

      const months = await Job.distinct('createdAt').then(
        (dates) => new Set(dates.map((d) => d.toISOString().slice(0, 7)))
      );
      expect(months.size).toBeGreaterThanOrEqual(12);

      const companies = await Job.distinct('company');
      expect(companies.length).toBeGreaterThanOrEqual(20);
    });

    it('is deterministic: the same seed builds the same jobs', () => {
      const authors = [{ userId: new mongoose.Types.ObjectId(), share: 1 }];
      const organizationId = new mongoose.Types.ObjectId();
      const now = new Date('2026-09-18T00:00:00Z');

      const first = buildJobs({ authors, organizationId, now });
      const second = buildJobs({ authors, organizationId, now });

      expect(first).toHaveLength(TOTAL_JOBS);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    it('weights authors roughly 50 / 40 / 10', () => {
      const authors = TEAM.map((member) => ({
        userId: new mongoose.Types.ObjectId(),
        share: member.share,
      }));
      const jobs = buildJobs({
        authors,
        organizationId: new mongoose.Types.ObjectId(),
        now: new Date(),
      });

      const counts = authors.map(
        (author) => jobs.filter((job) => String(job.createdBy) === String(author.userId)).length
      );
      expect(counts[0]).toBeGreaterThan(counts[1]);
      expect(counts[1]).toBeGreaterThan(counts[2]);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(TOTAL_JOBS);
    });
  });

  describe('existing data (the brief\'s open question)', () => {
    it('refuses a database that already has users', async () => {
      await runSeed(quiet);

      await expect(runSeed(quiet)).rejects.toThrow(/Refusing to seed.*already has 3 user/s);
      expect(await Job.countDocuments()).toBe(TOTAL_JOBS);
      expect(await User.countDocuments()).toBe(3);
    });

    it('names the way out in the error', async () => {
      await runSeed(quiet);
      await expect(runSeed(quiet)).rejects.toThrow(/SEED_FORCE=1/);
    });

    it('wipes and reseeds with force, leaving exactly one dataset', async () => {
      await runSeed(quiet);
      const firstOrgId = (await Organization.findOne({ slug: 'acme-recruiting' }))._id;

      await runSeed({ ...quiet, force: true });

      const orgs = await Organization.find({ slug: /^acme-recruiting/ });
      expect(orgs).toHaveLength(1);
      expect(orgs[0]._id.equals(firstOrgId)).toBe(false);
      expect(await Job.countDocuments()).toBe(TOTAL_JOBS);
      expect(await User.countDocuments()).toBe(3);
    });

    it('does not touch data belonging to anyone else when refusing', async () => {
      const existing = await request()
        .post('/api/v1/auth/register')
        .send({ name: 'Real Person', email: 'real@example.com', password: 'secret123' });
      expect(existing.status).toBe(201);

      await expect(runSeed(quiet)).rejects.toThrow(/Refusing to seed/);

      expect(await User.countDocuments()).toBe(1);
      expect(await User.exists({ email: 'real@example.com' })).toBeTruthy();
    });
  });
});
