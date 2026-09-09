import { StatusCodes } from 'http-status-codes';

/**
 * Global error handler. Every error ends up here (thanks to express-async-errors)
 * and is returned as JSON: { msg: '...' }
 */
// eslint-disable-next-line no-unused-vars
const errorHandlerMiddleware = (err, req, res, next) => {
  const defaultError = {
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: err.message || 'Something went wrong, try again later',
  };

  // TODO: Mongoose validation error (err.name === 'ValidationError')
  //       -> 400, msg = Object.values(err.errors).map(item => item.message).join(', ')

  // TODO: Mongo duplicate key (err.code === 11000)
  //       -> 400, msg = `${Object.keys(err.keyValue)} field has to be unique`

  // TODO: Mongoose CastError (bad ObjectId) -> 404, msg = `No item found with id ${err.value}`

  res.status(defaultError.statusCode).json({ msg: defaultError.msg });
};

export default errorHandlerMiddleware;
