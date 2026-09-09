// import jwt from 'jsonwebtoken';
// import { UnauthenticatedError } from '../errors/index.js';

/**
 * Verifies the Bearer JWT on protected routes and attaches req.user = { userId }.
 *
 * Expected header:  Authorization: Bearer <token>
 * On failure ->     401 { msg: 'Authentication invalid' }
 */
const authenticateUser = async (req, res, next) => {
  // TODO:
  //  1. read req.headers.authorization; must start with 'Bearer '
  //  2. token = header.split(' ')[1]
  //  3. payload = jwt.verify(token, process.env.JWT_SECRET)  (throws -> UnauthenticatedError)
  //  4. req.user = { userId: payload.userId }
  //  5. next()
  //
  // NOTE: until implemented, every request passes through unauthenticated.
  next();
};

export default authenticateUser;
