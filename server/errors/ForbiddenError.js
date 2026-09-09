import { StatusCodes } from 'http-status-codes';
import CustomAPIError from './CustomAPIError.js';

// 403
class ForbiddenError extends CustomAPIError {
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.FORBIDDEN;
  }
}

export default ForbiddenError;
