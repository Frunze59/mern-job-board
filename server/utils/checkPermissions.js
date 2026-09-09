import { ForbiddenError } from '../errors/index.js';

/**
 * Throws ForbiddenError (403) unless the authenticated user owns the resource.
 *
 * @param {{ userId: string }} requestUser  req.user set by the auth middleware
 * @param {import('mongoose').Types.ObjectId} resourceUserId  job.createdBy
 */
const checkPermissions = (requestUser, resourceUserId) => {
  // req.user.userId is a string from the JWT payload; createdBy is an ObjectId.
  // Compare as strings so the types cannot silently mismatch.
  if (requestUser.userId === resourceUserId.toString()) return;
  throw new ForbiddenError('Not authorized to access this route');
};

export default checkPermissions;
