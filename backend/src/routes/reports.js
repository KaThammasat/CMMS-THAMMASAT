/**
 * Reports Routes
 */
'use strict';
const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

router.get('/equipment-summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        e.criticality,
        COUNT(*) as total,
        ROUND(AVG(e.health_score)::numeric,1) as avg_health,
        COUNT(*) FILTER (WHERE e.health_score < 50) as critical_health,
        COUNT(DISTINCT dr.id) FILTER (WHERE dr.end_time IS NULL) as active_downtime,
        COUNT(DISTINCT wo.id) FILTER (WHERE wo.status NOT IN ('completed','closed','cancelled')) as open_wo
      FROM equipment e
      LEFT JOIN downtime_records dr ON dr.equipment_id = e.id AND dr.end_time IS NULL
      LEFT JOIN work_orders wo ON wo.equipment_id = e.id
      WHERE e.is_active = TRUE
      GROUP BY e.criticality
      ORDER BY CASE e.criticality WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

router.get('/cost-analysis', async (req, res) => {
  try {
    const { months = 3 } = req.query;
    const result = await query(`
      SELECT
        DATE_TRUNC('month', start_time) as month,
        SUM(downtime_cost) as downtime_cost,
        COUNT(*) FILTER (WHERE type = 'breakdown') as breakdowns,
        SUM(duration_minutes) FILTER (WHERE type = 'breakdown') as breakdown_minutes
      FROM downtime_records
      WHERE start_time > NOW() - ($1 || ' months')::INTERVAL
      GROUP BY DATE_TRUNC('month', start_time)
      ORDER BY month ASC`,
      [parseInt(months)]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate cost report' });
  }
});

module.exports = router;

// ─────────────────────────────────────────────────────────────
// Alerts Routes (separate file inlined for brevity)
// ─────────────────────────────────────────────────────────────
const alertRouter = express.Router();
alertRouter.use(authenticate);

alertRouter.get('/', async (req, res) => {
  try {
    const { unread_only, severity, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let conditions = [];
    let params = [];
    let i = 1;
    if (unread_only === 'true') conditions.push(`a.is_read = FALSE`);
    if (severity) { conditions.push(`a.severity = $${i++}`); params.push(severity); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(
      `SELECT a.*, e.name as equipment_name, e.asset_code, wo.wo_number
       FROM alerts a
       LEFT JOIN equipment e ON a.equipment_id = e.id
       LEFT JOIN work_orders wo ON a.work_order_id = wo.id
       ${where} ORDER BY a.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

alertRouter.patch('/:id/read', async (req, res) => {
  try {
    await query(`UPDATE alerts SET is_read = TRUE WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark alert read' });
  }
});

alertRouter.patch('/read-all', async (req, res) => {
  try {
    await query(`UPDATE alerts SET is_read = TRUE WHERE is_read = FALSE`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark all alerts read' });
  }
});

module.exports.alertRouter = alertRouter;
