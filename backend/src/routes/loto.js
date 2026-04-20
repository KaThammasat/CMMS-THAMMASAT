/**
 * LOTO (Lockout-Tagout) Routes
 * Enforces energy isolation safety procedure
 */
'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, withTransaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

// ─── GET /loto ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { equipment_id, status } = req.query;
    let conditions = [];
    let params = [];
    let i = 1;

    if (equipment_id) { conditions.push(`lp.equipment_id = $${i++}`); params.push(equipment_id); }
    if (status) { conditions.push(`lp.status = $${i++}`); params.push(status); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(
      `SELECT lp.*,
              e.name as equipment_name, e.asset_code,
              u1.first_name || ' ' || u1.last_name as initiated_by_name,
              u2.first_name || ' ' || u2.last_name as authorized_by_name,
              wo.wo_number
       FROM loto_procedures lp
       JOIN equipment e ON lp.equipment_id = e.id
       LEFT JOIN users u1 ON lp.initiated_by = u1.id
       LEFT JOIN users u2 ON lp.authorized_by = u2.id
       LEFT JOIN work_orders wo ON lp.work_order_id = wo.id
       ${where}
       ORDER BY lp.initiated_at DESC LIMIT 50`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch LOTO records' });
  }
});

// ─── POST /loto (Initiate LOTO) ────────────────────────────────
router.post('/', authorize('admin', 'manager', 'technician'), [
  body('equipment_id').isString().notEmpty(),
  body('work_order_id').optional().isString(),
  body('energy_sources').isArray({ min: 1 }).withMessage('At least one energy source required'),
  body('energy_sources.*.type').isIn(['electrical','hydraulic','pneumatic','thermal','gravitational','chemical']),
  body('energy_sources.*.location').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { equipment_id, work_order_id, energy_sources, notes } = req.body;

    // Check no active LOTO on this equipment
    const existing = await query(
      `SELECT id FROM loto_procedures WHERE equipment_id = $1 AND status NOT IN ('released')`,
      [equipment_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Active LOTO procedure already exists for this equipment'
      });
    }

    const procNum = `LOTO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Mark energy sources as not verified
    const sources = energy_sources.map(s => ({ ...s, verified: false, locked: false }));

    const result = await query(
      `INSERT INTO loto_procedures
         (equipment_id, work_order_id, procedure_number, status, energy_sources, initiated_by, notes)
       VALUES ($1,$2,$3,'pending',$4,$5,$6)
       RETURNING *`,
      [equipment_id, work_order_id || null, procNum, JSON.stringify(sources), req.user.id, notes || null]
    );

    // Update work order to loto_prep status
    if (work_order_id) {
      await query(
        `UPDATE work_orders SET status = 'loto_prep' WHERE id = $1`,
        [work_order_id]
      );
    }

    const io = req.app.get('io');
    io?.emit('loto:initiated', { equipmentId: equipment_id, procedureNumber: procNum });

    logger.info(`LOTO initiated: ${procNum} for equipment ${equipment_id} by ${req.user.email}`);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('LOTO initiate error:', err);
    res.status(500).json({ success: false, error: 'Failed to initiate LOTO' });
  }
});

// ─── PATCH /loto/:id/isolate ───────────────────────────────────
router.patch('/:id/isolate', authorize('admin', 'manager', 'technician'), async (req, res) => {
  try {
    const { source_index } = req.body; // which energy source to mark as locked

    const loto = await query(`SELECT * FROM loto_procedures WHERE id = $1`, [req.params.id]);
    if (!loto.rows[0]) return res.status(404).json({ success: false, error: 'LOTO not found' });

    const sources = loto.rows[0].energy_sources;
    if (source_index !== undefined && sources[source_index]) {
      sources[source_index].locked = true;
    }

    const allLocked = sources.every(s => s.locked);
    const newStatus = allLocked ? 'isolated' : 'isolating';

    const result = await query(
      `UPDATE loto_procedures SET energy_sources = $1, status = $2,
         isolated_at = CASE WHEN $2 = 'isolated' THEN NOW() ELSE isolated_at END
       WHERE id = $3 RETURNING *`,
      [JSON.stringify(sources), newStatus, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update isolation' });
  }
});

// ─── PATCH /loto/:id/verify ────────────────────────────────────
router.patch('/:id/verify', authorize('admin', 'manager', 'technician'), [
  body('verification_method').notEmpty().withMessage('Verification method required'),
  body('zero_energy_confirmed').isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { verification_method, zero_energy_confirmed, source_index } = req.body;

    const loto = await query(`SELECT * FROM loto_procedures WHERE id = $1`, [req.params.id]);
    if (!loto.rows[0]) return res.status(404).json({ success: false, error: 'LOTO not found' });

    if (loto.rows[0].status !== 'isolated') {
      return res.status(400).json({ success: false, error: 'Must complete isolation before verification' });
    }

    const sources = loto.rows[0].energy_sources;
    if (source_index !== undefined && sources[source_index]) {
      sources[source_index].verified = true;
    }

    const allVerified = sources.every(s => s.verified);

    const result = await query(
      `UPDATE loto_procedures
       SET energy_sources = $1, zero_energy_verified = $2, verification_method = $3,
           status = CASE WHEN $4 THEN 'verified' ELSE status END,
           verified_at = CASE WHEN $4 THEN NOW() ELSE verified_at END,
           authorized_by = $5
       WHERE id = $6 RETURNING *`,
      [JSON.stringify(sources), zero_energy_confirmed, verification_method, allVerified, req.user.id, req.params.id]
    );

    // Update WO to loto_executed if all verified
    if (allVerified && loto.rows[0].work_order_id) {
      await query(
        `UPDATE work_orders SET status = 'loto_executed' WHERE id = $1`,
        [loto.rows[0].work_order_id]
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to verify LOTO' });
  }
});

// ─── PATCH /loto/:id/release ───────────────────────────────────
router.patch('/:id/release', authorize('admin', 'manager'), async (req, res) => {
  try {
    const loto = await query(`SELECT * FROM loto_procedures WHERE id = $1`, [req.params.id]);
    if (!loto.rows[0]) return res.status(404).json({ success: false, error: 'LOTO not found' });

    if (!loto.rows[0].zero_energy_verified) {
      return res.status(400).json({
        success: false,
        error: 'Cannot release: zero energy state not verified'
      });
    }

    const result = await query(
      `UPDATE loto_procedures SET status = 'released', released_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    logger.info(`LOTO released: ${loto.rows[0].procedure_number} by ${req.user.email}`);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to release LOTO' });
  }
});

module.exports = router;
