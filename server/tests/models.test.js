import crypto from 'crypto';
import mongoose from 'mongoose';
import Organization, { PERSONAL_ORG_NAME } from '../models/Organization.js';
import Membership from '../models/Membership.js';
import Invitation, { INVITATION_TTL_DAYS } from '../models/Invitation.js';
import Job from '../models/Job.js';

const id = () => new mongoose.Types.ObjectId();
const DAY_MS = 24 * 60 * 60 * 1000;

// Unique indexes are built asynchronously after connect. Wait for them, or a
// "duplicate is rejected" test can pass or fail depending on timing.
beforeAll(async () => {
  await Promise.all([Organization.init(), Membership.init(), Invitation.init(), Job.init()]);
});

describe('Organization', () => {
  describe('slugify', () => {
    it.each([
      ['Acme Recruiting', 'acme-recruiting'],
      ['  Acme   Recruiting!! ', 'acme-recruiting'],
      ['Ångström & Co', 'angstrom-co'],
      ['ACME 2026', 'acme-2026'],
      ['!!!', 'org'],
      ['', 'org'],
    ])('%j -> %s', (name, expected) => {
      expect(Organization.slugify(name)).toBe(expected);
    });

    it('caps long names at 60 characters with no trailing dash', () => {
      const slug = Organization.slugify(`${'word '.repeat(30)}`);
      expect(slug.length).toBeLessThanOrEqual(60);
      expect(slug).not.toMatch(/-$/);
    });
  });

  describe('createWithUniqueSlug', () => {
    it('gives repeated names acme, acme-2, acme-3', async () => {
      const slugs = [];
      for (let i = 0; i < 3; i += 1) {
        slugs.push((await Organization.createWithUniqueSlug('Acme')).slug);
      }
      expect(slugs).toEqual(['acme', 'acme-2', 'acme-3']);
    });

    it('continues past the highest suffix, not the first gap', async () => {
      await Organization.create({ name: 'Acme', slug: 'acme' });
      await Organization.create({ name: 'Acme', slug: 'acme-5' });
      const org = await Organization.createWithUniqueSlug('Acme');
      expect(org.slug).toBe('acme-6');
    });

    it('does not treat a longer slug as a clash', async () => {
      await Organization.createWithUniqueSlug('Acme Corp');
      const org = await Organization.createWithUniqueSlug('Acme');
      expect(org.slug).toBe('acme');
    });

    it('survives concurrent creates with the same name', async () => {
      const orgs = await Promise.all(
        Array.from({ length: 5 }, () => Organization.createWithUniqueSlug('Race'))
      );
      const slugs = orgs.map((o) => o.slug);
      expect(new Set(slugs).size).toBe(5);
    });

    it('enforces the 3-80 character name rule', async () => {
      await expect(Organization.createWithUniqueSlug('ab')).rejects.toMatchObject({
        name: 'ValidationError',
      });
      await expect(Organization.createWithUniqueSlug('x'.repeat(81))).rejects.toMatchObject({
        name: 'ValidationError',
      });
      await expect(Organization.createWithUniqueSlug('x'.repeat(80))).resolves.toBeTruthy();
    });

    it('rejects a duplicate slug at the database level', async () => {
      await Organization.create({ name: 'First', slug: 'same' });
      await expect(Organization.create({ name: 'Second', slug: 'same' })).rejects.toMatchObject({
        code: 11000,
      });
    });
  });

  describe('personal organizations', () => {
    it('findOrCreatePersonal creates once and then returns the same org', async () => {
      const userId = id();
      const first = await Organization.findOrCreatePersonal(userId);
      const second = await Organization.findOrCreatePersonal(userId);

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.org._id.equals(first.org._id)).toBe(true);
      expect(first.org.name).toBe(PERSONAL_ORG_NAME);
      expect(first.org.slug).toBe(`personal-${userId}`);
      expect(await Organization.countDocuments({ personalFor: userId })).toBe(1);
    });

    it('is safe under concurrent calls for the same user', async () => {
      const userId = id();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => Organization.findOrCreatePersonal(userId))
      );
      const ids = new Set(results.map((r) => String(r.org._id)));
      expect(ids.size).toBe(1);
      expect(results.filter((r) => r.created)).toHaveLength(1);
      expect(await Organization.countDocuments({ personalFor: userId })).toBe(1);
    });

    it('database refuses a second Personal org for the same user', async () => {
      const userId = id();
      await Organization.create({ name: 'Personal', slug: 'p-one', personalFor: userId });
      await expect(
        Organization.create({ name: 'Personal', slug: 'p-two', personalFor: userId })
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('allows any number of shared orgs, which have no personalFor', async () => {
      await Organization.create({ name: 'Shared One', slug: 'shared-1' });
      await Organization.create({ name: 'Shared Two', slug: 'shared-2' });
      await Organization.create({ name: 'Shared Null', slug: 'shared-3', personalFor: null });
      await Organization.create({ name: 'Shared Nul2', slug: 'shared-4', personalFor: null });
      expect(await Organization.countDocuments()).toBe(4);
    });

    it('different users each get their own Personal org', async () => {
      const a = await Organization.findOrCreatePersonal(id());
      const b = await Organization.findOrCreatePersonal(id());
      expect(a.org._id.equals(b.org._id)).toBe(false);
    });
  });
});

describe('Membership', () => {
  it('accepts each of the three roles', async () => {
    for (const role of ['owner', 'recruiter', 'viewer']) {
      await expect(
        Membership.create({ user: id(), organization: id(), role })
      ).resolves.toMatchObject({ role });
    }
  });

  it('rejects an unknown role with a readable message', async () => {
    const error = await Membership.create({ user: id(), organization: id(), role: 'admin' }).catch(
      (e) => e
    );
    expect(error.errors.role.message).toBe('admin is not a supported role');
  });

  it('requires user, organization and role', async () => {
    const error = await Membership.create({}).catch((e) => e);
    expect(Object.keys(error.errors).sort()).toEqual(['organization', 'role', 'user']);
  });

  it('allows only one membership per user per org', async () => {
    const user = id();
    const organization = id();
    await Membership.create({ user, organization, role: 'owner' });
    await expect(
      Membership.create({ user, organization, role: 'viewer' })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('lets the same user join several orgs', async () => {
    const user = id();
    await Membership.create({ user, organization: id(), role: 'owner' });
    await Membership.create({ user, organization: id(), role: 'viewer' });
    expect(await Membership.countDocuments({ user })).toBe(2);
  });
});

describe('Invitation', () => {
  const base = () => ({ organization: id(), email: 'Invitee@Example.COM ', role: 'recruiter' });

  it('hashToken is SHA-256 hex and deterministic', () => {
    const expected = crypto.createHash('sha256').update('abc').digest('hex');
    expect(Invitation.hashToken('abc')).toBe(expected);
    expect(Invitation.hashToken('abc')).toBe(Invitation.hashToken('abc'));
    expect(Invitation.hashToken('abc')).not.toBe(Invitation.hashToken('abd'));
    expect(Invitation.hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('issue returns a 64-char raw token and stores only its hash', async () => {
    const { invitation, rawToken } = await Invitation.issue(base());

    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(invitation.tokenHash).toBe(Invitation.hashToken(rawToken));

    const stored = await Invitation.collection.findOne({ _id: invitation._id });
    expect(JSON.stringify(stored)).not.toContain(rawToken);
    expect(stored.tokenHash).toBe(Invitation.hashToken(rawToken));
  });

  it('issues a different token every time', async () => {
    const tokens = await Promise.all(
      Array.from({ length: 10 }, async () => (await Invitation.issue(base())).rawToken)
    );
    expect(new Set(tokens).size).toBe(10);
  });

  it('defaults to pending, normalises the email, and expires in 7 days', async () => {
    const now = new Date('2026-09-17T12:00:00Z');
    const { invitation } = await Invitation.issue({ ...base(), now });

    expect(invitation.status).toBe('pending');
    expect(invitation.email).toBe('invitee@example.com');
    expect(invitation.expiresAt.getTime() - now.getTime()).toBe(INVITATION_TTL_DAYS * DAY_MS);
  });

  it('findByToken finds it from the raw token, and not from the hash', async () => {
    const { invitation, rawToken } = await Invitation.issue(base());

    const found = await Invitation.findByToken(rawToken);
    expect(found._id.equals(invitation._id)).toBe(true);

    // Knowing the stored hash must not be enough to use the invitation.
    expect(await Invitation.findByToken(invitation.tokenHash)).toBeNull();
    expect(await Invitation.findByToken('nope')).toBeNull();
  });

  it('isExpired and isUsable follow the clock and the status', async () => {
    const now = new Date('2026-09-17T12:00:00Z');
    const { invitation } = await Invitation.issue({ ...base(), now });
    const at = (days) => new Date(now.getTime() + days * DAY_MS);

    expect(invitation.isExpired(at(6.99))).toBe(false);
    expect(invitation.isExpired(at(7))).toBe(true);
    expect(invitation.isUsable(at(1))).toBe(true);
    expect(invitation.isUsable(at(8))).toBe(false);

    invitation.status = 'accepted';
    expect(invitation.isUsable(at(1))).toBe(false);
  });

  it('never serialises the token hash', async () => {
    const { invitation } = await Invitation.issue(base());
    const json = invitation.toJSON();
    expect(json).not.toHaveProperty('tokenHash');
    expect(json).toMatchObject({ email: 'invitee@example.com', role: 'recruiter' });
  });

  it('rejects a bad email and an unknown role', async () => {
    const error = await Invitation.issue({ ...base(), email: 'nope', role: 'admin' }).catch(
      (e) => e
    );
    expect(error.errors.email.message).toBe('Please provide a valid email');
    expect(error.errors.role.message).toBe('admin is not a supported role');
  });
});

describe('Job.organization', () => {
  it('is stored as a reference', async () => {
    const organization = id();
    const job = await Job.create({
      company: 'Acme',
      position: 'Dev',
      jobLocation: 'Riga',
      createdBy: id(),
      organization,
    });
    expect(job.organization.equals(organization)).toBe(true);
  });

  it('has the { organization, createdAt } index the stats pipeline relies on', async () => {
    const indexes = await Job.collection.indexes();
    const keys = indexes.map((i) => JSON.stringify(i.key));
    expect(keys).toContain('{"organization":1,"createdAt":-1}');
  });
});
