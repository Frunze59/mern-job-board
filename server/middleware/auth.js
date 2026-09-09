import jwt from 'jsonwebtoken';
import { UnauthenticatedError } from '../errors/index.js';

/**
 * Verifies the Bearer JWT on protected routes and attaches req.user = { userId }.
 *
 * Expected header:  Authorization: Bearer <token>
 * On failure ->     401 { msg: 'Authentication invalid' }
 *
 * The message is deliberately the same for every failure mode (missing header,
 * malformed header, bad signature, expired token) so the endpoint gives away
 * nothing about why a token was rejected.
 */
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Authentication invalid');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Only the id is trusted downstream. Controllers use it for createdBy and
    // for ownership checks, so it must come from the verified token and never
    // from the request body.
    req.user = { userId: payload.userId };
    next();
  } catch {
    throw new UnauthenticatedError('Authentication invalid');
  }
};

export default authenticateUser;
