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
  body('part_id').isUUID('all'),
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
