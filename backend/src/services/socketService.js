/**
 * Socket.IO Real-time Service
 */
'use strict';

const logger = require('../utils/logger');

let io;

function initSocketIO(socketIO) {
  io = socketIO;

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Join user-specific room
    socket.on('auth', (data) => {
      if (data?.userId) {
        socket.join(`user:${data.userId}`);
        socket.join(`site:${data.siteId || 'all'}`);
        logger.debug(`Socket ${socket.id} joined rooms for user ${data.userId}`);
      }
    });

    // Join equipment room for live sensor data
    socket.on('subscribe:equipment', (equipmentId) => {
      socket.join(`equipment:${equipmentId}`);
    });

    socket.on('unsubscribe:equipment', (equipmentId) => {
      socket.leave(`equipment:${equipmentId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function emitAlert(severity, title, message, data = {}) {
  if (!io) return;
  io.emit('alert:new', {
    severity,
    title,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

function emitToEquipment(equipmentId, event, data) {
  if (!io) return;
  io.to(`equipment:${equipmentId}`).emit(event, data);
}

// exports merged at bottom

// ─────────────────────────────────────────────────────────────────
/**
 * Scheduler Service - Cron jobs for CMMS automation
 */
// scheduler-service.js content embedded here for simplicity
const cron = require('node-cron');
const { query } = require('../config/database');

function startSchedulers(socketIO) {
  // ─── SLA Breach Check (every 5 minutes) ───────────────────────
  cron.schedule('*/5 * * * *', async () => { if (!global.dbReady) return;
    try {
      // Find WOs approaching SLA breach (within 1 hour)
      const approaching = await query(
        `SELECT wo.*, e.name as equipment_name, e.asset_code
         FROM work_orders wo JOIN equipment e ON wo.equipment_id = e.id
         WHERE wo.status NOT IN ('completed','closed','cancelled')
           AND wo.sla_due_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
           AND wo.sla_breach_notified = FALSE`
      );

      for (const wo of approaching.rows) {
        const hoursLeft = (new Date(wo.sla_due_at) - Date.now()) / (1000 * 60 * 60);
        socketIO?.emit('alert:sla_warning', {
          woNumber: wo.wo_number,
          title: wo.title,
          equipment: wo.equipment_name,
          hoursRemaining: Math.round(hoursLeft * 10) / 10,
          severity: hoursLeft < 0.5 ? 'critical' : 'high'
        });

        await query(
          `UPDATE work_orders SET sla_breach_notified = TRUE WHERE id = $1`, [wo.id]
        );

        await query(
          `INSERT INTO alerts (equipment_id, work_order_id, type, severity, title, message)
           VALUES ($1, $2, 'sla_breach', $3, $4, $5)`,
          [wo.equipment_id, wo.id, hoursLeft < 0.5 ? 'critical' : 'high',
           `SLA Warning: ${wo.wo_number}`,
           `Work order ${wo.wo_number} for ${wo.equipment_name} will breach SLA in ${Math.round(hoursLeft * 60)} minutes`]
        );
      }

      // Mark actually breached WOs
      await query(
        `UPDATE work_orders SET sla_breached = TRUE
         WHERE status NOT IN ('completed','closed','cancelled')
           AND sla_due_at < NOW() AND sla_breached = FALSE`
      );

      if (approaching.rows.length > 0) {
        logger.info(`SLA check: ${approaching.rows.length} WOs approaching breach`);
      }
    } catch (err) {
      logger.error('SLA check error:', err);
    }
  });

  // ─── Inventory Low Stock Check (every hour) ────────────────────
  cron.schedule('0 * * * *', async () => { if (!global.dbReady) return;
    try {
      const lowStock = await query(
        `SELECT * FROM spare_parts
         WHERE quantity_on_hand <= reorder_point AND reorder_point > 0`
      );

      for (const part of lowStock.rows) {
        socketIO?.emit('alert:low_stock', {
          partNumber: part.part_number,
          name: part.name,
          onHand: part.quantity_on_hand,
          reorderPoint: part.reorder_point
        });
      }

      if (lowStock.rows.length > 0) {
        logger.info(`Inventory check: ${lowStock.rows.length} parts below reorder point`);
      }
    } catch (err) {
      logger.error('Inventory check error:', err);
    }
  });

  // ─── PM Due Check (daily at 6 AM) ─────────────────────────────
  cron.schedule('0 6 * * *', async () => { if (!global.dbReady) return;
    try {
      const duePMs = await query(
        `SELECT pm.*, e.name as equipment_name, e.asset_code
         FROM pm_schedules pm JOIN equipment e ON pm.equipment_id = e.id
         WHERE pm.is_active = TRUE AND pm.next_due_date <= CURRENT_DATE + INTERVAL '3 days'`
      );

      for (const pm of duePMs.rows) {
        socketIO?.emit('alert:pm_due', {
          equipment: pm.equipment_name,
          assetCode: pm.asset_code,
          pmName: pm.name,
          dueDate: pm.next_due_date
        });
      }

      logger.info(`PM check: ${duePMs.rows.length} PMs due within 3 days`);
    } catch (err) {
      logger.error('PM check error:', err);
    }
  });

  // ─── Simulated Sensor Data (dev only, every 30 seconds) ───────
  if (process.env.NODE_ENV !== 'production') {
    cron.schedule('*/30 * * * * *', async () => { if (!global.dbReady) return;
      try {
        const equipment = await query(
          `SELECT id FROM equipment WHERE is_active = TRUE LIMIT 6`
        );

        for (const eq of equipment.rows) {
          const sensorData = {
            equipmentId: eq.id,
            temperature: 45 + Math.random() * 30,
            vibration: 0.5 + Math.random() * 4,
            pressure: 6 + Math.random() * 5,
            current_amps: 15 + Math.random() * 10,
            rpm: 1400 + Math.random() * 200,
            timestamp: new Date().toISOString()
          };

          socketIO?.to(`equipment:${eq.id}`).emit('sensor:reading', sensorData);
        }
      } catch (err) {
        // Ignore in dev
      }
    });
  }

  logger.info('✅ All schedulers started');
}

module.exports = { initSocketIO, emitAlert, emitToEquipment, startSchedulers };
