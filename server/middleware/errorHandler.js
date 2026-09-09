import { StatusCodes } from 'http-status-codes';

/**
 * Global error handler. Every error ends up here (thanks to express-async-errors)
 * and is returned as JSON: { msg: '...' }
 *
 * Express only recognises a middleware as an error handler if it declares four
 * parameters, so `next` must stay even though it is unused.
 */
// eslint-disable-next-line no-unused-vars
const errorHandlerMiddleware = (err, req, res, next) => {
  // Errors we raised on purpose (BadRequestError, NotFoundError, ...) already
  // carry the right status and a message that is safe to show the client.
  if (err.statusCode) {
    return res.status(err.statusCode).json({ msg: err.message });
  }

  // Mongoose schema validation: report every failing field at once.
  if (err.name === 'ValidationError') {
    const msg = Object.values(err.errors)
      .map((item) => item.message)
      .join(', ');
    return res.status(StatusCodes.BAD_REQUEST).json({ msg });
  }

  // Unique index violation, e.g. two users registering the same email at once.
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue ?? {}).join(', ') || 'field';
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ msg: `${fields} field has to be unique` });
  }

  // A malformed id in the URL, e.g. /api/v1/jobs/not-an-id. Treated as "no such
  // resource" rather than a server fault.
  if (err.name === 'CastError') {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ msg: `No item found with id ${err.value}` });
  }

  // Anything reaching this point is a bug or an outage. Log the detail for us,
  // and send the client a generic message so stack traces, driver internals and
  // connection strings are never exposed.
  console.error('Unhandled error:', err);
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ msg: 'Something went wrong, try again later' });
};

export default errorHandlerMiddleware;
