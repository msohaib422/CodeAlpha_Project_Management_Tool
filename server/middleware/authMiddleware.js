const jwt = require('jsonwebtoken');
const User = require('../models/User');

const USER_MANAGEMENT_ADMIN_EMAIL = 'msohaib.ai.dev@gmail.com';

const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      if (req.user.status && req.user.status !== 'Approved') {
        return res.status(403).json({ message: 'Account not approved' });
      }

      const userTokenVersion = req.user.tokenVersion || 0;
      if (userTokenVersion > 0) {
        if (decoded.tokenVersion === undefined || decoded.tokenVersion !== userTokenVersion) {
          return res.status(401).json({ message: 'Session invalidated. Please log in again.' });
        }
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Not authorized as admin' });
};

const userManagementAdmin = (req, res, next) => {
  const email = String(req.user && req.user.email ? req.user.email : '')
    .trim()
    .toLowerCase();
  if (email && email === USER_MANAGEMENT_ADMIN_EMAIL) {
    return next();
  }
  return res.status(403).json({ message: 'Not authorized to manage users' });
};

module.exports = { protect, admin, userManagementAdmin, USER_MANAGEMENT_ADMIN_EMAIL };