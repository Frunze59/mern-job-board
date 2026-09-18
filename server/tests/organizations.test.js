import mongoose from 'mongoose';
import { vi } from 'vitest';
import { request, registerUser, authed } from './helpers.js';
import User from '../models/User.js';
import Organization, { PERSONAL_ORG_NAME } from '../models/Organization.js';
import Membership from '../models/Membership.js';

const id = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  await Promise.all([Organization.init(), Membership.init(), User.init()]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The Personal org and membership belonging to a registered email. */
const personalStateFor = async (email) => {
  const user = await User.findOne({ email });
  const orgs = await Organization.find({ personalFor: user._id });
  const memberships = await Membership.find({ user: user._id });
  return { user, orgs, memberships };
};

describe('organizations & memberships', () => {
  describe('registration', () => {
    it('registration creates a Personal org with an owner membership', async () => {
      const { email } = await registerUser();
      const { user, orgs, memberships } = await personalStateFor(email);

      expect(orgs).toHaveLength(1);
      expect(orgs[0]).toMatchObject({ name: PERSONAL_ORG_NAME, slug: `personal-${user._id}` });

      expect(memberships).toHaveLength(1);
      expect(memberships[0].role).toBe('owner');
      expect(memberships[0].organization.equals(orgs[0]._id)).toBe(true);
    });

    it('keeps the v1 response shape: { user: { name, email }, token }', async () => {
      const res = await request()
        .post('/api/v1/auth/register')
        .send({ name: 'Shape Check', email: 'shape@example.com', password: 'secret123' });

      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(['token', 'user']);
      expect(res.body.user).toEqual({ name: 'Shape Check', email: 'shape@example.com' });
    });

    it('gives each user their own Personal org', async () => {
      const a = await personalStateFor((await registerUser()).email);
      const b = await personalStateFor((await registerUser()).email);
      expect(a.orgs[0]._id.equals(b.orgs[0]._id)).toBe(false);
      expect(await Organization.countDocuments()).toBe(2);
    });

    it('a rejected registration creates no org or membership', async () => {
      const { email } = await registerUser();
      const before = await Organization.countDocuments();

      const duplicate = await request()
        .post('/api/v1/auth/register')
        .send({ name: 'Again', email, password: 'secret123' });
      const invalid = await request()
        .post('/api/v1/auth/register')
        .send({ name: 'x', email: 'bad', password: '1' });

      expect(duplicate.status).toBe(400);
      expect(invalid.status).toBe(400);
      expect(await Organization.countDocuments()).toBe(before);
      expect(await Membership.countDocuments()).toBe(before);
    });

    it('logging in does not create another org', async () => {
      const { email, password } = await registerUser();
      await request().post('/api/v1/auth/login').send({ email, password });
      await request().post('/api/v1/auth/login').send({ email, password });
      expect(await Organization.countDocuments()).toBe(1);
      expect(await Membership.countDocuments()).toBe(1);
    });

    it('if the org step fails, the user is removed and the error surfaces', async () => {
      vi.spyOn(Organization, 'ensurePersonalFor').mockRejectedValueOnce(
        new Error('simulated outage')
      );

      const res = await request()
        .post('/api/v1/auth/register')
        .send({ name: 'Unlucky', email: 'unlucky@example.com', password: 'secret123' });

      expect(res.status).toBe(500);
      // generic message: the simulated error text must not leak
      expect(res.body).toEqual({ msg: 'Something went wrong, try again later' });
      expect(await User.countDocuments({ email: 'unlucky@example.com' })).toBe(0);

      // and the same email can register cleanly afterwards
      const retry = await request()
        .post('/api/v1/auth/register')
        .send({ name: 'Unlucky', email: 'unlucky@example.com', password: 'secret123' });
      expect(retry.status).toBe(201);
    });

    it('cleans up an org that was created before the membership step failed', async () => {
      vi.spyOn(Membership, 'updateOne').mockRejectedValueOnce(new Error('membership write lost'));

      const res = await request()
        .post('/api/v1/auth/register')
        .send({ name: 'Half Done', email: 'half@example.com', password: 'secret123' });

      expect(res.status).toBe(500);
      expect(await User.countDocuments()).toBe(0);
      expect(await Organization.countDocuments()).toBe(0);
      expect(await Membership.countDocuments()).toBe(0);
    });
  });

  describe('ensurePersonalFor', () => {
    it('is idempotent: two calls, one org, one membership', async () => {
      const userId = id();
      const first = await Organization.ensurePersonalFor(userId);
      const second = await Organization.ensurePersonalFor(userId);

      expect(first).toMatchObject({ orgCreated: true, membershipCreated: true });
      expect(second).toMatchObject({ orgCreated: false, membershipCreated: false });
      expect(await Organization.countDocuments({ personalFor: userId })).toBe(1);
      expect(await Membership.countDocuments({ user: userId })).toBe(1);
    });

    it('is safe under concurrent calls', async () => {
      const userId = id();
      await Promise.all(
        Array.from({ length: 6 }, () => Organization.ensurePersonalFor(userId))
      );
      expect(await Organization.countDocuments({ personalFor: userId })).toBe(1);
      expect(await Membership.countDocuments({ user: userId })).toBe(1);
    });

    it('repairs an org whose membership is missing', async () => {
      const userId = id();
      const { org } = await Organization.findOrCreatePersonal(userId);
      expect(await Membership.countDocuments({ user: userId })).toBe(0);

      const result = await Organization.ensurePersonalFor(userId);

      expect(result).toMatchObject({ orgCreated: false, membershipCreated: true });
      expect(result.org._id.equals(org._id)).toBe(true);
      const membership = await Membership.findOne({ user: userId });
      expect(membership.role).toBe('owner');
    });

    it('never changes an existing membership', async () => {
      const userId = id();
      const { org } = await Organization.findOrCreatePersonal(userId);
      await Membership.create({ user: userId, organization: org._id, role: 'viewer' });

      await Organization.ensurePersonalFor(userId);

      const membership = await Membership.findOne({ user: userId });
      expect(membership.role).toBe('viewer');
    });

    it('rethrows errors that are not duplicate-key races', async () => {
      vi.spyOn(Membership, 'updateOne').mockRejectedValueOnce(
        Object.assign(new Error('disk full'), { code: 14031 })
      );
      await expect(Organization.ensurePersonalFor(id())).rejects.toThrow('disk full');
    });
  });

  describe('POST /orgs', () => {
    it('creates an org and makes the caller its owner', async () => {
      const { token, email } = await registerUser();

      const res = await authed(token)('post', '/api/v1/orgs').send({ name: 'Acme Recruiting' });

      expect(res.status).toBe(201);
      expect(res.body.org).toMatchObject({
        name: 'Acme Recruiting',
        slug: 'acme-recruiting',
        role: 'owner',
        isPersonal: false,
      });

      const userId = (await User.findOne({ email }))._id;
      const membership = await Membership.findOne({
        user: userId,
        organization: res.body.org._id,
      });
      expect(membership.role).toBe('owner');
    });

    it('lets the creator use the new org immediately', async () => {
      const { token } = await registerUser();
      const { body } = await authed(token)('post', '/api/v1/orgs').send({ name: 'Acme' });

      const created = await authed(token, body.org._id)('post', '/api/v1/jobs').send({
        company: 'Acme',
        position: 'Dev',
        jobLocation: 'Riga',
      });

      expect(created.status).toBe(201);
      expect(created.body.job.organization).toBe(body.org._id);
    });

    it('slugs are unique: two orgs named "Acme" get acme and acme-2', async () => {
      const a = await registerUser();
      const b = await registerUser();
      const first = await authed(a.token)('post', '/api/v1/orgs').send({ name: 'Acme' });
      const second = await authed(b.token)('post', '/api/v1/orgs').send({ name: 'Acme' });

      expect(first.body.org.slug).toBe('acme');
      expect(second.body.org.slug).toBe('acme-2');
    });

    it('trims the name and rejects a blank or invalid one', async () => {
      const { token } = await registerUser();
      const as = authed(token);

      const trimmed = await as('post', '/api/v1/orgs').send({ name: '  Spaced Out  ' });
      expect(trimmed.body.org.name).toBe('Spaced Out');

      for (const name of [undefined, '', '   ']) {
        const res = await as('post', '/api/v1/orgs').send({ name });
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(/organization name/i);
      }
      const tooShort = await as('post', '/api/v1/orgs').send({ name: 'ab' });
      expect(tooShort.status).toBe(400);
    });

    it('leaves no org behind if the membership cannot be created', async () => {
      const { token } = await registerUser();
      vi.spyOn(Membership, 'create').mockRejectedValueOnce(new Error('write lost'));
      const before = await Organization.countDocuments();

      const res = await authed(token)('post', '/api/v1/orgs').send({ name: 'Doomed Agency' });

      expect(res.status).toBe(500);
      expect(await Organization.countDocuments()).toBe(before);
    });

    it('requires a token', async () => {
      const res = await request().post('/api/v1/orgs').send({ name: 'Acme' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /orgs', () => {
    it('lists every org the user belongs to, with role', async () => {
      const { token } = await registerUser();
      const as = authed(token);
      await as('post', '/api/v1/orgs').send({ name: 'Zebra Agency' });
      await as('post', '/api/v1/orgs').send({ name: 'Acme Recruiting' });

      const res = await as('get', '/api/v1/orgs');

      expect(res.status).toBe(200);
      // Personal first, then the rest alphabetically.
      expect(res.body.orgs.map((o) => [o.name, o.role, o.isPersonal])).toEqual([
        ['Personal', 'owner', true],
        ['Acme Recruiting', 'owner', false],
        ['Zebra Agency', 'owner', false],
      ]);
    });

    it('shows the role the user actually holds, not always owner', async () => {
      const owner = await registerUser();
      const guest = await registerUser();
      const { body } = await authed(owner.token)('post', '/api/v1/orgs').send({ name: 'Acme' });
      await Membership.create({
        user: (await User.findOne({ email: guest.email }))._id,
        organization: body.org._id,
        role: 'viewer',
      });

      const res = await authed(guest.token)('get', '/api/v1/orgs');
      const acme = res.body.orgs.find((o) => o.name === 'Acme');
      expect(acme.role).toBe('viewer');
    });

    it("never lists an org the user does not belong to", async () => {
      const owner = await registerUser();
      await authed(owner.token)('post', '/api/v1/orgs').send({ name: 'Secret Agency' });
      const outsider = await registerUser();

      const res = await authed(outsider.token)('get', '/api/v1/orgs');
      expect(res.body.orgs.map((o) => o.name)).toEqual(['Personal']);
    });
  });

  describe('GET /orgs/:orgId/members', () => {
    it('lists every member with name, email and role', async () => {
      const owner = await registerUser({ name: 'Owner Person' });
      const viewer = await registerUser({ name: 'Viewer Person' });
      const { body } = await authed(owner.token)('post', '/api/v1/orgs').send({ name: 'Acme' });
      await Membership.create({
        user: (await User.findOne({ email: viewer.email }))._id,
        organization: body.org._id,
        role: 'viewer',
      });

      const res = await authed(owner.token)('get', `/api/v1/orgs/${body.org._id}/members`);

      expect(res.status).toBe(200);
      expect(res.body.members.map((m) => [m.name, m.email, m.role])).toEqual([
        ['Owner Person', owner.email, 'owner'],
        ['Viewer Person', viewer.email, 'viewer'],
      ]);
      expect(res.body.members[0].joinedAt).toBeTruthy();
    });

    it('is open to every role, not just the owner', async () => {
      const owner = await registerUser();
      const viewer = await registerUser();
      const { body } = await authed(owner.token)('post', '/api/v1/orgs').send({ name: 'Acme' });
      await Membership.create({
        user: (await User.findOne({ email: viewer.email }))._id,
        organization: body.org._id,
        role: 'viewer',
      });

      const res = await authed(viewer.token)('get', `/api/v1/orgs/${body.org._id}/members`);
      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(2);
    });

    it('refuses a non-member, and an unknown org the same way', async () => {
      const owner = await registerUser();
      const outsider = await registerUser();
      const { body } = await authed(owner.token)('post', '/api/v1/orgs').send({ name: 'Acme' });

      const foreign = await authed(outsider.token)('get', `/api/v1/orgs/${body.org._id}/members`);
      const unknown = await authed(outsider.token)('get', `/api/v1/orgs/${id()}/members`);

      expect(foreign.status).toBe(403);
      expect(unknown.status).toBe(403);
      expect(foreign.body).toEqual(unknown.body);
    });

    it('rejects a malformed org id with 400', async () => {
      const { token } = await registerUser();
      const res = await authed(token)('get', '/api/v1/orgs/not-an-id/members');
      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/Invalid organization id/);
    });
  });
});
