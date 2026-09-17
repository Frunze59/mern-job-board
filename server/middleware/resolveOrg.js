// import mongoose from 'mongoose';
// import Membership from '../models/Membership.js';
// import Organization from '../models/Organization.js';
// import { ForbiddenError, BadRequestError } from '../errors/index.js';

/**
 * Establishes the active organization for this request.
 *
 * Runs after authenticateUser. Reads the X-Org-Id header; when it is absent,
 * falls back to the user's Personal org so v1 clients keep working unchanged.
 *
 * Sets req.org = { orgId, role } and never trusts the header on its own: the
 * user must actually hold a Membership in that org, otherwise 403.
 *
 * TODO:
 *  1. const header = req.headers['x-org-id']
 *  2. if header:
 *       - not a valid ObjectId -> BadRequestError
 *       - membership = Membership.findOne({ user: req.user.userId, organization: header })
 *       - none -> ForbiddenError('You are not a member of this organization')
 *  3. else:
 *       - org = Organization.findOne({ personalFor: req.user.userId })
 *       - membership = Membership.findOne({ user, organization: org._id })
 *       - none -> ForbiddenError (should not happen after migration; say so)
 *  4. req.org = { orgId: membership.organization.toString(), role: membership.role }
 *  5. next()
 */
const resolveOrg = async (req, res, next) => {
  // NOTE: until implemented, req.org is undefined and org-scoped routes will fail.
  next();
};

export default resolveOrg;
