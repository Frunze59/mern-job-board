// import { ForbiddenError } from '../errors/index.js';

/**
 * Role gate for org-scoped routes. Compose after resolveOrg.
 *
 *   router.post('/', requireRole('owner', 'recruiter'), createJob);
 *
 * The permission question changes in v2. In v1 it was "is this record yours?"
 * (checkPermissions on createdBy). In v2 it is two questions asked in order:
 *   1. is the record in my active org?   (controllers filter by req.org.orgId)
 *   2. does my role in that org allow this action?   (this middleware)
 * createdBy is kept only as an audit trail of who added the job.
 *
 * TODO: return (req, res, next) => roles.includes(req.org?.role) ? next()
 *       : throw new ForbiddenError('Your role does not allow this action')
 */
const requireRole = (...roles) => (req, res, next) => {
  next();
};

export default requireRole;
