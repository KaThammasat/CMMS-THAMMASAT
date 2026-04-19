/**
 * CMMS THAMMASAT INDUSTRIAL v5.0
 * Railway-compatible: HTTP server starts immediately, DB connects async
 */
'use strict';

const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
dotenv.config();

const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '5000');

// DB state
let dbReady = false;

// ─── Socket.IO ────────────────────────────────────────────────
const io = new SocketIO(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET','POST'], credentials: true },
  pingTimeout: 60000
});
app.set('io', io);

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 500,
  message: { success: false, error: 'Too many requests' } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  if (req.path !== '/health') logger.info(`${req.method} ${req.path}`);
  next();
});

// ─── Health (always responds, even before DB ready) ───────────
app.get('/health', async (req, res) => {
  if (!dbReady) {
    return res.status(200).json({ success: true, status: 'starting', version: '5.0.0',
      db: 'connecting', uptime: Math.round(process.uptime()) });
  }
  const { pool } = require('./config/database');
  try {
    const r = await pool.query('SELECT NOW() as t');
    res.json({ success: true, status: 'healthy', version: '5.0.0',
      db: 'connected', time: r.rows[0].t, uptime: Math.round(process.uptime()) });
  } catch (e) {
    res.status(200).json({ success: true, status: 'degraded', db: 'error', error: e.message });
  }
});

app.get('/', (req, res) => res.json({
  success: true, message: '🏭 CMMS Thammasat Industrial API v5.0',
  health: '/health', api: '/api/v1', status: dbReady ? 'ready' : 'starting'
}));

// ─── DB-dependent middleware (returns 503 until DB ready) ─────
app.use('/api/', (req, res, next) => {
  if (!dbReady) return res.status(503).json({ success: false, error: 'Service starting, please retry in a few seconds' });
  next();
});

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/v1/auth',        require('./routes/auth'));
app.use('/api/v1/equipment',   require('./routes/equipment'));
app.use('/api/v1/work-orders', require('./routes/workOrders'));
app.use('/api/v1/downtime',    require('./routes/downtime'));
app.use('/api/v1/inventory',   require('./routes/inventory'));
app.use('/api/v1/reports',     require('./routes/reports'));
app.use('/api/v1/loto',        require('./routes/loto'));
app.use('/api/v1/alerts',      require('./routes/alerts'));
app.use('/api/v1/kpi',         require('./routes/kpi'));

app.use((req, res) => res.status(404).json({ success: false, error: `${req.originalUrl} not found` }));
app.use((err, req, res, _next) => {
  logger.error('Error:', err.message);
  res.status(err.status || 500).json({ success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

// ─── Start HTTP immediately ───────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 CMMS v5.0 listening on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
  // Connect DB async after server is up
  connectDatabaseAsync();
});

async function connectDatabaseAsync() {
  const { connectDB } = require('./config/database');
  let retries = 10;
  while (retries > 0) {
    try {
      await connectDB();
      logger.info('✅ Database connected');
      dbReady = true;

      // Init socket + schedulers
      const { initSocketIO, startSchedulers } = require('./services/socketService');
      initSocketIO(io);
      startSchedulers(io);
      logger.info('⏰ Schedulers started');

      // Auto-migrate schema
      try {
        const { migrate } = require('./utils/migrate');
        await migrate();
      } catch (e) {
        logger.warn('Migration skipped:', e.message);
      }
      return;
    } catch (err) {
      retries--;
      logger.warn(`DB retry ${10 - retries}/10: ${err.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  logger.error('Failed to connect DB after 10 retries — running without DB');
}

process.on('SIGTERM', () => { logger.info('SIGTERM: shutdown'); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { logger.info('SIGINT: shutdown');  server.close(() => process.exit(0)); });

module.exports = { app, server, io };
