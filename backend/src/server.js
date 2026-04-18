/**
 * CMMS THAMMASAT INDUSTRIAL v5.0 - Main Server
 * Production-ready Express + Socket.io server
 * Railway-compatible deployment
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
const { connectDB } = require('./config/database');
const { initSocketIO } = require('./services/socketService');
const { startSchedulers } = require('./services/socketService');

// Routes
const authRoutes = require('./routes/auth');
const equipmentRoutes = require('./routes/equipment');
const workOrderRoutes = require('./routes/workOrders');
const downtimeRoutes = require('./routes/downtime');
const inventoryRoutes = require('./routes/inventory');
const reportsRoutes = require('./routes/reports');
const lotoRoutes = require('./routes/loto');
const alertsRoutes = require('./routes/alerts');
const kpiRoutes = require('./routes/kpi');

const app = express();
const server = http.createServer(app);

// ─── Socket.IO ───────────────────────────────────────────────
const io = new SocketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.set('io', io);
initSocketIO(io);

// ─── Security Middleware ──────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// ─── Rate Limiting ────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false
}));

// ─── Body Parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logging ──────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/health') {
      logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const { pool } = require('./config/database');
  try {
    const result = await pool.query('SELECT NOW() as time');
    res.json({
      success: true,
      status: 'healthy',
      version: '5.0.0',
      timestamp: result.rows[0].time,
      uptime: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    res.status(503).json({ success: false, status: 'unhealthy', error: err.message });
  }
});

// ─── Root ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏭 CMMS Thammasat Industrial API v5.0',
    docs: '/api/docs',
    health: '/health',
    api: '/api/v1'
  });
});

// ─── API Routes ───────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/equipment`, equipmentRoutes);
app.use(`${API}/work-orders`, workOrderRoutes);
app.use(`${API}/downtime`, downtimeRoutes);
app.use(`${API}/inventory`, inventoryRoutes);
app.use(`${API}/reports`, reportsRoutes);
app.use(`${API}/loto`, lotoRoutes);
app.use(`${API}/alerts`, alertsRoutes);
app.use(`${API}/kpi`, kpiRoutes);

// ─── 404 & Error Handlers ────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` });
});

app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000');

async function start() {
  try {
    // Connect DB with retries
    let retries = 5;
    while (retries > 0) {
      try {
        await connectDB();
        logger.info('✅ Database connected');
        break;
      } catch (err) {
        retries--;
        logger.warn(`DB connection failed, retrying... (${retries} left): ${err.message}`);
        if (retries === 0) throw err;
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    // Auto-migrate schema if needed
    try {
      const { migrate } = require('./utils/migrate');
      await migrate();
    } catch (err) {
      logger.warn('Migration skipped:', err.message);
    }

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 CMMS Thammasat v5.0 running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      logger.info(`📊 API: http://localhost:${PORT}/api/v1`);
      logger.info(`❤️  Health: http://localhost:${PORT}/health`);
    });

    startSchedulers(io);
    logger.info('⏰ Schedulers started');

    process.on('SIGTERM', () => {
      logger.info('SIGTERM: shutting down gracefully...');
      server.close(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT: shutting down...');
      server.close(() => process.exit(0));
    });

  } catch (err) {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

module.exports = { app, server, io };
