/**
 * Downtime Routes - Track, close, cost calculation
 */
'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

// ─── GET /downtime ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { equipment_id, type, active_only, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = [];
    let params = [];
    let i = 1;

    if (equipment_id) { conditions.push(`dr.equipment_id = $${i++}`); params.push(equipment_id); }
    if (type) { conditions.push(`dr.type = $${i++}`); params.push(type); }
    if (active_only === 'true') { conditions.push(`dr.end_time IS NULL`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(
      `SELECT dr.*,
              e.name as equipment_name, e.asset_code, e.criticality,
              e.cost_per_minute,
              l.name as location_name,
              u.first_name || ' ' || u.last_name as reported_by_name,
              wo.wo_number,
              CASE WHEN dr.end_time IS NULL
                THEN EXTRACT(EPOCH FROM (NOW() - dr.start_time)) / 60
                ELSE dr.duration_minutes
              END as current_duration_minutes,
              CASE WHEN dr.end_time IS NULL
                THEN EXTRACT(EPOCH FROM (NOW() - dr.start_time)) / 60 * e.cost_per_minute
                ELSE dr.downtime_cost
              END as current_cost
       FROM downtime_records dr
       JOIN equipment e ON dr.equipment_id = e.id
       JOIN locations l ON e.location_id = l.id
       LEFT JOIN users u ON dr.reported_by = u.id
       LEFT JOIN work_orders wo ON dr.work_order_id = wo.id
       ${where}
       ORDER BY dr.start_time DESC
       LIMIT $${i} OFFSET $${i+1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Downtime list error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch downtime records' });
  }
});

// ─── POST /downtime (Start downtime) ───────────────────────────
router.post('/', [
  body('equipment_id').isUUID(),
  body('type').isIn(['breakdown','planned','setup','idle']),
  body('category').optional().isIn(['electrical','mechanical','hydraulic','pneumatic','software','operator','material','quality']),
  body('description').optional().trim(),
  body('start_time').optional().isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { equipment_id, type, category, description, start_time, lost_production_units } = req.body;

    // Check for already-active downtime on same equipment
    const existing = await query(
      `SELECT id FROM downtime_records WHERE equipment_id = $1 AND end_time IS NULL`,
      [equipment_id]
    );
    if (existing.rows.length > 0 && type === 'breakdown') {
      return res.status(409).json({
        success: false,
        error: 'Equipment already has an active downtime record',
        existing_id: existing.rows[0].id
      });
    }

    const result = await query(
      `INSERT INTO downtime_records
         (equipment_id, type, category, description, start_time, reported_by, lost_production_units)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [equipment_id, type, category || null, description || null,
       start_time ? new Date(start_time) : new Date(),
       req.user.id, lost_production_units || 0]
    );

    // Auto WO creation handled by DB trigger for breakdowns
    // Update equipment health score for breakdowns
    if (type === 'breakdown') {
      await query(
        `UPDATE equipment SET health_score = GREATEST(0, health_score - 5) WHERE id = $1`,
        [equipment_id]
      );

      const io = req.app.get('io');
      io?.emit('downtime:started', {
        id: result.rows[0].id,
        equipmentId: equipment_id,
        type,
        startTime: result.rows[0].start_time
      });
    }

    logger.info(`Downtime started: ${equipment_id} type=${type} by ${req.user.email}`);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Start downtime error:', err);
    res.status(500).json({ success: false, error: 'Failed to start downtime' });
  }
});

// ─── PATCH /downtime/:id/end ────────────────────────────────────
router.patch('/:id/end', [
  body('root_cause').optional().trim(),
  body('prevention_action').optional().trim()
], async (req, res) => {
  try {
    const { root_cause, prevention_action, end_time } = req.body;
    const endAt = end_time ? new Date(end_time) : new Date();

    const result = await query(
      `UPDATE downtime_records
       SET end_time = $1, root_cause = $2, prevention_action = $3, updated_at = NOW()
       WHERE id = $4 AND end_time IS NULL
       RETURNING *`,
      [endAt, root_cause || null, prevention_action || null, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Active downtime record not found' });
    }

    const dr = result.rows[0];

    // Restore some health score after repair
    if (dr.type === 'breakdown') {
      await query(
        `UPDATE equipment SET health_score = LEAST(100, health_score + 3) WHERE id = $1`,
        [dr.equipment_id]
      );
    }

    const io = req.app.get('io');
    io?.emit('downtime:ended', {
      id: dr.id,
      equipmentId: dr.equipment_id,
      durationMinutes: dr.duration_minutes,
      cost: dr.downtime_cost
    });

    logger.info(`Downtime ended: ${dr.id}, duration=${dr.duration_minutes}min, cost=${dr.downtime_cost}`);
    res.json({ success: true, data: dr });
  } catch (err) {
    logger.error('End downtime error:', err);
    res.status(500).json({ success: false, error: 'Failed to end downtime' });
  }
});

module.exports = router;
