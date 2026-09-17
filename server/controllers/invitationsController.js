import { StatusCodes } from 'http-status-codes';
// import jwt from 'jsonwebtoken';
// import Invitation from '../models/Invitation.js';
// import Membership from '../models/Membership.js';
// import User from '../models/User.js';
// import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/index.js';

/**
 * GET /api/v1/invitations/:token
 * 200 -> { email, role, orgName, expiresAt }   (lets the accept page render)
 * 404 unknown, 410 expired or already used
 * TODO: hash the token, look it up, populate organization name.
 */
export const getInvitation = async (req, res) => {
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'getInvitation not implemented' });
};

/**
 * POST /api/v1/invitations/:token/accept
 *
 * One endpoint, two callers:
 *
 *  A. Signed in (Authorization header present)
 *     - verify JWT, load user
 *     - user.email !== invitation.email -> 403
 *     - create membership, mark invitation accepted
 *     - 200 { org, role }
 *
 *  B. Not signed in, body { password, name? }
 *     - if a user with invitation.email already exists -> 403
 *       'An account with this email exists, please sign in first'
 *       (we deliberately do NOT accept the password here; see ADR-003)
 *     - create user (name defaults to the part before @), create membership,
 *       mark accepted, sign a JWT
 *     - 201 { user, token, org, role }
 *
 *  Both: unknown token -> 404; status !== pending or expired -> 410 GONE.
 *
 *  Partial failure: if the membership exists but the invitation is still
 *  pending (a crash between the two writes), accept again succeeds and just
 *  consumes the token, so the user is never stuck. See ADR-002.
 *
 * TODO: implement A and B; write a helper `consume(invitation)`.
 */
export const acceptInvitation = async (req, res) => {
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'acceptInvitation not implemented' });
};
