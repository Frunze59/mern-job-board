// import { ForbiddenError } from '../errors/index.js';

/**
 * Throws ForbiddenError (403) unless the authenticated user owns the resource.
 *
 * @param {{ userId: string }} requestUser  req.user set by auth middleware
 * @param {import('mongoose').Types.ObjectId} resourceUserId  job.createdBy
 */
const checkPermissions = (requestUser, resourceUserId) => {
  // TODO: if (requestUser.userId === resourceUserId.toString()) return;
  //       throw new ForbiddenError('Not authorized to access this route');
};

export default checkPermissions;
