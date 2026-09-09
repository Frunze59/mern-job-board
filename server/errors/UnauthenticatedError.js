import { StatusCodes } from 'http-status-codes';
import CustomAPIError from './CustomAPIError.js';

// 401
class UnauthenticatedError extends CustomAPIError {
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.UNAUTHORIZED;
  }
}

export default UnauthenticatedError;
