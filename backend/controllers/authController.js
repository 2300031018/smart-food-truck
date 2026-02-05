const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const buildSuccess = (data) => ({ success: true, data });
const buildError = (message) => ({ success: false, error: { message } });

exports.signup = async (req, res) => {
  const { name, email, password } = req.body; // force customer role
  try {
    let existing = await User.findOne({ email });
    if (existing) return res.status(400).json(buildError('User already exists'));

    const user = new User({ name, email, password, role: 'customer' });
    await user.save();

  const payload = { user: { id: user._id, role: user.role, assignedTruck: user.assignedTruck || null } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json(buildSuccess({ token, user: { id: user._id, role: user.role, email: user.email, name: user.name, assignedTruck: user.assignedTruck } }));
  } catch (err) {
    console.error('Signup error:', err.message);
    return res.status(500).json(buildError('Server error'));
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const start = Date.now();
  try {
    if (!email || !password) {
      return res.status(422).json(buildError('email and password required'));
    }
    const user = await User.findOne({ email }).select('+password');
    console.info(`[AUTH][LOGIN] lookup email=${email} found=${!!user}`);
    if (!user) {
      console.warn(`[AUTH][LOGIN] user not found email=${email}`);
      return res.status(400).json(buildError('Invalid credentials'));
    }
    if (!user.isActive) {
      console.warn(`[AUTH][LOGIN] inactive user email=${email}`);
      return res.status(403).json(buildError('User inactive'));
    }
    const hasPassword = !!user.password;
    if (!hasPassword) {
      console.error(`[AUTH][LOGIN] missing password hash user=${user._id}`);
      return res.status(500).json(buildError('Account misconfigured'));
    }
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
      console.info(`[AUTH][LOGIN] compare result user=${user._id} match=${isMatch}`);
    } catch (cmpErr) {
      console.error('[AUTH][LOGIN] bcrypt compare failed:', cmpErr);
      return res.status(500).json(buildError('Password check failed'));
    }
    if (!isMatch) {
      console.warn(`[AUTH][LOGIN] bad password email=${email}`);
      return res.status(400).json(buildError('Invalid credentials'));
    }
    if (!process.env.JWT_SECRET) {
      console.error('[AUTH][LOGIN] JWT_SECRET missing');
      return res.status(500).json(buildError('Server config error'));
    }
    let token;
    try {
  const payload = { user: { id: user._id, role: user.role, assignedTruck: user.assignedTruck || null } };
      token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
      console.info(`[AUTH][LOGIN] jwt generated user=${user._id}`);
    } catch (jwtErr) {
      console.error('[AUTH][LOGIN] jwt sign failed:', jwtErr);
      return res.status(500).json(buildError('Token generation failed'));
    }
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });
    const elapsed = Date.now() - start;
    console.info(`[AUTH][LOGIN] success user=${user._id} role=${user.role} in ${elapsed}ms`);
    return res.json(buildSuccess({ token, user: { id: user._id, role: user.role, email: user.email, name: user.name, assignedTruck: user.assignedTruck } }));
  } catch (err) {
    console.error('[AUTH][LOGIN] unexpected error:', err && err.stack ? err.stack : err);
    return res.status(500).json(buildError('Server error'));
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email role isActive createdAt');
    if (!user) return res.status(404).json(buildError('User not found'));
    return res.json(buildSuccess({ user }));
  } catch (err) {
    console.error('Me endpoint error:', err.message);
    return res.status(500).json(buildError('Server error'));
  }
};
