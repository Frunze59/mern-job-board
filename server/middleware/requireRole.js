import { ROLES } from '../models/Membership.js';
import { ForbiddenError } from '../errors/index.js';

/**
 * Role gate for org-scoped routes. Compose after resolveOrg.
 *
 *   router.post('/', requireRole('owner', 'recruiter'), createJob);
 *
 * v1 asked one question: "is this record yours?". v2 asks two:
 *   1. does my role in the active org allow this action?   (this middleware)
 *   2. is the record in my active org?   (controllers filter by req.org.orgId;
 *      a record anywhere else is a 404)
 *
 * The role is checked first, before any record is loaded, so a viewer gets
 * the same 403 for every write whether or not the id exists. The response
 * says nothing about which records are there.
 */
const requireRole = (...allowed) => {
  // Fail at startup, not at request time, if a route names a role that does
  // not exist. A typo here would otherwise lock everyone out silently.
  if (allowed.length === 0) {
    throw new Error('requireRole needs at least one role');
  }
  const unknown = allowed.filter((role) => !ROLES.includes(role));
  if (unknown.length > 0) {
    throw new Error(`requireRole got unknown role(s): ${unknown.join(', ')}`);
  }

  return (req, res, next) => {
    if (!req.org) {
      // A wiring mistake, not a client error: surfaces as a 500.
      throw new Error('requireRole must run after resolveOrg');
    }
    if (!allowed.includes(req.org.role)) {
      throw new ForbiddenError('Your role does not allow this action');
    }
    next();
  };
};

export default requireRole;
