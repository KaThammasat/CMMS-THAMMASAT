/**
 * Inventory Routes
 */
'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { site_id, low_stock, search, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = [];
    let params = [];
    let i = 1;

    if (site_id) { conditions.push(`sp.site_id = $${i++}`); params.push(site_id); }
    if (low_stock === 'true') { conditions.push(`sp.quantity_on_hand <= sp.reorder_point`); }
    if (search) {
      conditions.push(`(sp.name ILIKE $${i} OR sp.part_number ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(
      `SELECT sp.*,
              CASE WHEN sp.quantity_on_hand <= sp.reorder_point THEN true ELSE false END as needs_reorder,
              sp.quantity_on_hand * sp.unit_cost as inventory_value
       FROM spare_parts sp
       ${where}
       ORDER BY needs_reorder DESC, sp.name ASC
       LIMIT $${i} OFFSET $${i+1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch inventory' });
  }
});

router.post('/adjust', authorize('admin', 'manager', 'technician'), [
  body('part_id').isString().notEmpty(),
  body('quantity').isFloat(),
  body('reason').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { part_id, quantity, reason } = req.body;
    const result = await query(
      `UPDATE spare_parts
       SET quantity_on_hand = GREATEST(0, quantity_on_hand + $1), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [quantity, part_id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Part not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to adjust inventory' });
  }
});

module.exports = router;

// POST / - Create new spare part
router.post('/', authorize('admin', 'manager'), [
  body('part_number').notEmpty().trim(),
  body('name').notEmpty().trim(),
  body('unit_cost').isFloat({ min: 0 }),
  body('quantity_on_hand').optional().isFloat({ min: 0 }),
  body('category').optional().trim(),
  body('supplier').optional().trim(),
  body('min_stock').optional().isFloat({ min: 0 }),
  body('reorder_point').optional().isFloat({ min: 0 }),
  body('reorder_quantity').optional().isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { part_number, name, category, unit_cost, quantity_on_hand=0,
            min_stock=0, reorder_point=0, reorder_quantity=0, supplier, is_critical=false } = req.body;
    // Get site_id from first site
    const siteR = await query('SELECT id FROM sites LIMIT 1');
    const site_id = siteR.rows[0]?.id;
    const result = await query(
      `INSERT INTO spare_parts (site_id,part_number,name,category,unit_cost,quantity_on_hand,
         min_stock,reorder_point,reorder_quantity,supplier,is_critical)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [site_id,part_number,name,category,unit_cost,quantity_on_hand,
       min_stock,reorder_point,reorder_quantity,supplier,is_critical]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Part number already exists' });
    res.status(500).json({ success: false, error: 'Failed to create spare part' });
  }
});

// POST /:id/receive - Receive stock
router.post('/:id/receive', authorize('admin', 'manager', 'technician'), [
  body('quantity').isFloat({ min: 0.01 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const result = await query(
      `UPDATE spare_parts SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.body.quantity, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Part not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to receive stock' });
  }
});
