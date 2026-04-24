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
    const { search, criticality, type, limit=50, page=1 } = req.query;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const conds=[], params=[];
    let i=1;
    if (search) { conds.push(`(e.name ILIKE $${i} OR e.asset_code ILIKE $${i} OR e.manufacturer ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (criticality) { conds.push(`e.criticality=$${i++}`); params.push(criticality); }
    if (type) { conds.push(`e.type=$${i++}`); params.push(type); }
    const where = conds.length ? 'WHERE '+conds.join(' AND ') : '';
    const r = await query(
      `SELECT e.*,l.name as location_name,l.id as location_id,
              (SELECT COUNT(*) FROM work_orders WHERE equipment_id=e.id AND status NOT IN ('completed','closed','cancelled')) as active_wo_count,
              (SELECT COUNT(*) FROM downtime_records WHERE equipment_id=e.id AND end_time IS NULL) as active_downtime_count,
              (SELECT risk_score FROM ai_predictions WHERE equipment_id=e.id ORDER BY ai_predictions.predicted_at DESC LIMIT 1) as risk_score
       FROM equipment e LEFT JOIN locations l ON l.id=e.location_id
       ${where} ORDER BY CASE e.criticality WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, e.asset_code ASC LIMIT $${i} OFFSET $${i+1}`,
      [...params,parseInt(limit),offset]
    );
    const cnt = await query(`SELECT COUNT(*) FROM equipment e ${where}`, params);
    res.json({ success:true, data:r.rows, pagination:{ total:+cnt.rows[0].count, page:+page, limit:+limit } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const [eqR,woR,dtR,predR] = await Promise.all([
      query(`SELECT e.*,l.name as location_name,l.id as location_id FROM equipment e LEFT JOIN locations l ON l.id=e.location_id WHERE e.id=$1`,[req.params.id]),
      query(`SELECT wo.*,u.first_name||' '||u.last_name as assigned_to_name FROM work_orders wo LEFT JOIN users u ON u.id=wo.assigned_to WHERE wo.equipment_id=$1 ORDER BY wo.created_at DESC LIMIT 10`,[req.params.id]),
      query(`SELECT * FROM downtime_records WHERE equipment_id=$1 ORDER BY start_time DESC LIMIT 5`,[req.params.id]),
      query(`SELECT * FROM ai_predictions WHERE equipment_id=$1 ORDER BY predicted_at DESC LIMIT 5`,[req.params.id]),
    ]);
    if (!eqR.rows[0]) return res.status(404).json({ success:false, error:'Equipment not found' });
    res.json({ success:true, data:{ ...eqR.rows[0], recent_work_orders:woR.rows, downtime_history:dtR.rows, predictions:predR.rows } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST /
router.post('/', authorize('admin','manager'), [
  body('asset_code').notEmpty().trim(),
  body('name').notEmpty().trim(),
  body('type').notEmpty(),
  body('criticality').isIn(['critical','high','medium','low']),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const { asset_code,name,type,criticality,manufacturer,model,serial_number,location_id,cost_per_minute=0,health_score=100,specifications={},install_date } = req.body;
    // Get default location if not provided
    let locId = location_id;
    if (!locId) { const lr=await query('SELECT id FROM locations LIMIT 1'); locId=lr.rows[0]?.id; }
    const r = await query(
      `INSERT INTO equipment (asset_code,name,type,criticality,manufacturer,model,serial_number,location_id,cost_per_minute,health_score,specifications,install_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [asset_code,name,type,criticality,manufacturer||null,model||null,serial_number||null,locId,cost_per_minute,health_score,JSON.stringify(specifications),install_date||null]
    );
    res.status(201).json({ success:true, data:r.rows[0] });
  } catch(e) {
    if (e.code==='23505') return res.status(409).json({ success:false, error:'Asset code already exists' });
    res.status(500).json({ success:false, error:e.message });
  }
});

// PATCH /:id
router.patch('/:id', authorize('admin','manager','technician'), async (req, res) => {
  try {
    const allowed=['name','type','criticality','manufacturer','model','serial_number','location_id','cost_per_minute','health_score','specifications','install_date','asset_code'];
    const sets=[], vals=[];
    for (const k of allowed) {
      if (req.body[k]!==undefined) {
        vals.push(k==='specifications'?JSON.stringify(req.body[k]):req.body[k]);
        sets.push(`${k}=$${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ success:false, error:'No valid fields' });
    vals.push(req.params.id);
    const r = await query(`UPDATE equipment SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ success:false, error:'Equipment not found' });
    res.json({ success:true, data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// DELETE /:id
router.delete('/:id', authorize('admin','manager'), async (req, res) => {
  try {
    // Check active work orders
    const woCheck = await query(`SELECT COUNT(*) FROM work_orders WHERE equipment_id=$1 AND status NOT IN ('completed','closed','cancelled')`, [req.params.id]);
    if (+woCheck.rows[0].count > 0) return res.status(409).json({ success:false, error:`Cannot delete: ${woCheck.rows[0].count} active work orders exist` });
    const r = await query('DELETE FROM equipment WHERE id=$1 RETURNING id,asset_code,name', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ success:false, error:'Equipment not found' });
    res.json({ success:true, message:`Deleted ${r.rows[0].name}`, data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /:id/predict
router.get('/:id/predict', async (req, res) => {
  try {
    const eqR = await query(`SELECT * FROM equipment WHERE id=$1`, [req.params.id]);
    if (!eqR.rows[0]) return res.status(404).json({ success:false, error:'Equipment not found' });
    const eq = eqR.rows[0];
    const healthScore = parseFloat(eq.health_score)||80;
    const riskScore = Math.round(Math.max(0,Math.min(100,(100-healthScore)*1.2+Math.random()*10)));
    const failureModes=['Bearing Wear / Imbalance','Mechanical Seal Failure','Electrical Fault','Lubrication Failure','Overheating'];
    const mode = failureModes[Math.floor(riskScore/25)%failureModes.length];
    const confidence = 55+Math.floor(Math.random()*30);
    const daysToFail = Math.max(3,Math.round((100-riskScore)*0.8));
    const failDate = new Date(Date.now()+daysToFail*86400000).toISOString().slice(0,10);
    const pred = await query(
      `INSERT INTO ai_predictions (equipment_id,risk_score,failure_mode,confidence,estimated_failure_date,recommendation)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING RETURNING *`,
      [eq.id,riskScore,mode,confidence,failDate,`${riskScore>70?'URGENT: Replace':'MONITOR: Inspect'} ${mode.split('/')[0].trim()} within ${daysToFail} days.`]
    );
    res.json({ success:true, data:{ risk_score:riskScore, failure_mode:mode, confidence, estimated_failure_date:failDate, recommendation:`${riskScore>70?'URGENT: Replace':'MONITOR: Inspect'} ${mode.split('/')[0].trim()} within ${daysToFail} days.` } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /:id/sensor-history
router.get('/:id/sensor-history', async (req, res) => {
  try {
    const r = await query(`SELECT * FROM sensor_readings WHERE equipment_id=$1 ORDER BY recorded_at DESC LIMIT 100`, [req.params.id]);
    res.json({ success:true, data:r.rows });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
