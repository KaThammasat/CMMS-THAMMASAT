/**
 * CMMS THAMMASAT INDUSTRIAL - Main Server
 * Production-grade Express + Socket.io server
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
const { startSchedulers } = require('./services/schedulerService');

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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Make io accessible globally
app.set('io', io);
initSocketIO(io);

// ─── Security Middleware ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// ─── Rate Limiting ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Strict for auth
  message: { success: false, error: 'Too many login attempts.' }
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// ─── Body Parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logging ──────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const { pool } = require('./config/database');
  try {
    await pool.query('SELECT 1');
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '5.0.0',
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(503).json({ success: false, status: 'unhealthy', error: err.message });
  }
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

// Swagger docs
try {
  const swaggerUi = require('swagger-ui-express');
  const YAML = require('yamljs');
  const swaggerDoc = YAML.load('./docs/api.yaml');
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
} catch (e) {
  logger.warn('Swagger docs not loaded:', e.message);
}

// ─── Error Handlers ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` });
});

app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    logger.info('✅ Database connected');

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 CMMS Server running on port ${PORT}`);
      logger.info(`📊 API: http://localhost:${PORT}/api/v1`);
      logger.info(`📚 Docs: http://localhost:${PORT}/api/docs`);
    });

    startSchedulers(io);
    logger.info('⏰ Schedulers started');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = { app, server, io };
