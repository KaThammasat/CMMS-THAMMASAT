/**
 * Auto-migration for Railway deployment
 * Runs schema on first deploy if tables don't exist
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('./logger');

async function migrate() {
  try {
    // Check if equipment table exists
    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'equipment'
      ) as exists
    `);

    if (check.rows[0].exists) {
      logger.info('DB schema already initialized, skipping migration');
      return;
    }

    logger.info('Running DB schema migration...');
    
    // Read and execute schema - split on $$ to handle functions
    const schemaPath = path.join(__dirname, '../../../database/schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      logger.warn('schema.sql not found, skipping auto-migration');
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute in chunks to handle complex SQL
    await pool.query(schema);
    logger.info('✅ Schema migration complete');

    // Run seed data
    const seedPath = path.join(__dirname, '../../../database/seed.sql');
    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf8');
      await pool.query(seed);
      logger.info('✅ Seed data loaded');
    }
  } catch (err) {
    logger.error('Migration error (non-fatal):', err.message);
  }
}

module.exports = { migrate };
