import mongoose from 'mongoose';
import Membership from '../models/Membership.js';
import Organization from '../models/Organization.js';
import { BadRequestError, ForbiddenError } from '../errors/index.js';

/**
 * Establishes the active organization for this request.
 *
 * Runs after authenticateUser. Reads the X-Org-Id header; when it is absent or
 * blank, falls back to the user's Personal org, so v1 clients keep working
 * unchanged.
 *
 * The header is never trusted on its own: the user must hold a Membership in
 * that org. The role is read fresh on every request, so a role change or a
 * removal takes effect immediately, with no need to reissue the JWT.
 *
 * Sets req.org = { orgId, role }.
 */
const resolveOrg = async (req, res, next) => {
  const { userId } = req.user;
  const requested = req.get('X-Org-Id')?.trim();

  let membership;

  if (requested) {
    if (!mongoose.isObjectIdOrHexString(requested)) {
      throw new BadRequestError('X-Org-Id must be a valid organization id');
    }
    membership = await Membership.findOne(
      { user: userId, organization: requested },
      { organization: 1, role: 1 }
    ).lean();
    // Same answer for "no such org" and "not your org", so the header cannot
    // be used to discover which organization ids exist.
    if (!membership) {
      throw new ForbiddenError('You are not a member of this organization');
    }
  } else {
    const personal = await Organization.findOne({ personalFor: userId }, { _id: 1 }).lean();
    membership =
      personal &&
      (await Membership.findOne(
        { user: userId, organization: personal._id },
        { organization: 1, role: 1 }
      ).lean());
    if (!membership) {
      // Every account gets one at registration, and the migration backfills
      // older ones, so reaching this means the data is inconsistent.
      throw new ForbiddenError(
        'No Personal organization found for this account. Send X-Org-Id to choose one.'
      );
    }
  }

  req.org = { orgId: String(membership.organization), role: membership.role };
  next();
};

export default resolveOrg;
