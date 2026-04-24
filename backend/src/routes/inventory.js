'use strict';
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET / - list
router.get('/', async (req, res) => {
  try {
    const { low_stock, search, page=1, limit=50 } = req.query;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const conds=[], params=[];
    let i=1;
    if (low_stock==='true') conds.push(`sp.quantity_on_hand <= sp.reorder_point`);
    if (search) { conds.push(`(sp.name ILIKE $${i} OR sp.part_number ILIKE $${i})`); params.push(`%${search}%`); i++; }
    const where = conds.length ? 'WHERE '+conds.join(' AND ') : '';
    const r = await query(
      `SELECT sp.*,
              CASE WHEN sp.quantity_on_hand <= sp.reorder_point THEN true ELSE false END as needs_reorder,
              sp.quantity_on_hand * sp.unit_cost as inventory_value
       FROM spare_parts sp ${where}
       ORDER BY needs_reorder DESC, sp.name ASC LIMIT $${i} OFFSET $${i+1}`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success:true, data:r.rows });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const r = await query(`SELECT sp.*, CASE WHEN sp.quantity_on_hand<=sp.reorder_point THEN true ELSE false END as needs_reorder, sp.quantity_on_hand*sp.unit_cost as inventory_value FROM spare_parts sp WHERE sp.id=$1`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ success:false, error:'Part not found' });
    res.json({ success:true, data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST / - create
router.post('/', authorize('admin','manager'), [
  body('part_number').notEmpty().trim(),
  body('name').notEmpty().trim(),
  body('unit_cost').isFloat({ min:0 }),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const { part_number,name,category,unit_cost,quantity_on_hand=0,min_stock=0,reorder_point=0,reorder_quantity=0,supplier,is_critical=false } = req.body;
    const siteR = await query('SELECT id FROM sites LIMIT 1');
    const site_id = siteR.rows[0]?.id;
    const r = await query(
      `INSERT INTO spare_parts (site_id,part_number,name,category,unit_cost,quantity_on_hand,min_stock,reorder_point,reorder_quantity,supplier,is_critical)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [site_id,part_number,name,category||null,unit_cost,quantity_on_hand,min_stock,reorder_point,reorder_quantity,supplier||null,is_critical]
    );
    res.status(201).json({ success:true, data:r.rows[0] });
  } catch(e) {
    if (e.code==='23505') return res.status(409).json({ success:false, error:'Part number already exists' });
    res.status(500).json({ success:false, error:e.message });
  }
});

// PATCH /:id - update
router.patch('/:id', authorize('admin','manager'), async (req, res) => {
  try {
    const allowed = ['name','category','unit_cost','min_stock','reorder_point','reorder_quantity','supplier','is_critical','part_number'];
    const sets=[], vals=[];
    for (const k of allowed) {
      if (req.body[k]!==undefined) { vals.push(req.body[k]); sets.push(`${k}=$${vals.length}`); }
    }
    if (!sets.length) return res.status(400).json({ success:false, error:'No valid fields' });
    vals.push(req.params.id);
    const r = await query(`UPDATE spare_parts SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ success:false, error:'Part not found' });
    res.json({ success:true, data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// DELETE /:id
router.delete('/:id', authorize('admin','manager'), async (req, res) => {
  try {
    const r = await query('DELETE FROM spare_parts WHERE id=$1 RETURNING id,name,part_number', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ success:false, error:'Part not found' });
    res.json({ success:true, message:`Deleted ${r.rows[0].name}`, data:r.rows[0] });
  } catch(e) {
    if (e.code==='23503') return res.status(409).json({ success:false, error:'Cannot delete: part is referenced in work orders' });
    res.status(500).json({ success:false, error:e.message });
  }
});

// POST /:id/receive
router.post('/:id/receive', authorize('admin','manager','technician'), [body('quantity').isFloat({min:0.01})], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const r = await query(`UPDATE spare_parts SET quantity_on_hand=quantity_on_hand+$1,updated_at=NOW() WHERE id=$2 RETURNING *`, [req.body.quantity, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ success:false, error:'Part not found' });
    res.json({ success:true, data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST /adjust
router.post('/adjust', authorize('admin','manager','technician'), [
  body('part_id').notEmpty(),
  body('quantity').isFloat(),
  body('reason').notEmpty()
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const { part_id, quantity, reason } = req.body;
    const r = await query(`UPDATE spare_parts SET quantity_on_hand=GREATEST(0,quantity_on_hand+$1),updated_at=NOW() WHERE id=$2 RETURNING *`, [quantity, part_id]);
    if (!r.rows[0]) return res.status(404).json({ success:false, error:'Part not found' });
    res.json({ success:true, data:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
