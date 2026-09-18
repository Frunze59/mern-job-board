import mongoose from 'mongoose';
import { registerUser, authed } from './helpers.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Membership from '../models/Membership.js';
import Job from '../models/Job.js';
import requireRole from '../middleware/requireRole.js';

/**
 * Role enforcement and org scoping for jobs.
 *
 * POST /orgs and invitations arrive in later steps, so the shared org and its
 * memberships are created directly in the database here.
 */

const jobBody = (overrides = {}) => ({
  company: 'Acme',
  position: 'Developer',
  jobLocation: 'Riga',
  ...overrides,
});

const userIdOf = async (email) => (await User.findOne({ email }))._id;

/** A shared org with an owner, two recruiters and a viewer. */
const makeTeam = async (name = 'Acme Recruiting') => {
  const org = await Organization.createWithUniqueSlug(name);
  const people = {};
  for (const [key, role] of [
    ['owner', 'owner'],
    ['recruiter', 'recruiter'],
    ['recruiter2', 'recruiter'],
    ['viewer', 'viewer'],
  ]) {
    const account = await registerUser({ name: `${key} person` });
    await Membership.create({
      user: await userIdOf(account.email),
      organization: org._id,
      role,
    });
    people[key] = { ...account, as: authed(account.token, org._id) };
  }
  return { org, orgId: String(org._id), ...people };
};

const createJob = async (as, overrides) => {
  const res = await as('post', '/api/v1/jobs').send(jobBody(overrides));
  expect(res.status).toBe(201);
  return res.body.job;
};

beforeAll(async () => {
  await Promise.all([Organization.init(), Membership.init(), Job.init(), User.init()]);
});

describe('role enforcement on jobs', () => {
  it.each(['owner', 'recruiter'])('%s can create, patch and delete', async (role) => {
    const team = await makeTeam();
    const { as } = team[role];

    const job = await createJob(as);
    expect(job.organization).toBe(team.orgId);

    const patched = await as('patch', `/api/v1/jobs/${job._id}`).send({ status: 'interview' });
    expect(patched.status).toBe(200);
    expect(patched.body.job.status).toBe('interview');

    const removed = await as('delete', `/api/v1/jobs/${job._id}`);
    expect(removed.status).toBe(200);
    expect(await Job.countDocuments({ _id: job._id })).toBe(0);
  });

  it('viewer can list and read but gets 403 on create, patch and delete', async () => {
    const team = await makeTeam();
    const job = await createJob(team.owner.as, { position: 'Untouchable' });
    const { as } = team.viewer;

    const list = await as('get', '/api/v1/jobs');
    expect(list.status).toBe(200);
    expect(list.body.totalJobs).toBe(1);
    expect((await as('get', `/api/v1/jobs/${job._id}`)).status).toBe(200);

    const attempts = await Promise.all([
      as('post', '/api/v1/jobs').send(jobBody()),
      as('patch', `/api/v1/jobs/${job._id}`).send({ position: 'Changed' }),
      as('delete', `/api/v1/jobs/${job._id}`),
    ]);
    for (const res of attempts) {
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ msg: 'Your role does not allow this action' });
    }

    // nothing changed
    const stored = await Job.findById(job._id);
    expect(stored.position).toBe('Untouchable');
    expect(await Job.countDocuments({ organization: team.orgId })).toBe(1);
  });

  it('viewer gets the same 403 for an id that does not exist', async () => {
    const team = await makeTeam();
    const ghost = new mongoose.Types.ObjectId();
    const res = await team.viewer.as('delete', `/api/v1/jobs/${ghost}`);
    // role is checked before the lookup, so the response reveals nothing
    expect(res.status).toBe(403);
  });

  it('a recruiter can edit and delete a job created by ANOTHER recruiter', async () => {
    const team = await makeTeam();
    const job = await createJob(team.recruiter.as, { position: 'Shared Role' });

    const patched = await team.recruiter2.as('patch', `/api/v1/jobs/${job._id}`).send({
      status: 'declined',
    });
    expect(patched.status).toBe(200);
    expect(patched.body.job.status).toBe('declined');
    // createdBy stays with the original author
    expect(patched.body.job.createdByName).toBe('recruiter person');

    const removed = await team.recruiter2.as('delete', `/api/v1/jobs/${job._id}`);
    expect(removed.status).toBe(200);
  });

  it('all members of an org see the same pool of jobs', async () => {
    const team = await makeTeam();
    await createJob(team.owner.as, { position: 'By Owner' });
    await createJob(team.recruiter.as, { position: 'By Recruiter' });

    for (const key of ['owner', 'recruiter', 'recruiter2', 'viewer']) {
      const res = await team[key].as('get', '/api/v1/jobs?sort=a-z');
      expect(res.body.jobs.map((j) => j.position)).toEqual(['By Owner', 'By Recruiter']);
    }
  });

  it('a job in org A is invisible from org B (list, get, patch, delete all 404)', async () => {
    const teamA = await makeTeam('Agency A');
    const teamB = await makeTeam('Agency B');
    const job = await createJob(teamA.owner.as, { position: 'A only' });
    const { as } = teamB.owner;

    const list = await as('get', '/api/v1/jobs');
    expect(list.body.totalJobs).toBe(0);

    const results = await Promise.all([
      as('get', `/api/v1/jobs/${job._id}`),
      as('patch', `/api/v1/jobs/${job._id}`).send({ position: 'Hijacked' }),
      as('delete', `/api/v1/jobs/${job._id}`),
    ]);
    expect(results.map((r) => r.status)).toEqual([404, 404, 404]);

    const stored = await Job.findById(job._id);
    expect(stored.position).toBe('A only');
  });

  it("switching X-Org-Id switches which org's jobs a person sees", async () => {
    const team = await makeTeam();
    const { token } = team.owner;
    await createJob(authed(token), { position: 'Personal job' });
    await createJob(team.owner.as, { position: 'Team job' });

    const personal = await authed(token)('get', '/api/v1/jobs');
    const shared = await authed(token, team.orgId)('get', '/api/v1/jobs');

    expect(personal.body.jobs.map((j) => j.position)).toEqual(['Personal job']);
    expect(shared.body.jobs.map((j) => j.position)).toEqual(['Team job']);
  });

  it('createdBy and organization come from the server and cannot be forged', async () => {
    const team = await makeTeam();
    const other = await makeTeam('Somewhere Else');
    const forgedUser = String(new mongoose.Types.ObjectId());
    const ownerId = String(await userIdOf(team.recruiter.email));

    const created = await createJob(team.recruiter.as, {
      createdBy: forgedUser,
      organization: other.orgId,
    });
    expect(created.createdBy).toBe(ownerId);
    expect(created.organization).toBe(team.orgId);

    const patched = await team.recruiter.as('patch', `/api/v1/jobs/${created._id}`).send({
      createdBy: forgedUser,
      organization: other.orgId,
      status: 'interview',
    });
    expect(patched.status).toBe(200);
    expect(patched.body.job.createdBy).toBe(ownerId);
    expect(patched.body.job.organization).toBe(team.orgId);
  });

  it('a patch that only names protected fields is rejected as empty', async () => {
    const team = await makeTeam();
    const job = await createJob(team.owner.as);
    const res = await team.owner
      .as('patch', `/api/v1/jobs/${job._id}`)
      .send({ organization: String(new mongoose.Types.ObjectId()) });
    expect(res.status).toBe(400);
  });

  it('a role change takes effect on the very next request', async () => {
    const team = await makeTeam();
    const recruiterId = await userIdOf(team.recruiter.email);

    await createJob(team.recruiter.as);
    await Membership.updateOne(
      { user: recruiterId, organization: team.orgId },
      { role: 'viewer' }
    );
    const denied = await team.recruiter.as('post', '/api/v1/jobs').send(jobBody());
    expect(denied.status).toBe(403);

    await Membership.deleteOne({ user: recruiterId, organization: team.orgId });
    const removed = await team.recruiter.as('get', '/api/v1/jobs');
    expect(removed.status).toBe(403);
  });

  describe('createdByName', () => {
    it('is on list, get, create and patch responses', async () => {
      const team = await makeTeam();
      const created = await createJob(team.recruiter.as);
      expect(created.createdByName).toBe('recruiter person');

      const list = await team.viewer.as('get', '/api/v1/jobs');
      expect(list.body.jobs[0].createdByName).toBe('recruiter person');

      const one = await team.viewer.as('get', `/api/v1/jobs/${created._id}`);
      expect(one.body.job.createdByName).toBe('recruiter person');

      const patched = await team.owner.as('patch', `/api/v1/jobs/${created._id}`).send({
        status: 'interview',
      });
      expect(patched.body.job.createdByName).toBe('recruiter person');
    });

    it('names each author correctly on a mixed page', async () => {
      const team = await makeTeam();
      await createJob(team.owner.as, { position: 'A' });
      await createJob(team.recruiter.as, { position: 'B' });
      await createJob(team.recruiter2.as, { position: 'C' });

      const res = await team.viewer.as('get', '/api/v1/jobs?sort=a-z');
      expect(res.body.jobs.map((j) => [j.position, j.createdByName])).toEqual([
        ['A', 'owner person'],
        ['B', 'recruiter person'],
        ['C', 'recruiter2 person'],
      ]);
    });

    it('is null, and createdBy keeps its id, when the author no longer exists', async () => {
      const team = await makeTeam();
      const created = await createJob(team.recruiter.as);
      await User.deleteOne({ _id: created.createdBy });

      const res = await team.owner.as('get', `/api/v1/jobs/${created._id}`);
      expect(res.status).toBe(200);
      expect(res.body.job.createdByName).toBeNull();
      expect(res.body.job.createdBy).toBe(created.createdBy);
    });
  });
});

describe('active org resolution (X-Org-Id)', () => {
  it('missing X-Org-Id falls back to the Personal org', async () => {
    const { token, email } = await registerUser();
    const job = await createJob(authed(token));
    const personal = await Organization.findOne({ personalFor: await userIdOf(email) });
    expect(job.organization).toBe(String(personal._id));
  });

  it('a blank X-Org-Id is treated as missing', async () => {
    const { token } = await registerUser();
    const res = await authed(token)('get', '/api/v1/jobs').set('X-Org-Id', '   ');
    expect(res.status).toBe(200);
  });

  it('X-Org-Id for an org the user is not in -> 403', async () => {
    const team = await makeTeam();
    const outsider = await registerUser();
    const res = await authed(outsider.token, team.orgId)('get', '/api/v1/jobs');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ msg: 'You are not a member of this organization' });
  });

  it('an org id that does not exist gets the same 403 as a foreign one', async () => {
    const { token } = await registerUser();
    const res = await authed(token, new mongoose.Types.ObjectId())('get', '/api/v1/jobs');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ msg: 'You are not a member of this organization' });
  });

  it('a malformed X-Org-Id -> 400', async () => {
    const { token } = await registerUser();
    const res = await authed(token, 'not-an-id')('get', '/api/v1/jobs');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ msg: 'X-Org-Id must be a valid organization id' });
  });

  it('someone else\'s Personal org is off limits too', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const bobsPersonal = await Organization.findOne({ personalFor: await userIdOf(bob.email) });
    const res = await authed(alice.token, bobsPersonal._id)('get', '/api/v1/jobs');
    expect(res.status).toBe(403);
  });

  it('403 with a clear message when an account has no Personal org', async () => {
    const { token, email } = await registerUser();
    await Organization.deleteOne({ personalFor: await userIdOf(email) });
    const res = await authed(token)('get', '/api/v1/jobs');
    expect(res.status).toBe(403);
    expect(res.body.msg).toMatch(/No Personal organization/);
  });

  it('auth runs before org resolution: no token is still 401', async () => {
    const team = await makeTeam();
    const res = await authed('garbage', team.orgId)('get', '/api/v1/jobs');
    expect(res.status).toBe(401);
  });
});

describe('requireRole', () => {
  it('refuses to build with no roles or an unknown role', () => {
    expect(() => requireRole()).toThrow('at least one role');
    expect(() => requireRole('owner', 'admin')).toThrow('unknown role(s): admin');
  });

  it('treats a missing req.org as a wiring bug, not a client error', () => {
    const gate = requireRole('owner');
    expect(() => gate({}, {}, () => {})).toThrow('must run after resolveOrg');
  });

  it('calls next() for an allowed role', () => {
    const gate = requireRole('owner', 'recruiter');
    let called = false;
    gate({ org: { role: 'recruiter' } }, {}, () => {
      called = true;
    });
    expect(called).toBe(true);
  });
});

describe('Job.organization', () => {
  it('is now required', async () => {
    const error = await Job.create({
      company: 'C',
      position: 'P',
      jobLocation: 'L',
      createdBy: new mongoose.Types.ObjectId(),
    }).catch((e) => e);
    expect(error.errors.organization.message).toBe('Please provide an organization');
  });
});
