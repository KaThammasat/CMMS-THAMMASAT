/**
 * Database Configuration - Railway compatible
 * Supports both DATABASE_URL (Railway) and individual params
 */
'use strict';

const { Pool } = require('pg');
const logger = require('../utils/logger');

// Parse DATABASE_URL if provided (Railway injects this)
let poolConfig;
if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_URL.includes('railway.internal')
      ? false
      : process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'cmms_thammasat',
    user: process.env.DB_USER || 'cmms_user',
    password: process.env.DB_PASSWORD || 'cmms_secure_password',
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error:', err);
});

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

async function getClient() {
  const client = await pool.connect();
  const release = client.release.bind(client);
  const timeout = setTimeout(() => {
    logger.error('Client checked out for too long');
    client.release();
  }, 30000);
  client.release = () => { clearTimeout(timeout); release(); };
  return client;
}

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
  const result = await client.query('SELECT NOW() as now');
  logger.info(`DB connected: ${result.rows[0].now}`);
  client.release();
  return pool;
}

module.exports = { pool, query, getClient, withTransaction, connectDB };
