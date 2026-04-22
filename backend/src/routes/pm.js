/**
 * PM (Preventive Maintenance) Routes
 */
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/v1/pm — list all PM schedules
router.get('/', async (req, res) => {
  try {
    const { equipment_id, due_within_days, is_active } = req.query;
    const conds = ['1=1'], vals = [];
    if (equipment_id) { vals.push(equipment_id); conds.push(`p.equipment_id=$${vals.length}`); }
    if (is_active !== undefined) { vals.push(is_active !== 'false'); conds.push(`p.is_active=$${vals.length}`); }
    if (due_within_days) {
      vals.push(parseInt(due_within_days));
      conds.push(`p.next_due_date <= CURRENT_DATE + ($${vals.length} || ' days')::INTERVAL`);
    }
    const { rows } = await pool.query(
      `SELECT p.*,e.name as equipment_name,e.asset_code,e.criticality,
              CASE WHEN p.next_due_date < CURRENT_DATE THEN 'overdue'
                   WHEN p.next_due_date <= CURRENT_DATE+7 THEN 'due_soon'
                   ELSE 'ok' END as status
       FROM pm_schedules p JOIN equipment e ON e.id=p.equipment_id
       WHERE ${conds.join(' AND ')} ORDER BY p.next_due_date ASC NULLS LAST`, vals
    );
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /api/v1/pm/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,e.name as equipment_name,e.asset_code FROM pm_schedules p JOIN equipment e ON e.id=p.equipment_id WHERE p.id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success:false, error:'PM schedule not found' });
    res.json({ success:true, data:rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST /api/v1/pm — create PM schedule
router.post('/', authorize('admin','manager'), [
  body('equipment_id').isString().notEmpty(),
  body('name').trim().isLength({ min:2, max:150 }),
  body('frequency_type').isIn(['daily','weekly','monthly','quarterly','yearly','hours']),
  body('frequency_value').isInt({ min:1 }),
  body('estimated_hours').optional().isFloat({ min:0 }),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const { equipment_id, name, description, frequency_type, frequency_value, estimated_hours, tasks, next_due_date } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO pm_schedules(equipment_id,name,description,frequency_type,frequency_value,estimated_hours,tasks,next_due_date)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [equipment_id, name, description||null, frequency_type, frequency_value,
       estimated_hours||null, JSON.stringify(tasks||[]),
       next_due_date||null]
    );
    res.status(201).json({ success:true, data:rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// PATCH /api/v1/pm/:id
router.patch('/:id', authorize('admin','manager'), async (req, res) => {
  try {
    const allowed = ['name','description','frequency_type','frequency_value','estimated_hours','tasks','next_due_date','is_active'];
    const sets = [], vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        vals.push(k === 'tasks' ? JSON.stringify(req.body[k]) : req.body[k]);
        sets.push(`${k}=$${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ success:false, error:'No fields to update' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE pm_schedules SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals
    );
    if (!rows[0]) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, data:rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST /api/v1/pm/:id/complete — mark done + auto-schedule next + create WO
router.post('/:id/complete', authorize('admin','manager','technician'), [
  body('completed_date').optional().isDate(),
  body('notes').optional().isString(),
  body('actual_hours').optional().isFloat({ min:0 }),
], async (req, res) => {
  try {
    const { rows: [pm] } = await pool.query('SELECT * FROM pm_schedules WHERE id=$1', [req.params.id]);
    if (!pm) return res.status(404).json({ success:false, error:'PM schedule not found' });

    const completedDate = req.body.completed_date || new Date().toISOString().slice(0,10);
    // Calculate next due date
    const next = new Date(completedDate);
    const fv = pm.frequency_value;
    const ft = pm.frequency_type;
    if (ft==='daily') next.setDate(next.getDate()+fv);
    else if (ft==='weekly') next.setDate(next.getDate()+fv*7);
    else if (ft==='monthly') next.setMonth(next.getMonth()+fv);
    else if (ft==='quarterly') next.setMonth(next.getMonth()+fv*3);
    else if (ft==='yearly') next.setFullYear(next.getFullYear()+fv);
    else next.setDate(next.getDate()+30);

    const nextDue = next.toISOString().slice(0,10);
    await pool.query(
      `UPDATE pm_schedules SET last_done_date=$1,next_due_date=$2 WHERE id=$3`,
      [completedDate, nextDue, pm.id]
    );

    // Create completion WO
    const { rows: wo } = await pool.query(
      `SELECT wo_number FROM work_orders ORDER BY created_at DESC LIMIT 1`
    );
    const lastNum = wo[0]?.wo_number ? parseInt(wo[0].wo_number.split('-').pop()) : 0;
    const woNum = `WO-${new Date().getFullYear()}-${String(lastNum+1).padStart(6,'0')}`;
    await pool.query(
      `INSERT INTO work_orders(wo_number,equipment_id,type,status,priority,title,description,created_by,actual_hours,completed_at,is_auto_generated)
       VALUES($1,$2,'preventive','completed','low',$3,$4,$5,$6,NOW(),TRUE)`,
      [woNum, pm.equipment_id, `PM Completed: ${pm.name}`,
       req.body.notes||`PM schedule completed. Next due: ${nextDue}`,
       req.user.id, req.body.actual_hours||pm.estimated_hours]
    );

    res.json({ success:true, data:{ pm_id:pm.id, completed_date:completedDate, next_due_date:nextDue, wo_number:woNum } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// DELETE /api/v1/pm/:id (soft delete)
router.delete('/:id', authorize('admin','manager'), async (req, res) => {
  try {
    const { rows } = await pool.query('UPDATE pm_schedules SET is_active=FALSE WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, message:'PM schedule deactivated' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
