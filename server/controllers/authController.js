import { StatusCodes } from 'http-status-codes';
// import User from '../models/User.js';
// import { BadRequestError, UnauthenticatedError } from '../errors/index.js';

/**
 * POST /api/v1/auth/register
 * body: { name, email, password }
 * 201 -> { user: { name, email }, token }
 * 400 -> missing fields / duplicate email
 */
export const register = async (req, res) => {
  // TODO:
  //  1. validate name, email, password are present (BadRequestError)
  //  2. check email is not already taken (BadRequestError)
  //  3. User.create(...) (password is hashed by the pre-save hook)
  //  4. token = user.createJWT()
  //  5. respond 201 with { user: { name, email }, token }
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'register not implemented' });
};

/**
 * POST /api/v1/auth/login
 * body: { email, password }
 * 200 -> { user: { name, email }, token }
 * 400 -> missing fields
 * 401 -> invalid credentials
 */
export const login = async (req, res) => {
  // TODO:
  //  1. validate email & password present (BadRequestError)
  //  2. find user by email (+password if select:false) -> UnauthenticatedError if none
  //  3. user.comparePassword(password) -> UnauthenticatedError if false
  //  4. token = user.createJWT()
  //  5. respond 200 with { user: { name, email }, token }
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'login not implemented' });
};
