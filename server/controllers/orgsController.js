import { StatusCodes } from 'http-status-codes';
// import Organization from '../models/Organization.js';
// import Membership from '../models/Membership.js';
// import Invitation from '../models/Invitation.js';
// import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/index.js';

/**
 * GET /api/v1/orgs
 * 200 -> { orgs: [{ _id, name, slug, role, isPersonal }] }
 * The client's org switcher is built from this.
 * TODO: Membership.find({ user }).populate('organization') then map.
 */
export const getMyOrgs = async (req, res) => {
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'getMyOrgs not implemented' });
};

/**
 * POST /api/v1/orgs   body: { name }
 * 201 -> { org, role: 'owner' }
 * Not in the brief's route table, but an agency has to come from somewhere:
 * inviting people into a "Personal" org would be the wrong shape.
 * TODO: validate name, create org with unique slug, create owner membership.
 */
export const createOrg = async (req, res) => {
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'createOrg not implemented' });
};

/**
 * GET /api/v1/orgs/:orgId/members     (any member)
 * 200 -> { members: [{ userId, name, email, role }] }
 * TODO: assert caller is a member of :orgId, then Membership.find().populate('user','name email')
 */
export const getMembers = async (req, res) => {
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'getMembers not implemented' });
};

/**
 * POST /api/v1/orgs/:orgId/invitations   body: { email, role }   (owner only)
 * 201 -> { invitation: { email, role, expiresAt }, inviteUrl }
 *
 * Returns a full URL rather than a bare token so the owner can paste it into
 * any channel; there is no email sending in scope. Justified in ADR-003.
 *
 * TODO:
 *  1. caller must hold role 'owner' in :orgId (Membership lookup) else 403
 *  2. validate email + role in ROLES else 400
 *  3. if the email already has a Membership here -> 400 'already a member'
 *  4. { invitation, rawToken } = Invitation.issue({...})
 *  5. inviteUrl = `${process.env.CLIENT_URL || ''}/invitations/${rawToken}`
 */
export const createInvitation = async (req, res) => {
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'createInvitation not implemented' });
};
