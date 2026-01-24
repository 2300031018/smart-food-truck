module.exports = function notFound(req, res, next) {
  res.status(404).json({ success: false, error: { message: 'Route Not Found', code: 'NOT_FOUND' } });
};
