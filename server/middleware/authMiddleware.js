const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

/**
 * Role-based authorization middleware.
 * Usage: authorize('Admin', 'Project Manager')
 * Admin always has access regardless of what roles are passed.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Admin has super access to everything
    if (req.user.role === 'Admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Your role (${req.user.role}) is not authorized to perform this action.`,
      });
    }

    next();
  };
};

/**
 * Check if user is Admin or the project owner/manager.
 * Used for project-level access control.
 */
const authorizeProjectAccess = (allowedRoles = []) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Admin always has access
    if (req.user.role === 'Admin') {
      return next();
    }

    // Check org role
    if (allowedRoles.length > 0 && allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      message: `Access denied. Your role (${req.user.role}) cannot perform this action.`,
    });
  };
};

module.exports = { protect, authorize, authorizeProjectAccess };
