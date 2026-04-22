/**
 * Public Routes — No authentication required
 * POST /api/v1/public/repair-requests  — submit repair request
 * GET  /api/v1/public/repair-requests/:ticket — track by ticket number
 */
const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

// Ticket number generator: TKT-YYYYMMDD-XXXX
function genTicket() {
  const d = new Date();
  const date = d.getFullYear().toString().slice(-2) +
    String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  const rand = Math.floor(Math.random()*9000)+1000;
  return `TKT-${date}-${rand}`;
}

// POST /api/v1/public/repair-requests
router.post('/repair-requests', [
  body('requester_name').trim().isLength({min:2,max:100}).withMessage('Name required (2-100 chars)'),
  body('requester_phone').optional().trim().isLength({max:30}),
  body('requester_email').optional().trim().isEmail().withMessage('Invalid email'),
  body('location').trim().isLength({min:2,max:200}).withMessage('Location required'),
  body('equipment_description').trim().isLength({min:2,max:200}).withMessage('Equipment description required'),
  body('problem_description').trim().isLength({min:10,max:2000}).withMessage('Problem description required (min 10 chars)'),
  body('urgency').isIn(['low','normal','high','critical']).withMessage('Invalid urgency'),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array().map(e=>e.msg) });
  try {
    const { requester_name, requester_phone, requester_email, location, equipment_description, problem_description, urgency } = req.body;
    let ticket = genTicket();
    // retry on collision
    for (let i=0; i<3; i++) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO repair_requests(ticket_number,requester_name,requester_phone,requester_email,location,equipment_description,problem_description,urgency)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,ticket_number,status,created_at`,
          [ticket, requester_name, requester_phone||null, requester_email||null, location, equipment_description, problem_description, urgency||'normal']
        );
        logger.info(`Public repair request: ${ticket} from ${requester_name}`);
        return res.status(201).json({ success:true, data:{ ticket_number:rows[0].ticket_number, status:rows[0].status, created_at:rows[0].created_at, message:'Your repair request has been submitted. Use the ticket number to track status.' } });
      } catch(e) {
        if (e.code==='23505') { ticket=genTicket(); } else throw e;
      }
    }
  } catch(e) {
    logger.error('Public repair request error: '+e.message);
    res.status(500).json({ success:false, error:'Failed to submit request. Please try again.' });
  }
});

// GET /api/v1/public/repair-requests/:ticket — public ticket tracking
router.get('/repair-requests/:ticket', [
  param('ticket').matches(/^TKT-\d{6}-\d{4}$/).withMessage('Invalid ticket format'),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, error:'Invalid ticket number' });
  try {
    const { rows } = await pool.query(
      `SELECT ticket_number,status,urgency,location,equipment_description,problem_description,
              created_at,updated_at,resolved_at,
              CASE WHEN admin_notes IS NOT NULL THEN admin_notes ELSE NULL END as admin_notes
       FROM repair_requests WHERE ticket_number=$1`, [req.params.ticket]
    );
    if (!rows[0]) return res.status(404).json({ success:false, error:'Ticket not found' });
    res.json({ success:true, data:rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
