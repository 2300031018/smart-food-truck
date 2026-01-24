const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const authHeader = req.header('Authorization');
  const token = authHeader ? authHeader.split(' ')[1] : null;
  if (!token) return res.status(401).json({ success: false, error: { message: 'No token, authorization denied' } });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // shape: { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: { message: 'Token is not valid' } });
  }
};
