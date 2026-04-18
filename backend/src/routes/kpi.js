/**
 * KPI Routes - MTTR, MTBF, OEE, Availability, Downtime Cost
 */
'use strict';

const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

// ─── GET /kpi/summary ─────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const { site_id, from, to, equipment_id } = req.query;
    const dateFrom = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = to || new Date().toISOString();

    let equipFilter = '';
    let params = [dateFrom, dateTo];
    if (equipment_id) { equipFilter = ` AND equipment_id = $3`; params.push(equipment_id); }

    // MTTR - Mean Time To Repair (avg hours to complete corrective WOs)
    const mttrResult = await query(
      `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - opened_at)) / 3600)::numeric, 2) as mttr_hours,
              COUNT(*) as completed_count
       FROM work_orders
       WHERE type = 'corrective' AND status = 'completed'
         AND completed_at BETWEEN $1 AND $2 ${equipFilter.replace('equipment_id', 'equipment_id')}`,
      params
    );

    // MTBF - Mean Time Between Failures
    const mtbfResult = await query(
      `WITH failures AS (
        SELECT equipment_id, start_time,
               LAG(end_time) OVER (PARTITION BY equipment_id ORDER BY start_time) as prev_end
        FROM downtime_records
        WHERE type = 'breakdown' AND start_time BETWEEN $1 AND $2
          AND end_time IS NOT NULL ${equipFilter}
      )
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (start_time - prev_end)) / 3600)::numeric, 2) as mtbf_hours,
             COUNT(*) as failure_count
      FROM failures WHERE prev_end IS NOT NULL`,
      params
    );

    // Total downtime & cost
    const downtimeResult = await query(
      `SELECT 
        COUNT(*) as total_incidents,
        ROUND(SUM(duration_minutes)::numeric, 0) as total_downtime_minutes,
        ROUND(SUM(downtime_cost)::numeric, 2) as total_downtime_cost,
        COUNT(*) FILTER (WHERE type = 'breakdown') as breakdown_count,
        COUNT(*) FILTER (WHERE type = 'planned') as planned_count,
        ROUND(AVG(duration_minutes)::numeric, 1) as avg_downtime_minutes
       FROM downtime_records
       WHERE start_time BETWEEN $1 AND $2 ${equipFilter}`,
      params
    );

    // Equipment availability
    const availResult = await query(
      `SELECT 
        e.id, e.name, e.asset_code, e.criticality,
        COALESCE(SUM(dr.duration_minutes), 0) as total_downtime_minutes,
        $2::timestamptz - $1::timestamptz as total_period,
        ROUND(
          100 * (1 - COALESCE(SUM(dr.duration_minutes), 0) / 
            (EXTRACT(EPOCH FROM ($2::timestamptz - $1::timestamptz)) / 60)
          )::numeric, 2
        ) as availability_pct
       FROM equipment e
       LEFT JOIN downtime_records dr ON dr.equipment_id = e.id
         AND dr.start_time BETWEEN $1 AND $2
       WHERE e.is_active = TRUE
       GROUP BY e.id, e.name, e.asset_code, e.criticality
       ORDER BY availability_pct ASC
       LIMIT 10`,
      [dateFrom, dateTo]
    );

    // Work order summary
    const woResult = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE sla_breached = TRUE) as sla_breached_count,
        COUNT(*) FILTER (WHERE sla_due_at < NOW() AND status NOT IN ('completed','closed','cancelled')) as overdue_count,
        ROUND(AVG(actual_hours) FILTER (WHERE actual_hours IS NOT NULL)::numeric, 2) as avg_hours
       FROM work_orders
       WHERE created_at BETWEEN $1 AND $2`,
      [dateFrom, dateTo]
    );

    // Health score distribution
    const healthResult = await query(
      `SELECT
        COUNT(*) FILTER (WHERE health_score >= 80) as healthy,
        COUNT(*) FILTER (WHERE health_score >= 50 AND health_score < 80) as warning,
        COUNT(*) FILTER (WHERE health_score < 50) as critical,
        ROUND(AVG(health_score)::numeric, 1) as avg_health
       FROM equipment WHERE is_active = TRUE`
    );

    // OEE calculation (simplified)
    const totalPeriodHours = (new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60);
    const downtimeHours = (parseFloat(downtimeResult.rows[0].total_downtime_minutes) || 0) / 60;
    const availability = totalPeriodHours > 0 
      ? Math.max(0, ((totalPeriodHours - downtimeHours) / totalPeriodHours) * 100)
      : 100;
    const performance = 92; // Would come from production system
    const quality = 98.5; // Would come from quality system
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

    res.json({
      success: true,
      data: {
        period: { from: dateFrom, to: dateTo },
        mttr: {
          hours: parseFloat(mttrResult.rows[0]?.mttr_hours) || 0,
          completedCount: parseInt(mttrResult.rows[0]?.completed_count) || 0
        },
        mtbf: {
          hours: parseFloat(mtbfResult.rows[0]?.mtbf_hours) || 0,
          failureCount: parseInt(mtbfResult.rows[0]?.failure_count) || 0
        },
        downtime: {
          totalIncidents: parseInt(downtimeResult.rows[0]?.total_incidents) || 0,
          totalMinutes: parseFloat(downtimeResult.rows[0]?.total_downtime_minutes) || 0,
          totalCost: parseFloat(downtimeResult.rows[0]?.total_downtime_cost) || 0,
          breakdowns: parseInt(downtimeResult.rows[0]?.breakdown_count) || 0,
          planned: parseInt(downtimeResult.rows[0]?.planned_count) || 0,
          avgMinutes: parseFloat(downtimeResult.rows[0]?.avg_downtime_minutes) || 0
        },
        oee: {
          overall: Math.round(oee * 10) / 10,
          availability: Math.round(availability * 10) / 10,
          performance,
          quality
        },
        workOrders: woResult.rows[0],
        health: healthResult.rows[0],
        equipmentAvailability: availResult.rows
      }
    });
  } catch (err) {
    logger.error('KPI summary error:', err);
    res.status(500).json({ success: false, error: 'Failed to calculate KPIs' });
  }
});

// ─── GET /kpi/downtime-trend ───────────────────────────────────
router.get('/downtime-trend', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await query(
      `SELECT 
        DATE_TRUNC('day', start_time) as date,
        COUNT(*) as incidents,
        ROUND(SUM(duration_minutes)::numeric, 0) as downtime_minutes,
        ROUND(SUM(downtime_cost)::numeric, 2) as cost
       FROM downtime_records
       WHERE start_time > NOW() - ($1 || ' days')::INTERVAL
       GROUP BY DATE_TRUNC('day', start_time)
       ORDER BY date ASC`,
      [parseInt(days)]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch downtime trend' });
  }
});

// ─── GET /kpi/failure-by-category ─────────────────────────────
router.get('/failure-by-category', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        category,
        COUNT(*) as count,
        ROUND(SUM(duration_minutes)::numeric, 0) as total_minutes,
        ROUND(SUM(downtime_cost)::numeric, 2) as total_cost,
        ROUND(AVG(duration_minutes)::numeric, 1) as avg_minutes
       FROM downtime_records
       WHERE type = 'breakdown' AND start_time > NOW() - INTERVAL '90 days'
       GROUP BY category
       ORDER BY count DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch failure categories' });
  }
});

module.exports = router;
