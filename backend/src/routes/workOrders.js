'use strict';
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /
router.get('/', async (req, res) => {
  try {
    const { status, type, priority, assigned_to, equipment_id, page=1, limit=50 } = req.query;
    const offset=(parseInt(page)-1)*parseInt(limit);
    const conds=[], params=[];
    let i=1;
    if (status) { conds.push(`wo.status=$${i++}`); params.push(status); }
    if (type) { conds.push(`wo.type=$${i++}`); params.push(type); }
    if (priority) { conds.push(`wo.priority=$${i++}`); params.push(priority); }
    if (assigned_to) { conds.push(`wo.assigned_to=$${i++}`); params.push(assigned_to); }
    if (equipment_id) { conds.push(`wo.equipment_id=$${i++}`); params.push(equipment_id); }
    const where = conds.length ? 'WHERE '+conds.join(' AND ') : '';
    const [r, cnt] = await Promise.all([
      query(`SELECT wo.*,e.name as equipment_name,e.asset_code,l.name as location_name,
                    u.first_name||' '||u.last_name as assigned_to_name
             FROM work_orders wo
             LEFT JOIN equipment e ON e.id=wo.equipment_id
             LEFT JOIN locations l ON l.id=e.location_id
             LEFT JOIN users u ON u.id=wo.assigned_to
             ${where} ORDER BY CASE wo.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, wo.created_at DESC
             LIMIT $${i} OFFSET $${i+1}`, [...params,parseInt(limit),offset]),
      query(`SELECT COUNT(*) FROM work_orders wo ${where}`, params)
    ]);
    res.json({ success:true, data:r.rows, pagination:{ total:+cnt.rows[0].count, page:+page, limit:+limit, pages:Math.ceil(cnt.rows[0].count/parseInt(limit)) } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const [woR,taskR,partsR] = await Promise.all([
      query(`SELECT wo.*,e.name as equipment_name,e.asset_code,e.type as equipment_type,
                    l.name as location_name,u.first_name||' '||u.last_name as assigned_to_name,
                    u.email as assigned_email, u.phone as assigned_phone
             FROM work_orders wo
             LEFT JOIN equipment e ON e.id=wo.equipment_id
             LEFT JOIN locations l ON l.id=e.location_id
             LEFT JOIN users u ON u.id=wo.assigned_to
             WHERE wo.id=$1`, [req.params.id]),
      query(`SELECT * FROM wo_tasks WHERE work_order_id=$1 ORDER BY task_order`, [req.params.id]),
      query(`SELECT wop.*,sp.name as part_name,sp.part_number FROM wo_parts_used wop LEFT JOIN spare_parts sp ON sp.id=wop.spare_part_id WHERE wop.work_order_id=$1`, [req.params.id]),
    ]);
    if (!woR.rows[0]) return res.status(404).json({ success:false, error:'Work order not found' });
    res.json({ success:true, data:{ ...woR.rows[0], tasks:taskR.rows, parts_used:partsR.rows } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST /
router.post('/', authorize('admin','manager','technician'), [
  body('equipment_id').isUUID(),
  body('type').isIn(['corrective','preventive','predictive','inspection','project']),
  body('priority').isIn(['critical','high','medium','low']),
  body('title').notEmpty().trim(),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const { equipment_id,type,priority,title,description,estimated_hours,assigned_to } = req.body;
    const slaHours = { critical:4, high:8, medium:24, low:72 };
    const sla_due_at = new Date(Date.now()+slaHours[priority]*3600000);
    const year=new Date().getFullYear(), ts=Date.now().toString().slice(-6);
    const wo_number = `WO-${year}-${ts}`;
    const r = await query(
      `INSERT INTO work_orders (wo_number,equipment_id,type,priority,title,description,estimated_hours,assigned_to,sla_due_at,requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [wo_number,equipment_id,type,priority,title,description||null,estimated_hours||null,assigned_to||null,sla_due_at,req.user.id]
    );
    res.status(201).json({ success:true, data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// PATCH /:id - full update (title, description, priority, assigned_to, estimated_hours)
router.patch('/:id', authorize('admin','manager','technician'), async (req, res) => {
  try {
    const allowed=['title','description','priority','assigned_to','estimated_hours','type'];
    const sets=[], vals=[];
    for (const k of allowed) {
      if (req.body[k]!==undefined) { vals.push(req.body[k]); sets.push(`${k}=$${vals.length}`); }
    }
    // Recalculate SLA if priority changed
    if (req.body.priority) {
      const slaHours={critical:4,high:8,medium:24,low:72};
      vals.push(new Date(Date.now()+slaHours[req.body.priority]*3600000));
      sets.push(`sla_due_at=$${vals.length}`);
    }
    if (!sets.length) return res.status(400).json({ success:false, error:'No valid fields to update' });
    vals.push(req.params.id);
    const r = await query(`UPDATE work_orders SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ success:false, error:'Work order not found' });
    res.json({ success:true, data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// PATCH /:id/status
router.patch('/:id/status', authorize('admin','manager','technician'), [
  body('status').isIn(['open','in_progress','on_hold','loto_prep','completed','closed','cancelled']),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const { status, notes, actual_hours } = req.body;
    const sets=['status=$1'], vals=[status];
    if (notes) { vals.push(notes); sets.push(`notes=$${vals.length}`); }
    if (actual_hours!==undefined) { vals.push(actual_hours); sets.push(`actual_hours=$${vals.length}`); }
    if (['completed','closed'].includes(status)) { sets.push(`completed_at=NOW()`); }
    vals.push(req.params.id);
    const r = await query(`UPDATE work_orders SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ success:false, error:'Work order not found' });
    res.json({ success:true, data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// PATCH /:id/assign
router.patch('/:id/assign', authorize('admin','manager'), async (req, res) => {
  try {
    const r = await query(`UPDATE work_orders SET assigned_to=$1,updated_at=NOW() WHERE id=$2 RETURNING *`, [req.body.user_id||null,req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ success:false, error:'Work order not found' });
    res.json({ success:true, data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// DELETE /:id
router.delete('/:id', authorize('admin','manager'), async (req, res) => {
  try {
    const r = await query(`DELETE FROM work_orders WHERE id=$1 AND status IN ('open','cancelled') RETURNING id,wo_number`, [req.params.id]);
    if (!r.rows[0]) return res.status(409).json({ success:false, error:'Can only delete open or cancelled work orders' });
    res.json({ success:true, message:'Work order deleted', data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
