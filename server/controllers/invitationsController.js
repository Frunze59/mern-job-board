import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import Invitation from '../models/Invitation.js';
import Membership from '../models/Membership.js';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import { publicOrg } from './orgsController.js';
import {
  BadRequestError,
  CustomAPIError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
} from '../errors/index.js';

/** 410: the link was real but is no longer usable. */
class GoneError extends CustomAPIError {
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.GONE;
  }
}

/**
 * These routes are NOT behind authenticateUser: a brand-new invitee has no
 * token yet. The handlers read the Authorization header themselves.
 *
 * A malformed or expired JWT is still an error rather than "anonymous", so a
 * signed-in user with a stale session is told to sign in again instead of
 * silently being offered the create-an-account branch.
 */
const optionalUserId = (req) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.split(' ')[1], process.env.JWT_SECRET).userId;
  } catch {
    throw new UnauthenticatedError('Authentication invalid');
  }
};

/**
 * Find a usable invitation, or explain why it is not.
 * 404 unknown, 410 expired / already accepted / org gone.
 */
const loadUsableInvitation = async (rawToken) => {
  const invitation = await Invitation.findByToken(rawToken);
  if (!invitation) {
    throw new NotFoundError('This invitation does not exist');
  }
  if (invitation.status !== 'pending') {
    throw new GoneError('This invitation has already been used');
  }
  if (invitation.isExpired()) {
    throw new GoneError('This invitation has expired');
  }
  const org = await Organization.findById(invitation.organization);
  if (!org) {
    throw new GoneError('The organization for this invitation no longer exists');
  }
  return { invitation, org };
};

/**
 * Join the org and spend the token, in that order.
 *
 * If the process died between the two writes, the membership exists while the
 * invitation is still pending; accepting again upserts the same membership
 * and consumes the token, so the invitee is never locked out.
 */
const joinOrganization = async (invitation, userId) => {
  await Membership.updateOne(
    { user: userId, organization: invitation.organization },
    { $setOnInsert: { role: invitation.role } },
    { upsert: true }
  ).catch((error) => {
    // A duplicate means a concurrent accept won the race: already a member.
    if (error?.code !== 11000) throw error;
  });

  invitation.status = 'accepted';
  await invitation.save();
};

/**
 * GET /api/v1/invitations/:token
 * 200 -> { email, role, orgName, expiresAt } so the accept page can render
 * 404 unknown | 410 expired or used
 */
export const getInvitation = async (req, res) => {
  const { invitation, org } = await loadUsableInvitation(req.params.token);

  res.status(StatusCodes.OK).json({
    email: invitation.email,
    role: invitation.role,
    orgName: org.name,
    expiresAt: invitation.expiresAt,
  });
};

/**
 * POST /api/v1/invitations/:token/accept
 *
 * Signed in      -> email must match the invitation, else 403. 200 { org, role }
 * Not signed in  -> { password, name? } creates the account.  201 { user, token, org, role }
 *                   If that email is already registered: 403, sign in first.
 *
 * See ADR-003 for why an existing account is sent to the sign-in page rather
 * than being allowed to supply its password here.
 */
export const acceptInvitation = async (req, res) => {
  const { invitation, org } = await loadUsableInvitation(req.params.token);
  const signedInUserId = optionalUserId(req);

  if (signedInUserId) {
    const user = await User.findById(signedInUserId);
    if (!user) {
      throw new UnauthenticatedError('Authentication invalid');
    }
    if (user.email !== invitation.email) {
      throw new ForbiddenError(
        `This invitation was sent to ${invitation.email}. Sign in as that user to accept it.`
      );
    }

    await joinOrganization(invitation, user._id);
    return res.status(StatusCodes.OK).json({
      org: publicOrg(org, invitation.role),
      role: invitation.role,
    });
  }

  const existing = await User.findOne({ email: invitation.email }, { _id: 1 }).lean();
  if (existing) {
    throw new ForbiddenError(
      'An account with this email already exists. Please sign in, then open this link again.'
    );
  }

  const { password, name } = req.body;
  if (!password) {
    throw new BadRequestError('Please provide a password to create your account');
  }

  const user = await User.create({
    // A name is not worth blocking the invite on; the part before @ is a
    // reasonable default and the user can be renamed later.
    name: name?.trim() || invitation.email.split('@')[0],
    email: invitation.email,
    password,
  });

  try {
    // Invited users are registering too, so they get a Personal org like
    // everyone else. Without it they would have no org of their own.
    await Organization.ensurePersonalFor(user._id);
    await joinOrganization(invitation, user._id);
  } catch (error) {
    // Undo the half-made account rather than leave one that cannot sign in
    // anywhere useful. The invitation is left pending so the link still works.
    await Membership.deleteMany({ user: user._id }).catch(() => {});
    await Organization.deleteOne({ personalFor: user._id }).catch(() => {});
    await User.deleteOne({ _id: user._id }).catch(() => {});
    throw error;
  }

  return res.status(StatusCodes.CREATED).json({
    user: { name: user.name, email: user.email },
    token: user.createJWT(),
    org: publicOrg(org, invitation.role),
    role: invitation.role,
  });
};
