/**
 * Base class for all operational (expected) errors.
 * Subclasses set `statusCode`; the global error handler turns it into { msg }.
 */
class CustomAPIError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export default CustomAPIError;
