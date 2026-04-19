/**
 * Auth Routes - Login, Refresh, Profile
 */
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { generateTokens, authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// ─── POST /auth/login ──────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const result = await query(
      `SELECT u.*, s.name as site_name FROM users u 
       LEFT JOIN sites s ON u.site_id = s.id
       WHERE u.email = $1 AND u.is_active = TRUE`,
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // For demo: accept 'password123' for all seeded users
    let validPassword = false;
    try {
      validPassword = await bcrypt.compare(password, user.password_hash);
    } catch {
      // Demo mode: allow password123
      validPassword = password === 'password123';
    }

    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    logger.info(`User logged in: ${user.email} (${user.role})`);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          employeeId: user.employee_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          department: user.department,
          siteId: user.site_id,
          siteName: user.site_name,
          skills: user.skills || []
        }
      }
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ─── GET /auth/me ──────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.employee_id, u.email, u.first_name, u.last_name, 
              u.role, u.department, u.phone, u.skills, u.site_id,
              u.last_login, s.name as site_name
       FROM users u LEFT JOIN sites s ON u.site_id = s.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// ─── POST /auth/logout ─────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  try {
    await query('UPDATE users SET refresh_token_hash = NULL WHERE id = $1', [req.user.id]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

module.exports = router;
