/**
 * Database Configuration
 * PostgreSQL with connection pooling
 */
'use strict';

const { Pool } = require('pg');
const logger = require('../utils/logger');

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cmms_thammasat',
  user: process.env.DB_USER || 'cmms_user',
  password: process.env.DB_PASSWORD || 'cmms_secure_password',
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error:', err);
});

pool.on('connect', () => {
  logger.debug('New DB connection established');
});

/**
 * Execute a query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    return result;
  } catch (err) {
    logger.error('Query error:', { text: text.substring(0, 100), error: err.message });
    throw err;
  }
}

/**
 * Get a client for transactions
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const release = client.release.bind(client);

  // Timeout safety
  const timeout = setTimeout(() => {
    logger.error('Client checked out for too long');
    client.release();
  }, 30000);

  client.release = () => {
    clearTimeout(timeout);
    release();
  };

  client.query = (text, params) => {
    return originalQuery(text, params);
  };

  return client;
}

/**
 * Run code in a transaction
 */
async function withTransaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function connectDB() {
  const client = await pool.connect();
  await client.query('SELECT NOW()');
  client.release();
  return pool;
}

module.exports = { pool, query, getClient, withTransaction, connectDB };
