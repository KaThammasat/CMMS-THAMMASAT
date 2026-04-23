/**
 * Preventive Maintenance (PM) Routes
 */
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/v1/pm
router.get('/', async (req,res) => {
  try {
    const { equipment_id, is_active, due_within_days } = req.query;
    const conds = ['1=1'], vals = [];
    if (equipment_id) { vals.push(equipment_id); conds.push(`p.equipment_id=$${vals.length}`); }
    if (is_active !== undefined) { vals.push(is_active !== 'false'); conds.push(`p.is_active=$${vals.length}`); }
    if (due_within_days) { vals.push(parseInt(due_within_days)); conds.push(`p.next_due_date <= NOW() + INTERVAL '1 day' * $${vals.length}`); }
    const { rows } = await pool.query(
      `SELECT p.*,e.name as equipment_name,e.asset_code,e.location_id,
        l.name as location_name,
        CASE WHEN p.next_due_date < NOW() THEN 'overdue'
             WHEN p.next_due_date < NOW()+INTERVAL '7 days' THEN 'due_soon'
             ELSE 'ok' END as due_status,
        EXTRACT(DAY FROM p.next_due_date - NOW())::int as days_until_due
       FROM pm_schedules p
       JOIN equipment e ON e.id=p.equipment_id
       LEFT JOIN locations l ON l.id=e.location_id
       WHERE ${conds.join(' AND ')}
       ORDER BY p.next_due_date ASC`,
      vals
    );
    // Stats
    const overdue = rows.filter(r=>r.due_status==='overdue').length;
    const dueSoon = rows.filter(r=>r.due_status==='due_soon').length;
    res.json({ success:true, data:rows, stats:{ total:rows.length, overdue, due_soon:dueSoon, ok:rows.length-overdue-dueSoon } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /api/v1/pm/:id
router.get('/:id', async (req,res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,e.name as equipment_name,e.asset_code FROM pm_schedules p JOIN equipment e ON e.id=p.equipment_id WHERE p.id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success:false, error:'PM schedule not found' });
    res.json({ success:true, data:rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST /api/v1/pm
router.post('/', [
  body('equipment_id').isUUID(),
  body('name').isString().notEmpty(),
  body('frequency_days').isInt({ min:1 }),
  body('estimated_hours').optional().isFloat({ min:0.5 }),
], async (req,res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const { equipment_id, name, description, frequency_days, estimated_hours, checklist, next_due_date } = req.body;
    const dueDate = next_due_date || new Date(Date.now() + frequency_days * 86400000).toISOString();
    const { rows } = await pool.query(
      `INSERT INTO pm_schedules(equipment_id,name,description,frequency_days,estimated_hours,checklist,next_due_date,is_active)
       VALUES($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING *`,
      [equipment_id, name, description||null, frequency_days, estimated_hours||null, JSON.stringify(checklist||[]), dueDate]
    );
    res.status(201).json({ success:true, data:rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// PATCH /api/v1/pm/:id
router.patch('/:id', async (req,res) => {
  try {
    const allowed = ['name','description','frequency_days','estimated_hours','checklist','next_due_date','is_active'];
    const sets = [], vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        vals.push(k === 'checklist' ? JSON.stringify(req.body[k]) : req.body[k]);
        sets.push(`${k}=$${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ success:false, error:'No fields to update' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE pm_schedules SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals
    );
    if (!rows[0]) return res.status(404).json({ success:false, error:'PM schedule not found' });
    res.json({ success:true, data:rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST /api/v1/pm/:id/complete — ทำ PM เสร็จ
router.post('/:id/complete', [
  body('actual_hours').isFloat({ min:0.1 }),
  body('notes').optional().isString(),
], async (req,res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const { actual_hours, notes, completed_by } = req.body;
    const { rows: pm } = await pool.query('SELECT * FROM pm_schedules WHERE id=$1', [req.params.id]);
    if (!pm[0]) return res.status(404).json({ success:false, error:'PM schedule not found' });

    const nextDue = new Date(Date.now() + pm[0].frequency_days * 86400000).toISOString();
    const { rows: updated } = await pool.query(
      `UPDATE pm_schedules SET last_completed_at=NOW(), next_due_date=$1, last_completed_by=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [nextDue, completed_by || req.user.id, req.params.id]
    );

    // สร้าง Work Order บันทึกการทำ PM
    const { rows: wo } = await pool.query(
      `INSERT INTO work_orders(equipment_id,type,priority,title,description,status,actual_hours,completed_at,assigned_to)
       VALUES($1,'preventive','low',$2,$3,'completed',$4,NOW(),$5)
       RETURNING wo_number`,
      [pm[0].equipment_id, `PM: ${pm[0].name}`, notes||`Preventive maintenance completed. Next due: ${nextDue.slice(0,10)}`, actual_hours, req.user.id]
    );

    res.json({ success:true, data:{ ...updated[0], work_order: wo[0]?.wo_number, next_due_date:nextDue } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// DELETE /api/v1/pm/:id (soft delete)
router.delete('/:id', async (req,res) => {
  try {
    const { rowCount } = await pool.query('UPDATE pm_schedules SET is_active=FALSE WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success:false, error:'PM schedule not found' });
    res.json({ success:true, message:'PM schedule deactivated' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
