import { StatusCodes } from 'http-status-codes';
import User from '../models/User.js';
import { BadRequestError, UnauthenticatedError } from '../errors/index.js';

/**
 * Shape the public view of a user. The password hash is never included, even
 * though a freshly created document still holds it in memory.
 */
const publicUser = (user) => ({ name: user.name, email: user.email });

/**
 * POST /api/v1/auth/register
 * body: { name, email, password }
 * 201 -> { user: { name, email }, token }
 * 400 -> missing fields / email already in use / schema validation
 */
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new BadRequestError('Please provide name, email and password');
  }

  // Friendly duplicate check. The unique index on email is still the real
  // guarantee: two concurrent registrations can both pass this check, and the
  // resulting 11000 error is translated to a 400 by the global error handler.
  const emailAlreadyExists = await User.findOne({ email });
  if (emailAlreadyExists) {
    throw new BadRequestError('Email already in use');
  }

  // The pre('save') hook hashes the password; never store req.body.password.
  const user = await User.create({ name, email, password });
  const token = user.createJWT();

  res.status(StatusCodes.CREATED).json({ user: publicUser(user), token });
};

/**
 * POST /api/v1/auth/login
 * body: { email, password }
 * 200 -> { user: { name, email }, token }
 * 400 -> missing fields
 * 401 -> invalid credentials
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError('Please provide email and password');
  }

  // password has select:false on the schema, so it must be requested explicitly.
  const user = await User.findOne({ email }).select('+password');

  // Same message and status for "no such user" and "wrong password" so the
  // endpoint cannot be used to discover which emails are registered.
  if (!user || !(await user.comparePassword(password))) {
    throw new UnauthenticatedError('Invalid credentials');
  }

  const token = user.createJWT();

  res.status(StatusCodes.OK).json({ user: publicUser(user), token });
};
