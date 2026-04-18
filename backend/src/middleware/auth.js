/**
 * Authentication Middleware
 * JWT verification + RBAC
 */
'use strict';

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'cmms_jwt_secret_change_in_production_2024';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

/**
 * Generate access + refresh tokens
 */
function generateTokens(user) {
  const payload = {
    id: user.id,
    employeeId: user.employee_id,
    email: user.email,
    role: user.role,
    siteId: user.site_id
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  const refreshToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES });

  return { accessToken, refreshToken };
}

/**
 * Verify JWT middleware
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

/**
 * Role-based access control
 * Usage: authorize('admin', 'manager')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt: ${req.user.email} tried to access ${req.originalUrl} (role: ${req.user.role}, required: ${roles.join(',')})`);
      return res.status(403).json({
        success: false,
        error: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize, generateTokens, JWT_SECRET };
