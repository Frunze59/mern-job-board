import mongoose from 'mongoose';
import { registerUser, authed } from './helpers.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Membership from '../models/Membership.js';
import Invitation, { INVITATION_TTL_DAYS } from '../models/Invitation.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const userIdOf = async (email) => (await User.findOne({ email }))._id;

beforeAll(async () => {
  await Promise.all([Organization.init(), Membership.init(), Invitation.init(), User.init()]);
});

/** An org whose owner is the first returned account, plus a recruiter and viewer. */
const makeOrg = async (name = 'Acme Recruiting') => {
  const owner = await registerUser({ name: 'Owner Person' });
  const { body } = await authed(owner.token)('post', '/api/v1/orgs').send({ name });
  const orgId = body.org._id;

  const withRole = async (role) => {
    const account = await registerUser({ name: `${role} person` });
    await Membership.create({
      user: await userIdOf(account.email),
      organization: orgId,
      role,
    });
    return { ...account, as: authed(account.token, orgId) };
  };

  return {
    orgId,
    owner: { ...owner, as: authed(owner.token, orgId) },
    recruiter: await withRole('recruiter'),
    viewer: await withRole('viewer'),
  };
};

const invite = (as, orgId, body) => as('post', `/api/v1/orgs/${orgId}/invitations`).send(body);

describe('invitations', () => {
  describe('creating', () => {
    it('owner can invite; response carries an invite URL and a 7-day expiry', async () => {
      const { owner, orgId } = await makeOrg();
      const before = Date.now();

      const res = await invite(owner.as, orgId, { email: 'New.Person@Example.com', role: 'recruiter' });

      expect(res.status).toBe(201);
      expect(res.body.invitation).toEqual({
        email: 'new.person@example.com',
        role: 'recruiter',
        expiresAt: expect.any(String),
      });

      const ttl = new Date(res.body.invitation.expiresAt).getTime() - before;
      expect(ttl).toBeGreaterThan(INVITATION_TTL_DAYS * DAY_MS - 60_000);
      expect(ttl).toBeLessThanOrEqual(INVITATION_TTL_DAYS * DAY_MS + 60_000);

      const token = res.body.inviteUrl.split('/invitations/')[1];
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(res.body.inviteUrl).toMatch(/^https?:\/\/.+\/invitations\/[0-9a-f]{64}$/);
    });

    it('stores only the hash of the token, never the token itself', async () => {
      const { owner, orgId } = await makeOrg();
      const res = await invite(owner.as, orgId, { email: 'a@example.com', role: 'viewer' });
      const token = res.body.inviteUrl.split('/invitations/')[1];

      const stored = await Invitation.collection.findOne({ email: 'a@example.com' });
      expect(JSON.stringify(stored)).not.toContain(token);
      expect(stored.tokenHash).toBe(Invitation.hashToken(token));
      expect(stored.status).toBe('pending');
      expect(String(stored.invitedBy)).toBe(String(await userIdOf(owner.email)));
    });

    it('uses CLIENT_URL for the link when it is set', async () => {
      const { owner, orgId } = await makeOrg();
      vi.stubEnv('CLIENT_URL', 'https://jobs.example.com/');
      try {
        const res = await invite(owner.as, orgId, { email: 'a@example.com', role: 'viewer' });
        expect(res.body.inviteUrl).toMatch(/^https:\/\/jobs\.example\.com\/invitations\/[0-9a-f]{64}$/);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('recruiter and viewer get 403 when inviting', async () => {
      const { recruiter, viewer, orgId } = await makeOrg();

      for (const person of [recruiter, viewer]) {
        const res = await invite(person.as, orgId, { email: 'x@example.com', role: 'viewer' });
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ msg: 'Your role does not allow this action' });
      }
      expect(await Invitation.countDocuments()).toBe(0);
    });

    it('a complete outsider cannot invite, and cannot tell the org exists', async () => {
      const { orgId } = await makeOrg();
      const outsider = await registerUser();

      const res = await invite(authed(outsider.token), orgId, {
        email: 'x@example.com',
        role: 'viewer',
      });
      const unknownOrg = await invite(authed(outsider.token), new mongoose.Types.ObjectId(), {
        email: 'x@example.com',
        role: 'viewer',
      });

      expect(res.status).toBe(403);
      expect(res.body).toEqual(unknownOrg.body);
    });

    it('invalid role or missing fields -> 400', async () => {
      const { owner, orgId } = await makeOrg();

      const cases = [
        [{ email: 'a@example.com', role: 'admin' }, /not a supported role/],
        [{ email: 'a@example.com' }, /email and a role/],
        [{ role: 'viewer' }, /email and a role/],
        [{}, /email and a role/],
      ];
      for (const [body, pattern] of cases) {
        const res = await invite(owner.as, orgId, body);
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(pattern);
      }

      const badEmail = await invite(owner.as, orgId, { email: 'not-an-email', role: 'viewer' });
      expect(badEmail.status).toBe(400);
      expect(await Invitation.countDocuments()).toBe(0);
    });

    it('rejects inviting someone who is already a member', async () => {
      const { owner, recruiter, orgId } = await makeOrg();

      const other = await invite(owner.as, orgId, { email: recruiter.email, role: 'viewer' });
      const self = await invite(owner.as, orgId, { email: owner.email, role: 'viewer' });

      expect(other.status).toBe(400);
      expect(other.body.msg).toMatch(/already a member/);
      expect(self.status).toBe(400);
    });

    it('allows inviting an existing user who is not in this org', async () => {
      const { owner, orgId } = await makeOrg();
      const elsewhere = await registerUser();

      const res = await invite(owner.as, orgId, { email: elsewhere.email, role: 'recruiter' });
      expect(res.status).toBe(201);
    });

    it('re-inviting the same address replaces the pending invitation', async () => {
      const { owner, orgId } = await makeOrg();

      const first = await invite(owner.as, orgId, { email: 'a@example.com', role: 'viewer' });
      const second = await invite(owner.as, orgId, { email: 'a@example.com', role: 'recruiter' });

      const firstToken = first.body.inviteUrl.split('/invitations/')[1];
      const secondToken = second.body.inviteUrl.split('/invitations/')[1];
      expect(firstToken).not.toBe(secondToken);

      // exactly one live invitation, carrying the newest role
      expect(await Invitation.countDocuments({ organization: orgId })).toBe(1);
      expect(await Invitation.findByToken(firstToken)).toBeNull();
      const live = await Invitation.findByToken(secondToken);
      expect(live.role).toBe('recruiter');
    });

    it('keeps invitations for different orgs and addresses apart', async () => {
      const a = await makeOrg('Agency A');
      const b = await makeOrg('Agency B');

      await invite(a.owner.as, a.orgId, { email: 'shared@example.com', role: 'viewer' });
      await invite(b.owner.as, b.orgId, { email: 'shared@example.com', role: 'owner' });
      await invite(a.owner.as, a.orgId, { email: 'other@example.com', role: 'viewer' });

      expect(await Invitation.countDocuments()).toBe(3);
      expect(await Invitation.countDocuments({ organization: a.orgId })).toBe(2);
    });

    it('requires a token', async () => {
      const { orgId } = await makeOrg();
      const res = await invite(authed('nonsense'), orgId, {
        email: 'a@example.com',
        role: 'viewer',
      });
      expect(res.status).toBe(401);
    });
  });

  // Step 25
  describe('accepting as an existing, signed-in user', () => {
    it.todo('matching email -> membership created, token consumed, 200');
    it.todo('signed in as a different email -> 403');
    it.todo('accepting the same token twice -> 410');
  });

  describe('accepting as a brand-new user', () => {
    it.todo('{ password } creates the user, membership, and returns a JWT (201)');
    it.todo('name defaults to the part of the email before @');
    it.todo('email already registered but not signed in -> 403 telling them to sign in');
    it.todo('weak password -> 400 and NO user or membership is created');
  });

  describe('token lifecycle', () => {
    it.todo('unknown token -> 404');
    it.todo('expired token -> 410');
  });
});
