import mongoose from 'mongoose';
import { request, registerUser, authed } from './helpers.js';
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

/** Issue an invitation and return just the raw token from its URL. */
const tokenFor = async (as, orgId, email, role) => {
  const res = await invite(as, orgId, { email, role });
  if (res.status !== 201) {
    throw new Error(`invite failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.inviteUrl.split('/invitations/')[1];
};

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

    it('builds an https link behind a TLS-terminating proxy, like Render', async () => {
      // Found on the live deploy, not locally: Render ends HTTPS at its proxy
      // and forwards plain HTTP, announcing the original scheme in
      // X-Forwarded-Proto. Without trusting that header the link came out as
      // http://, so the raw token's first hop was unencrypted before Render's
      // redirect caught it. CLIENT_URL is left unset, as it is in production.
      const { owner, orgId } = await makeOrg();

      const res = await invite(owner.as, orgId, { email: 'a@example.com', role: 'viewer' })
        .set('X-Forwarded-Proto', 'https');

      expect(res.status).toBe(201);
      expect(res.body.inviteUrl).toMatch(/^https:\/\/[^/]+\/invitations\/[0-9a-f]{64}$/);
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

  describe('reading an invitation before accepting', () => {
    it('returns the email, role, org name and expiry', async () => {
      const { owner, orgId } = await makeOrg('Acme Recruiting');
      const token = await tokenFor(owner.as, orgId, 'new@example.com', 'recruiter');

      const res = await request().get(`/api/v1/invitations/${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        email: 'new@example.com',
        role: 'recruiter',
        orgName: 'Acme Recruiting',
        expiresAt: expect.any(String),
      });
    });

    it('needs no sign-in', async () => {
      const { owner, orgId } = await makeOrg();
      const token = await tokenFor(owner.as, orgId, 'new@example.com', 'viewer');
      const res = await request().get(`/api/v1/invitations/${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('accepting as an existing, signed-in user', () => {
    it('matching email -> membership created, token consumed, 200', async () => {
      const { owner, orgId } = await makeOrg('Acme Recruiting');
      const invitee = await registerUser({ name: 'Invited Person' });
      const token = await tokenFor(owner.as, orgId, invitee.email, 'recruiter');

      const res = await authed(invitee.token)('post', `/api/v1/invitations/${token}/accept`);

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('recruiter');
      expect(res.body.org).toMatchObject({
        _id: orgId,
        name: 'Acme Recruiting',
        role: 'recruiter',
        isPersonal: false,
      });

      const membership = await Membership.findOne({
        user: await userIdOf(invitee.email),
        organization: orgId,
      });
      expect(membership.role).toBe('recruiter');
      expect((await Invitation.findByToken(token)).status).toBe('accepted');
    });

    it('lets them work in the org straight away, at the granted role', async () => {
      const { owner, orgId } = await makeOrg();
      const invitee = await registerUser();
      const token = await tokenFor(owner.as, orgId, invitee.email, 'viewer');
      await authed(invitee.token)('post', `/api/v1/invitations/${token}/accept`);

      const as = authed(invitee.token, orgId);
      expect((await as('get', '/api/v1/jobs')).status).toBe(200);
      // granted viewer, so writes are refused
      const write = await as('post', '/api/v1/jobs').send({
        company: 'A',
        position: 'B',
        jobLocation: 'C',
      });
      expect(write.status).toBe(403);
    });

    it('keeps their Personal org as well as the new one', async () => {
      const { owner, orgId } = await makeOrg('Acme');
      const invitee = await registerUser();
      const token = await tokenFor(owner.as, orgId, invitee.email, 'recruiter');
      await authed(invitee.token)('post', `/api/v1/invitations/${token}/accept`);

      const res = await authed(invitee.token)('get', '/api/v1/orgs');
      expect(res.body.orgs.map((o) => [o.name, o.role])).toEqual([
        ['Personal', 'owner'],
        ['Acme', 'recruiter'],
      ]);
    });

    it('signed in as a different email -> 403 naming the right address', async () => {
      const { owner, orgId } = await makeOrg();
      const wrongPerson = await registerUser();
      const token = await tokenFor(owner.as, orgId, 'someone.else@example.com', 'viewer');

      const res = await authed(wrongPerson.token)('post', `/api/v1/invitations/${token}/accept`);

      expect(res.status).toBe(403);
      expect(res.body.msg).toContain('someone.else@example.com');
      expect(await Membership.countDocuments({ organization: orgId })).toBe(3);
      expect((await Invitation.findByToken(token)).status).toBe('pending');
    });

    it('accepting the same token twice -> 410', async () => {
      const { owner, orgId } = await makeOrg();
      const invitee = await registerUser();
      const token = await tokenFor(owner.as, orgId, invitee.email, 'viewer');

      const first = await authed(invitee.token)('post', `/api/v1/invitations/${token}/accept`);
      const second = await authed(invitee.token)('post', `/api/v1/invitations/${token}/accept`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(410);
      expect(second.body.msg).toMatch(/already been used/);
    });

    it('a broken Authorization header is 401, not the new-account branch', async () => {
      const { owner, orgId } = await makeOrg();
      const token = await tokenFor(owner.as, orgId, 'new@example.com', 'viewer');

      const res = await authed('not.a.jwt')('post', `/api/v1/invitations/${token}/accept`);

      expect(res.status).toBe(401);
      expect(await User.countDocuments({ email: 'new@example.com' })).toBe(0);
    });

    it('resumes when a crash left the membership without consuming the token', async () => {
      const { owner, orgId } = await makeOrg();
      const invitee = await registerUser();
      const token = await tokenFor(owner.as, orgId, invitee.email, 'recruiter');
      // the state a crash between the two writes would leave
      await Membership.create({
        user: await userIdOf(invitee.email),
        organization: orgId,
        role: 'recruiter',
      });

      const res = await authed(invitee.token)('post', `/api/v1/invitations/${token}/accept`);

      expect(res.status).toBe(200);
      expect((await Invitation.findByToken(token)).status).toBe('accepted');
      expect(
        await Membership.countDocuments({
          user: await userIdOf(invitee.email),
          organization: orgId,
        })
      ).toBe(1);
    });
  });

  describe('accepting as a brand-new user', () => {
    it('{ password } creates the user, membership, and returns a JWT (201)', async () => {
      const { owner, orgId } = await makeOrg('Acme Recruiting');
      const token = await tokenFor(owner.as, orgId, 'newcomer@example.com', 'recruiter');

      const res = await request()
        .post(`/api/v1/invitations/${token}/accept`)
        .send({ password: 'secret123', name: 'New Comer' });

      expect(res.status).toBe(201);
      expect(res.body.user).toEqual({ name: 'New Comer', email: 'newcomer@example.com' });
      expect(res.body.token.split('.')).toHaveLength(3);
      expect(res.body.org).toMatchObject({ name: 'Acme Recruiting', role: 'recruiter' });
      expect(JSON.stringify(res.body)).not.toMatch(/\$2[ab]\$/);

      // the returned token works immediately, in the org they were invited to
      const jobs = await authed(res.body.token, orgId)('get', '/api/v1/jobs');
      expect(jobs.status).toBe(200);
    });

    it('gives the new user a Personal org too', async () => {
      const { owner, orgId } = await makeOrg('Acme');
      const token = await tokenFor(owner.as, orgId, 'newcomer@example.com', 'viewer');

      const res = await request()
        .post(`/api/v1/invitations/${token}/accept`)
        .send({ password: 'secret123' });

      const orgs = await authed(res.body.token)('get', '/api/v1/orgs');
      expect(orgs.body.orgs.map((o) => [o.name, o.role])).toEqual([
        ['Personal', 'owner'],
        ['Acme', 'viewer'],
      ]);
    });

    it('name defaults to the part of the email before @', async () => {
      const { owner, orgId } = await makeOrg();
      const token = await tokenFor(owner.as, orgId, 'jane.doe@example.com', 'viewer');

      const res = await request()
        .post(`/api/v1/invitations/${token}/accept`)
        .send({ password: 'secret123' });

      expect(res.body.user.name).toBe('jane.doe');
    });

    it('can sign in afterwards with the password they chose', async () => {
      const { owner, orgId } = await makeOrg();
      const token = await tokenFor(owner.as, orgId, 'newcomer@example.com', 'viewer');
      await request()
        .post(`/api/v1/invitations/${token}/accept`)
        .send({ password: 'secret123' });

      const login = await request()
        .post('/api/v1/auth/login')
        .send({ email: 'newcomer@example.com', password: 'secret123' });

      expect(login.status).toBe(200);
    });

    it('email already registered but not signed in -> 403 telling them to sign in', async () => {
      const { owner, orgId } = await makeOrg();
      const existing = await registerUser();
      const token = await tokenFor(owner.as, orgId, existing.email, 'viewer');

      const res = await request()
        .post(`/api/v1/invitations/${token}/accept`)
        .send({ password: 'whatever-they-typed' });

      expect(res.status).toBe(403);
      expect(res.body.msg).toMatch(/already exists.*sign in/i);
      // the link still works once they do sign in
      expect((await Invitation.findByToken(token)).status).toBe('pending');
      const retry = await authed(existing.token)('post', `/api/v1/invitations/${token}/accept`);
      expect(retry.status).toBe(200);
    });

    it('missing password -> 400 and no user is created', async () => {
      const { owner, orgId } = await makeOrg();
      const token = await tokenFor(owner.as, orgId, 'newcomer@example.com', 'viewer');

      const res = await request().post(`/api/v1/invitations/${token}/accept`).send({});

      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/password/i);
      expect(await User.countDocuments({ email: 'newcomer@example.com' })).toBe(0);
    });

    it('weak password -> 400 and NO user or membership is created', async () => {
      const { owner, orgId } = await makeOrg();
      const token = await tokenFor(owner.as, orgId, 'newcomer@example.com', 'viewer');
      const membersBefore = await Membership.countDocuments({ organization: orgId });

      const res = await request()
        .post(`/api/v1/invitations/${token}/accept`)
        .send({ password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/at least 6 characters/);
      expect(await User.countDocuments({ email: 'newcomer@example.com' })).toBe(0);
      expect(await Membership.countDocuments({ organization: orgId })).toBe(membersBefore);
      expect((await Invitation.findByToken(token)).status).toBe('pending');
    });

    it('rolls the new account back if joining the org fails', async () => {
      const { owner, orgId } = await makeOrg();
      const token = await tokenFor(owner.as, orgId, 'newcomer@example.com', 'viewer');
      vi.spyOn(Organization, 'ensurePersonalFor').mockRejectedValueOnce(new Error('outage'));

      const res = await request()
        .post(`/api/v1/invitations/${token}/accept`)
        .send({ password: 'secret123' });

      expect(res.status).toBe(500);
      expect(await User.countDocuments({ email: 'newcomer@example.com' })).toBe(0);
      // the invitation survives, so the link can be used again
      expect((await Invitation.findByToken(token)).status).toBe('pending');

      vi.restoreAllMocks();
      const retry = await request()
        .post(`/api/v1/invitations/${token}/accept`)
        .send({ password: 'secret123' });
      expect(retry.status).toBe(201);
    });
  });

  describe('token lifecycle', () => {
    it('unknown token -> 404', async () => {
      const res = await request().post('/api/v1/invitations/nope/accept').send({
        password: 'secret123',
      });
      expect(res.status).toBe(404);
      expect(await request().get('/api/v1/invitations/nope')).toMatchObject({ status: 404 });
    });

    it('knowing the stored hash is not enough to accept', async () => {
      const { owner, orgId } = await makeOrg();
      const token = await tokenFor(owner.as, orgId, 'new@example.com', 'viewer');
      const { tokenHash } = await Invitation.findByToken(token);

      const res = await request().get(`/api/v1/invitations/${tokenHash}`);
      expect(res.status).toBe(404);
    });

    it('expired token -> 410', async () => {
      const { owner, orgId } = await makeOrg();
      const invitee = await registerUser();
      const token = await tokenFor(owner.as, orgId, invitee.email, 'viewer');
      await Invitation.updateOne(
        { tokenHash: Invitation.hashToken(token) },
        { expiresAt: new Date(Date.now() - 1000) }
      );

      const read = await request().get(`/api/v1/invitations/${token}`);
      const accept = await authed(invitee.token)('post', `/api/v1/invitations/${token}/accept`);

      expect(read.status).toBe(410);
      expect(accept.status).toBe(410);
      expect(accept.body.msg).toMatch(/expired/);
      expect(await Membership.countDocuments({ organization: orgId })).toBe(3);
    });

    it('410 when the organization has been deleted', async () => {
      const { owner, orgId } = await makeOrg();
      const invitee = await registerUser();
      const token = await tokenFor(owner.as, orgId, invitee.email, 'viewer');
      await Organization.deleteOne({ _id: orgId });

      const res = await authed(invitee.token)('post', `/api/v1/invitations/${token}/accept`);
      expect(res.status).toBe(410);
      expect(res.body.msg).toMatch(/no longer exists/);
    });

    it('a superseded token is dead and the newest one works', async () => {
      const { owner, orgId } = await makeOrg();
      const invitee = await registerUser();
      const stale = await tokenFor(owner.as, orgId, invitee.email, 'viewer');
      const fresh = await tokenFor(owner.as, orgId, invitee.email, 'recruiter');

      const staleRes = await authed(invitee.token)('post', `/api/v1/invitations/${stale}/accept`);
      expect(staleRes.status).toBe(404);

      const freshRes = await authed(invitee.token)('post', `/api/v1/invitations/${fresh}/accept`);
      expect(freshRes.status).toBe(200);
      expect(freshRes.body.role).toBe('recruiter');
    });
  });
});
