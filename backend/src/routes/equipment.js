/**
 * Equipment Routes - CRUD + Health + Predictions
 */
'use strict';

const express = require('express');
const { body, query: queryValidator, param, validationResult } = require('express-validator');
const { query, withTransaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { predictFailure } = require('../services/aiService');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

// ─── GET /equipment ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { site_id, type, criticality, status, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = ['e.is_active = TRUE'];
    let params = [];
    let i = 1;

    if (site_id) { conditions.push(`s.id = $${i++}`); params.push(site_id); }
    if (type) { conditions.push(`e.type = $${i++}`); params.push(type); }
    if (criticality) { conditions.push(`e.criticality = $${i++}`); params.push(criticality); }
    if (search) {
      conditions.push(`(e.name ILIKE $${i} OR e.asset_code ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM equipment e
       JOIN locations l ON e.location_id = l.id
       JOIN zones z ON l.zone_id = z.id
       JOIN sites s ON z.site_id = s.id ${whereClause}`,
      params
    );

    const result = await query(
      `SELECT e.*, 
              l.name as location_name, l.code as location_code,
              z.name as zone_name, s.name as site_name, s.id as site_id,
              (SELECT COUNT(*) FROM work_orders wo WHERE wo.equipment_id = e.id AND wo.status NOT IN ('completed','closed','cancelled')) as open_wo_count,
              (SELECT COUNT(*) FROM downtime_records dr WHERE dr.equipment_id = e.id AND dr.end_time IS NULL) as active_downtime,
              (SELECT risk_score FROM ai_predictions ap WHERE ap.equipment_id = e.id ORDER BY ap.predicted_at DESC LIMIT 1) as risk_score
       FROM equipment e
       JOIN locations l ON e.location_id = l.id
       JOIN zones z ON l.zone_id = z.id
       JOIN sites s ON z.site_id = s.id
       ${whereClause}
       ORDER BY e.criticality::text, e.name
       LIMIT $${i} OFFSET $${i+1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
      }
    });
  } catch (err) {
    logger.error('Equipment list error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch equipment' });
  }
});

// ─── GET /equipment/:id ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*,
              l.name as location_name, l.code as location_code,
              z.name as zone_name, z.id as zone_id,
              s.name as site_name, s.id as site_id,
              (SELECT json_agg(ap ORDER BY ap.predicted_at DESC) FROM ai_predictions ap WHERE ap.equipment_id = e.id LIMIT 3) as predictions,
              (SELECT json_agg(row_to_json(wo) ORDER BY wo.created_at DESC) FROM (
                SELECT wo_number, type, status, priority, title, created_at, sla_due_at
                FROM work_orders WHERE equipment_id = e.id ORDER BY created_at DESC LIMIT 5
              ) wo) as recent_work_orders,
              (SELECT json_agg(row_to_json(ps)) FROM pm_schedules ps WHERE ps.equipment_id = e.id AND ps.is_active = TRUE) as pm_schedules
       FROM equipment e
       JOIN locations l ON e.location_id = l.id
       JOIN zones z ON l.zone_id = z.id
       JOIN sites s ON z.site_id = s.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Equipment not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch equipment' });
  }
});

// ─── POST /equipment ───────────────────────────────────────────
router.post('/', authorize('admin', 'manager'), [
  body('asset_code').notEmpty().trim().withMessage('Asset code required'),
  body('name').notEmpty().trim().withMessage('Name required'),
  body('type').isIn(['cnc','pump','hvac','compressor','motor','conveyor','generator','boiler','crane','robot']),
  body('criticality').isIn(['critical','high','medium','low']),
  body('location_id').isUUID('all').withMessage('Valid location ID required'),
  body('cost_per_minute').optional().isFloat({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const {
      asset_code, name, type, criticality, location_id,
      manufacturer, model, serial_number, purchase_date, install_date,
      warranty_expiry, cost_per_minute, specifications
    } = req.body;

    const result = await query(
      `INSERT INTO equipment (
        asset_code, name, type, criticality, location_id,
        manufacturer, model, serial_number, purchase_date, install_date,
        warranty_expiry, cost_per_minute, specifications
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [asset_code, name, type, criticality, location_id,
       manufacturer, model, serial_number, purchase_date, install_date,
       warranty_expiry, cost_per_minute || 0, specifications ? JSON.stringify(specifications) : '{}']
    );

    const io = req.app.get('io');
    io?.emit('equipment:created', result.rows[0]);

    logger.info(`Equipment created: ${asset_code} by ${req.user.email}`);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Asset code already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create equipment' });
  }
});

// ─── PATCH /equipment/:id ──────────────────────────────────────
router.patch('/:id', authorize('admin', 'manager', 'technician'), async (req, res) => {
  try {
    const allowedFields = [
      'name','criticality','location_id','manufacturer','model',
      'cost_per_minute','health_score','next_maintenance_date','specifications','is_active'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
    const values = [req.params.id, ...Object.values(updates)];

    const result = await query(
      `UPDATE equipment SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      values
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Equipment not found' });
    }

    const io = req.app.get('io');
    io?.emit('equipment:updated', result.rows[0]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update equipment' });
  }
});

// ─── GET /equipment/:id/predict ───────────────────────────────
router.get('/:id/predict', async (req, res) => {
  try {
    const equipment = await query('SELECT * FROM equipment WHERE id = $1', [req.params.id]);
    if (!equipment.rows[0]) {
      return res.status(404).json({ success: false, error: 'Equipment not found' });
    }

    // Get latest sensor readings
    const sensors = await query(
      `SELECT * FROM sensor_readings WHERE equipment_id = $1 
       ORDER BY recorded_at DESC LIMIT 100`,
      [req.params.id]
    );

    const prediction = await predictFailure(equipment.rows[0], sensors.rows);

    // Save prediction
    await query(
      `INSERT INTO ai_predictions (equipment_id, risk_score, failure_probability, estimated_failure_date, 
        failure_mode, recommendation, confidence_level, input_features)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [req.params.id, prediction.riskScore, prediction.failureProbability,
       prediction.estimatedFailureDate, prediction.failureMode,
       prediction.recommendation, prediction.confidenceLevel,
       JSON.stringify(prediction.inputFeatures)]
    );

    res.json({ success: true, data: prediction });
  } catch (err) {
    logger.error('Prediction error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate prediction' });
  }
});

// ─── GET /equipment/:id/sensor-history ────────────────────────
router.get('/:id/sensor-history', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const result = await query(
      `SELECT * FROM sensor_readings 
       WHERE equipment_id = $1 AND recorded_at > NOW() - ($2 || ' hours')::INTERVAL
       ORDER BY recorded_at ASC`,
      [req.params.id, Math.min(parseInt(hours), 720)]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch sensor history' });
  }
});

module.exports = router;
