/**
 * Work Orders Routes
 * Full lifecycle management with SLA tracking
 */
'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, withTransaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { emitAlert } = require('../services/socketService');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

// SLA hours by criticality
const SLA_HOURS = { critical: 4, high: 8, medium: 24, low: 72 };

// ─── GET /work-orders ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, type, priority, assigned_to, equipment_id, sla_breached, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = [];
    let params = [];
    let i = 1;

    if (status) { conditions.push(`wo.status = ANY($${i++}::work_order_status[])`); params.push(status.split(',')); }
    if (type) { conditions.push(`wo.type = $${i++}`); params.push(type); }
    if (priority) { conditions.push(`wo.priority = $${i++}`); params.push(priority); }
    if (assigned_to) { conditions.push(`wo.assigned_to = $${i++}`); params.push(assigned_to); }
    if (equipment_id) { conditions.push(`wo.equipment_id = $${i++}`); params.push(equipment_id); }
    if (sla_breached === 'true') { conditions.push(`wo.sla_breached = TRUE`); }

    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM work_orders wo ${whereClause}`, params
    );

    const result = await query(
      `SELECT wo.*,
              e.name as equipment_name, e.asset_code, e.criticality as equipment_criticality,
              l.name as location_name,
              u1.first_name || ' ' || u1.last_name as created_by_name,
              u2.first_name || ' ' || u2.last_name as assigned_to_name,
              EXTRACT(EPOCH FROM (wo.sla_due_at - NOW())) / 3600 as sla_hours_remaining,
              CASE WHEN wo.sla_due_at < NOW() AND wo.status NOT IN ('completed','closed','cancelled') 
                   THEN TRUE ELSE FALSE END as is_sla_breached_now
       FROM work_orders wo
       JOIN equipment e ON wo.equipment_id = e.id
       JOIN locations l ON e.location_id = l.id
       LEFT JOIN users u1 ON wo.created_by = u1.id
       LEFT JOIN users u2 ON wo.assigned_to = u2.id
       ${whereClause}
       ORDER BY 
         CASE wo.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         wo.sla_due_at ASC NULLS LAST
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
    logger.error('Work orders list error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch work orders' });
  }
});

// ─── GET /work-orders/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT wo.*,
              e.name as equipment_name, e.asset_code, e.type as equipment_type,
              e.manufacturer, e.model, e.cost_per_minute,
              l.name as location_name, z.name as zone_name, s.name as site_name,
              u1.first_name || ' ' || u1.last_name as created_by_name,
              u2.first_name || ' ' || u2.last_name as assigned_to_name,
              u3.first_name || ' ' || u3.last_name as approved_by_name,
              (SELECT json_agg(t ORDER BY t.sequence) FROM wo_tasks t WHERE t.work_order_id = wo.id) as tasks,
              (SELECT json_agg(row_to_json(p)) FROM (
                SELECT wpu.*, sp.name as part_name, sp.part_number 
                FROM wo_parts_used wpu JOIN spare_parts sp ON wpu.spare_part_id = sp.id
                WHERE wpu.work_order_id = wo.id
              ) p) as parts_used,
              (SELECT json_agg(row_to_json(lb)) FROM (
                SELECT wl.*, u.first_name || ' ' || u.last_name as technician_name
                FROM wo_labor wl JOIN users u ON wl.user_id = u.id
                WHERE wl.work_order_id = wo.id
              ) lb) as labor_records
       FROM work_orders wo
       JOIN equipment e ON wo.equipment_id = e.id
       JOIN locations l ON e.location_id = l.id
       JOIN zones z ON l.zone_id = z.id
       JOIN sites s ON z.site_id = s.id
       LEFT JOIN users u1 ON wo.created_by = u1.id
       LEFT JOIN users u2 ON wo.assigned_to = u2.id
       LEFT JOIN users u3 ON wo.approved_by = u3.id
       WHERE wo.id = $1`,
      [req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Work order not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch work order' });
  }
});

// ─── POST /work-orders ─────────────────────────────────────────
router.post('/', authorize('admin', 'manager', 'technician'), [
  body('equipment_id').isUUID(),
  body('type').isIn(['corrective','preventive','predictive','inspection','project']),
  body('priority').isIn(['critical','high','medium','low']),
  body('title').notEmpty().trim().isLength({ max: 255 }),
  body('description').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { equipment_id, type, priority, title, description, assigned_to, estimated_hours, tasks } = req.body;

    // Generate WO number
    const seqResult = await query("SELECT NEXTVAL('wo_sequence') as seq");
    const woNumber = `WO-${new Date().getFullYear()}-${String(seqResult.rows[0].seq).padStart(6, '0')}`;

    const slaHours = SLA_HOURS[priority] || 24;
    const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const result = await withTransaction(async (client) => {
      const woResult = await client.query(
        `INSERT INTO work_orders (
          wo_number, equipment_id, type, status, priority, title, description,
          created_by, assigned_to, sla_due_at, opened_at, estimated_hours
        ) VALUES ($1,$2,$3,'open',$4,$5,$6,$7,$8,$9,NOW(),$10)
        RETURNING *`,
        [woNumber, equipment_id, type, priority, title, description,
         req.user.id, assigned_to || null, slaDueAt, estimated_hours || null]
      );

      const wo = woResult.rows[0];

      // Add tasks if provided
      if (tasks && tasks.length > 0) {
        for (let i = 0; i < tasks.length; i++) {
          await client.query(
            `INSERT INTO wo_tasks (work_order_id, sequence, description) VALUES ($1,$2,$3)`,
            [wo.id, i + 1, tasks[i]]
          );
        }
      }

      return wo;
    });

    const io = req.app.get('io');
    io?.emit('workOrder:created', {
      id: result.id,
      wo_number: result.wo_number,
      title: result.title,
      priority: result.priority,
      equipment_id: result.equipment_id
    });

    logger.info(`Work order created: ${result.wo_number} by ${req.user.email}`);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    logger.error('Create work order error:', err);
    res.status(500).json({ success: false, error: 'Failed to create work order' });
  }
});

// ─── PATCH /work-orders/:id/status ────────────────────────────
router.patch('/:id/status', authorize('admin', 'manager', 'technician'), [
  body('status').isIn(['open','assigned','in_progress','pending_approval','loto_prep','loto_executed','completed','closed','cancelled']),
  body('notes').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { status, notes, actual_hours, root_cause, corrective_action } = req.body;

    // Status timestamp fields
    const timestamps = {
      assigned: 'assigned_at = NOW()',
      in_progress: 'started_at = NOW()',
      completed: 'completed_at = NOW()',
      closed: 'closed_at = NOW()'
    };

    let extra = '';
    if (timestamps[status]) extra += `, ${timestamps[status]}`;
    if (actual_hours) extra += `, actual_hours = ${parseFloat(actual_hours)}`;
    if (root_cause) extra += `, root_cause = '${root_cause.replace(/'/g, "''")}'`;
    if (corrective_action) extra += `, corrective_action = '${corrective_action.replace(/'/g, "''")}'`;

    const result = await query(
      `UPDATE work_orders SET status = $1 ${extra}, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Work order not found' });
    }

    const io = req.app.get('io');
    io?.emit('workOrder:statusChanged', {
      id: result.rows[0].id,
      wo_number: result.rows[0].wo_number,
      status,
      priority: result.rows[0].priority
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update work order status' });
  }
});

// ─── PATCH /work-orders/:id/assign ────────────────────────────
router.patch('/:id/assign', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { technician_id } = req.body;
    if (!technician_id) {
      return res.status(400).json({ success: false, error: 'Technician ID required' });
    }

    const result = await query(
      `UPDATE work_orders SET assigned_to = $1, status = 'assigned', assigned_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [technician_id, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Work order not found' });
    }

    const io = req.app.get('io');
    io?.to(`user:${technician_id}`).emit('workOrder:assigned', result.rows[0]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to assign work order' });
  }
});

module.exports = router;
