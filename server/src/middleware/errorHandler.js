function errorHandler(err, _req, res, _next) {
  console.error('[error]', err.message);
  if (err.stack) {
    console.error(err.stack);
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
}

module.exports = { errorHandler };
