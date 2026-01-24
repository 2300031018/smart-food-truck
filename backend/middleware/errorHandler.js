// Centralized error handler
module.exports = function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      message: err.message || 'Server Error',
      code: err.code || 'INTERNAL_ERROR'
    }
  };
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.error.stack = err.stack;
  }
  res.status(status).json(response);
};
