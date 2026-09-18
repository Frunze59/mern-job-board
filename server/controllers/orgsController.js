import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import Organization from '../models/Organization.js';
import Membership, { ROLES } from '../models/Membership.js';
import Invitation from '../models/Invitation.js';
import User from '../models/User.js';
import { BadRequestError, ForbiddenError } from '../errors/index.js';

/**
 * These routes name the organization in the URL, so they cannot use the
 * X-Org-Id middleware. Each one checks membership itself, through
 * requireMembership below.
 */

/** Public shape of an organization for the caller who belongs to it. */
export const publicOrg = (org, role) => ({
  _id: org._id,
  name: org.name,
  slug: org.slug,
  role,
  isPersonal: Boolean(org.personalFor),
});

/**
 * Load the caller's membership in :orgId, or refuse.
 *
 * A non-member and a non-existent org get the same 403, so the endpoint
 * cannot be used to discover which organization ids exist.
 */
const requireMembership = async (userId, orgId, allowedRoles = ROLES) => {
  if (!mongoose.isObjectIdOrHexString(orgId)) {
    throw new BadRequestError('Invalid organization id');
  }
  const membership = await Membership.findOne({ user: userId, organization: orgId }).lean();
  if (!membership) {
    throw new ForbiddenError('You are not a member of this organization');
  }
  if (!allowedRoles.includes(membership.role)) {
    throw new ForbiddenError('Your role does not allow this action');
  }
  return membership;
};

/**
 * GET /api/v1/orgs
 * 200 -> { orgs: [{ _id, name, slug, role, isPersonal }] }
 * Personal org first, then the rest by name. Feeds the client's org switcher.
 */
export const getMyOrgs = async (req, res) => {
  const memberships = await Membership.find({ user: req.user.userId })
    .populate('organization')
    .lean();

  const orgs = memberships
    // An org deleted out from under a membership would populate as null.
    .filter((membership) => membership.organization)
    .map((membership) => publicOrg(membership.organization, membership.role))
    .sort((a, b) => {
      if (a.isPersonal !== b.isPersonal) return a.isPersonal ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  res.status(StatusCodes.OK).json({ orgs });
};

/**
 * POST /api/v1/orgs   body: { name }
 * 201 -> { org }
 *
 * Not in the brief's route table, but an agency has to come from somewhere:
 * inviting colleagues into a "Personal" org would be the wrong shape.
 */
export const createOrg = async (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    throw new BadRequestError('Please provide an organization name');
  }

  const org = await Organization.createWithUniqueSlug(String(name).trim());

  try {
    await Membership.create({
      user: req.user.userId,
      organization: org._id,
      role: 'owner',
    });
  } catch (error) {
    // Without a membership the org would exist but be reachable by nobody.
    await Organization.deleteOne({ _id: org._id }).catch(() => {});
    throw error;
  }

  res.status(StatusCodes.CREATED).json({ org: publicOrg(org, 'owner') });
};

/**
 * GET /api/v1/orgs/:orgId/members   (any member)
 * 200 -> { members: [{ userId, name, email, role, joinedAt }] }
 */
export const getMembers = async (req, res) => {
  const { orgId } = req.params;
  await requireMembership(req.user.userId, orgId);

  const memberships = await Membership.find({ organization: orgId })
    .populate('user', 'name email')
    .sort({ createdAt: 1 })
    .lean();

  const members = memberships
    .filter((membership) => membership.user)
    .map((membership) => ({
      userId: membership.user._id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      joinedAt: membership.createdAt,
    }));

  res.status(StatusCodes.OK).json({ members });
};

/**
 * Where the invite link points. CLIENT_URL wins; otherwise the request's own
 * origin, which is right in production because the API serves the client.
 * The Host header is caller-controlled, but the URL is only ever returned to
 * that same caller, never stored or sent elsewhere.
 */
const inviteBaseUrl = (req) =>
  (process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

/**
 * POST /api/v1/orgs/:orgId/invitations   body: { email, role }   (owner only)
 * 201 -> { invitation: { email, role, expiresAt }, inviteUrl }
 *
 * The raw token appears in this response and nowhere else; only its hash is
 * stored. Re-inviting the same address replaces any pending invitation, so a
 * lost link can be reissued and only the newest token ever works.
 */
export const createInvitation = async (req, res) => {
  const { orgId } = req.params;
  await requireMembership(req.user.userId, orgId, ['owner']);

  const { email, role } = req.body;
  if (!email || !role) {
    throw new BadRequestError('Please provide an email and a role');
  }
  if (!ROLES.includes(role)) {
    throw new BadRequestError(`${role} is not a supported role`);
  }

  const normalisedEmail = String(email).trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalisedEmail }, { _id: 1 }).lean();
  if (existingUser) {
    const alreadyMember = await Membership.exists({
      user: existingUser._id,
      organization: orgId,
    });
    if (alreadyMember) {
      throw new BadRequestError('That person is already a member of this organization');
    }
  }

  // Supersede any outstanding invitation for this address.
  await Invitation.deleteMany({ organization: orgId, email: normalisedEmail, status: 'pending' });

  const { invitation, rawToken } = await Invitation.issue({
    organization: orgId,
    email: normalisedEmail,
    role,
    invitedBy: req.user.userId,
  });

  res.status(StatusCodes.CREATED).json({
    invitation: {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
    inviteUrl: `${inviteBaseUrl(req)}/invitations/${rawToken}`,
  });
};
