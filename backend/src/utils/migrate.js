'use strict';
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('./logger');

async function migrate() {
  try {
    const check = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='equipment') as exists"
    );
    if (check.rows[0].exists) {
      logger.info('DB schema already initialized');
      return;
    }
    logger.info('Running DB schema migration...');

    // Try multiple paths for schema.sql
    const candidates = [
      path.join(__dirname, '../../database/schema.sql'),   // inside Docker: /app/database/
      path.join(__dirname, '../../../database/schema.sql'), // local dev
    ];

    let schemaPath = candidates.find(p => fs.existsSync(p));
    if (!schemaPath) {
      logger.warn('schema.sql not found in: ' + candidates.join(', '));
      return;
    }

    logger.info('Loading schema from: ' + schemaPath);
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema in one shot (PostgreSQL handles it)
    await pool.query(schema);
    logger.info('✅ Schema migration complete');

    // Seed data
    const seedPath = schemaPath.replace('schema.sql', 'seed.sql');
    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf8');
      await pool.query(seed);
      logger.info('✅ Seed data loaded');
    }
  } catch (err) {
    logger.error('Migration error:', err.message);
  }
}

module.exports = { migrate };
