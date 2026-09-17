import mongoose from 'mongoose';
import { vi } from 'vitest';
import { request, registerUser } from './helpers.js';
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

  // Step 24
  it.todo('POST /orgs creates an org and makes the caller its owner');
  it.todo('slugs are unique: two orgs named "Acme" get acme and acme-2');
  it.todo('GET /orgs lists every org the user belongs to, with role');
  // X-Org-Id resolution is covered in roles.test.js (step 22).
});
