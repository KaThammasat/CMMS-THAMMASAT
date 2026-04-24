/**
 * Admin Routes — User Mgmt, Config, Audit, Security
 * Role: admin only
 */
const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authenticate, authorize('admin'));

// ── Audit helper ────────────────────────────────────────────────
async function audit(actor_id, action, entity_type, entity_id, before_data, after_data, req) {
  try {
    await pool.query(
      `INSERT INTO audit_log(actor_id,action,entity_type,entity_id,before_data,after_data,ip_address,user_agent)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [actor_id, action, entity_type, entity_id,
       before_data ? JSON.stringify(before_data) : null,
       after_data  ? JSON.stringify(after_data)  : null,
       req.ip, req.headers['user-agent']?.slice(0,200)]
    );
  } catch(e) { logger.warn('audit write failed: '+e.message); }
}

// ── USER MANAGEMENT ────────────────────────────────────────────
// GET /api/v1/admin/users
router.get('/users', async (req, res) => {
  try {
    const { search='', role='', is_active='', page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    const conds = ['1=1'], vals = [];
    if (search) { vals.push('%'+search+'%'); conds.push(`(u.first_name||' '||u.last_name ILIKE $${vals.length} OR u.email ILIKE $${vals.length} OR u.employee_id ILIKE $${vals.length})`); }
    if (role)   { vals.push(role); conds.push(`u.role=$${vals.length}`); }
    if (is_active!=='') { vals.push(is_active==='true'); conds.push(`u.is_active=$${vals.length}`); }
    const where = conds.join(' AND ');
    const [{ rows }, { rows: cnt }] = await Promise.all([
      pool.query(`SELECT u.id,u.employee_id,u.email,u.first_name,u.last_name,u.role,u.department,u.phone,u.skills,u.is_active,u.last_login,u.created_at,s.name as site_name FROM users u LEFT JOIN sites s ON s.id=u.site_id WHERE ${where} ORDER BY u.created_at DESC LIMIT $${vals.length+1} OFFSET $${vals.length+2}`, [...vals,limit,offset]),
      pool.query(`SELECT COUNT(*) FROM users u WHERE ${where}`, vals)
    ]);
    res.json({ success:true, data:rows, pagination:{ total:+cnt[0].count, page:+page, limit:+limit, pages:Math.ceil(cnt[0].count/limit) } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /api/v1/admin/users/:id
router.get('/users/:id', async (req,res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.*,s.name as site_name FROM users u LEFT JOIN sites s ON s.id=u.site_id WHERE u.id=$1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success:false, error:'User not found' });
    const { password_hash, refresh_token_hash, ...user } = rows[0];
    // Get recent activity
    const { rows: activity } = await pool.query(
      `SELECT action,entity_type,entity_id,created_at FROM audit_log WHERE actor_id=$1 ORDER BY created_at DESC LIMIT 10`, [req.params.id]
    );
    res.json({ success:true, data:{ ...user, recent_activity: activity } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST /api/v1/admin/users
router.post('/users', [
  body('employee_id').isString().notEmpty(),
  body('email').isEmail(),
  body('first_name').isString().notEmpty(),
  body('last_name').isString().notEmpty(),
  body('role').isIn(['admin','manager','technician','operator','viewer']),
  body('password').isLength({ min:8 }),
], async (req,res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const { employee_id, email, first_name, last_name, role, department, phone, skills, password } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const { rows: sites } = await pool.query('SELECT id FROM sites LIMIT 1');
    const site_id = sites[0]?.id;
    const { rows } = await pool.query(
      `INSERT INTO users(site_id,employee_id,email,password_hash,first_name,last_name,role,department,phone,skills)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,employee_id,email,first_name,last_name,role,department,is_active,created_at`,
      [site_id,employee_id,email,hash,first_name,last_name,role,department||null,phone||null,skills||[]]
    );
    await audit(req.user.id,'CREATE_USER','user',rows[0].id,null,{email,role},req);
    res.status(201).json({ success:true, data:rows[0] });
  } catch(e) {
    if (e.code==='23505') return res.status(409).json({ success:false, error:'Email or employee ID already exists' });
    res.status(500).json({ success:false, error:e.message });
  }
});

// PATCH /api/v1/admin/users/:id
router.patch('/users/:id', [
  body('role').optional().isIn(['admin','manager','technician','operator','viewer']),
  body('email').optional().isEmail(),
  body('is_active').optional().isBoolean(),
], async (req,res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const { rows: before } = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!before[0]) return res.status(404).json({ success:false, error:'User not found' });
    const allowed = ['first_name','last_name','email','role','department','phone','skills','is_active'];
    const sets = [], vals = [];
    for (const k of allowed) {
      if (req.body[k]!==undefined) { vals.push(req.body[k]); sets.push(`${k}=$${vals.length}`); }
    }
    if (!sets.length) return res.status(400).json({ success:false, error:'No valid fields' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length} RETURNING id,employee_id,email,first_name,last_name,role,department,is_active,updated_at`,
      vals
    );
    await audit(req.user.id,'UPDATE_USER','user',req.params.id,{role:before[0].role,is_active:before[0].is_active},{...req.body},req);
    res.json({ success:true, data:rows[0] });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// PATCH /api/v1/admin/users/:id/reset-password
router.patch('/users/:id/reset-password', [body('new_password').isLength({min:8})], async (req,res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success:false, errors:errs.array() });
  try {
    const hash = await bcrypt.hash(req.body.new_password, 12);
    const { rowCount } = await pool.query('UPDATE users SET password_hash=$1,refresh_token_hash=NULL,updated_at=NOW() WHERE id=$2', [hash, req.params.id]);
    if (!rowCount) return res.status(404).json({ success:false, error:'User not found' });
    await audit(req.user.id,'RESET_PASSWORD','user',req.params.id,null,{forced:true},req);
    res.json({ success:true, message:'Password reset successfully' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// DELETE /api/v1/admin/users/:id (soft delete — deactivate)
router.delete('/users/:id', async (req,res) => {
  try {
    if (req.params.id===req.user.id) return res.status(400).json({ success:false, error:'Cannot deactivate your own account' });
    const { rows } = await pool.query('UPDATE users SET is_active=FALSE,refresh_token_hash=NULL,updated_at=NOW() WHERE id=$1 RETURNING id,email', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success:false, error:'User not found' });
    await audit(req.user.id,'DEACTIVATE_USER','user',req.params.id,null,{email:rows[0].email},req);
    res.json({ success:true, message:'User deactivated' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// ── SYSTEM CONFIG ───────────────────────────────────────────────
// GET /api/v1/admin/config
router.get('/config', async (req,res) => {
  try {
    const { rows } = await pool.query('SELECT key,value,description,updated_at FROM system_config ORDER BY key');
    const cfg = {};
    rows.forEach(r => { try { cfg[r.key] = { value: JSON.parse(r.value), description: r.description, updated_at: r.updated_at }; } catch { cfg[r.key] = { value: r.value, description: r.description, updated_at: r.updated_at }; } });
    res.json({ success:true, data:cfg });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// PATCH /api/v1/admin/config
router.patch('/config', async (req,res) => {
  try {
    const updates = req.body; // { key: value }
    const results = {};
    for (const [key, value] of Object.entries(updates)) {
      const val = typeof value === 'string' ? value : JSON.stringify(value);
      await pool.query(
        `INSERT INTO system_config(key,value,updated_by) VALUES($1,$2,$3)
         ON CONFLICT(key) DO UPDATE SET value=$2,updated_by=$3,updated_at=NOW()`,
        [key, val, req.user.id]
      );
      results[key] = value;
    }
    await audit(req.user.id,'UPDATE_CONFIG','system_config',null,null,updates,req);
    res.json({ success:true, data:results, message:`${Object.keys(results).length} config(s) updated` });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// ── AUDIT LOG ───────────────────────────────────────────────────
// GET /api/v1/admin/audit
router.get('/audit', async (req,res) => {
  try {
    const { action='', entity_type='', actor='', page=1, limit=50 } = req.query;
    const offset = (page-1)*limit;
    const conds = ['1=1'], vals = [];
    if (action) { vals.push('%'+action+'%'); conds.push(`a.action ILIKE $${vals.length}`); }
    if (entity_type) { vals.push(entity_type); conds.push(`a.entity_type=$${vals.length}`); }
    if (actor) { vals.push('%'+actor+'%'); conds.push(`(u.email ILIKE $${vals.length} OR u.first_name ILIKE $${vals.length} OR u.last_name ILIKE $${vals.length})`); }
    const where = conds.join(' AND ');
    const [{ rows }, { rows: cnt }] = await Promise.all([
      pool.query(`SELECT a.*,u.email as actor_email,u.first_name||' '||u.last_name as actor_name,u.role as actor_role FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id WHERE ${where} ORDER BY a.created_at DESC LIMIT $${vals.length+1} OFFSET $${vals.length+2}`, [...vals,limit,offset]),
      pool.query(`SELECT COUNT(*) FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id WHERE ${where}`, vals)
    ]);
    res.json({ success:true, data:rows, pagination:{ total:+cnt[0].count, page:+page, limit:+limit } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// ── SECURITY / STATS ────────────────────────────────────────────
// GET /api/v1/admin/stats
router.get('/stats', async (req,res) => {
  try {
    const [users, roles, activity, recent_logins] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE is_active) as active, COUNT(*) FILTER(WHERE NOT is_active) as inactive, COUNT(*) FILTER(WHERE last_login > NOW()-INTERVAL '24h') as active_today FROM users`),
      pool.query(`SELECT role, COUNT(*) as count FROM users WHERE is_active=TRUE GROUP BY role ORDER BY count DESC`),
      pool.query(`SELECT action, COUNT(*) as count FROM audit_log WHERE created_at > NOW()-INTERVAL '24h' GROUP BY action ORDER BY count DESC LIMIT 10`),
      pool.query(`SELECT u.email,u.first_name,u.last_name,u.role,u.last_login FROM users u WHERE u.last_login IS NOT NULL ORDER BY u.last_login DESC LIMIT 5`)
    ]);
    res.json({ success:true, data:{
      users: users.rows[0],
      by_role: roles.rows,
      activity_24h: activity.rows,
      recent_logins: recent_logins.rows
    }});
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// ── SESSION MANAGEMENT ──────────────────────────────────────────
// DELETE /api/v1/admin/users/:id/sessions (force logout)
router.delete('/users/:id/sessions', async (req,res) => {
  try {
    const { rowCount } = await pool.query('UPDATE users SET refresh_token_hash=NULL WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success:false, error:'User not found' });
    await audit(req.user.id,'FORCE_LOGOUT','user',req.params.id,null,null,req);
    res.json({ success:true, message:'Sessions terminated' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;

// ── REPAIR REQUESTS (admin management) ──────────────────────────
// GET /api/v1/admin/repair-requests
router.get('/repair-requests', async (req,res) => {
  try {
    const { status='', urgency='', page=1, limit=50 } = req.query;
    const offset=(page-1)*limit, conds=['1=1'], vals=[];
    if(status){vals.push(status);conds.push(`r.status=$${vals.length}`);}
    if(urgency){vals.push(urgency);conds.push(`r.urgency=$${vals.length}`);}
    const where=conds.join(' AND ');
    const[{rows},{rows:cnt}]=await Promise.all([
      pool.query(`SELECT r.*,u.first_name||' '||u.last_name as assigned_name FROM repair_requests r LEFT JOIN users u ON u.id=r.assigned_to WHERE ${where} ORDER BY r.created_at DESC LIMIT $${vals.length+1} OFFSET $${vals.length+2}`,[...vals,limit,offset]),
      pool.query(`SELECT COUNT(*) FROM repair_requests r WHERE ${where}`,vals)
    ]);
    // Stats
    const{rows:stats}=await pool.query(`SELECT status,COUNT(*) as count FROM repair_requests GROUP BY status`);
    res.json({success:true,data:rows,pagination:{total:+cnt[0].count,page:+page,limit:+limit},stats:Object.fromEntries(stats.map(s=>[s.status,+s.count]))});
  }catch(e){res.status(500).json({success:false,error:e.message});}
});

// PATCH /api/v1/admin/repair-requests/:id
router.patch('/repair-requests/:id', async (req,res) => {
  try {
    const{status,admin_notes,assigned_to}=req.body;
    const sets=[],vals=[];
    if(status){vals.push(status);sets.push(`status=$${vals.length}`);
      if(status==='resolved'){sets.push(`resolved_at=NOW()`);}
    }
    if(admin_notes!==undefined){vals.push(admin_notes);sets.push(`admin_notes=$${vals.length}`);}
    if(assigned_to!==undefined){vals.push(assigned_to||null);sets.push(`assigned_to=$${vals.length}`);}
    if(!sets.length)return res.status(400).json({success:false,error:'No fields to update'});
    vals.push(req.params.id);
    const{rows}=await pool.query(`UPDATE repair_requests SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,vals);
    if(!rows[0])return res.status(404).json({success:false,error:'Request not found'});
    await audit(req.user.id,'UPDATE_REPAIR_REQUEST','repair_request',req.params.id,null,{status,admin_notes},req);
    res.json({success:true,data:rows[0]});
  }catch(e){res.status(500).json({success:false,error:e.message});}
});

// ── COMPANY SETTINGS ────────────────────────────────────────────
// GET /api/v1/admin/company
router.get('/company', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT key,value FROM system_config WHERE key LIKE 'company_%' OR key IN ('system_name','system_timezone','maintenance_mode','alert_email_enabled') ORDER BY key`);
    const data = {};
    rows.forEach(r => { try { data[r.key]=JSON.parse(r.value); } catch { data[r.key]=r.value; } });
    res.json({ success:true, data });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// PATCH /api/v1/admin/company
router.patch('/company', async (req, res) => {
  try {
    const allowed = ['company_name','company_name_th','company_logo_url','company_address','company_phone','company_email','company_website','company_tax_id','system_name','system_timezone'];
    for (const key of allowed) {
      if (req.body[key]!==undefined) {
        await pool.query(`INSERT INTO system_config(key,value,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value=$2,updated_by=$3,updated_at=NOW()`,
          [key, typeof req.body[key]==='string'?req.body[key]:JSON.stringify(req.body[key]), req.user.id]);
      }
    }
    await pool.query(`INSERT INTO audit_log(actor_id,action,entity_type,after_data,ip_address) VALUES($1,'UPDATE_COMPANY_SETTINGS','system_config',$2,$3)`,
      [req.user.id, JSON.stringify(req.body), req.ip]);
    res.json({ success:true, message:'Company settings updated' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /api/v1/admin/repair-requests/stats — top failing equipment + repair stats
router.get('/dashboard-stats', async (req, res) => {
  try {
    const [topFailing, recentRepairs, pendingRepairs] = await Promise.all([
      pool.query(`SELECT e.id,e.asset_code,e.name,e.type,e.criticality,e.health_score,
                         COUNT(wo.id) as total_failures,
                         SUM(CASE WHEN dr.end_time IS NULL THEN 1 ELSE 0 END) as active_downtime
                  FROM equipment e
                  LEFT JOIN work_orders wo ON wo.equipment_id=e.id AND wo.type='corrective'
                  LEFT JOIN downtime_records dr ON dr.equipment_id=e.id
                  GROUP BY e.id ORDER BY total_failures DESC, e.health_score ASC LIMIT 5`),
      pool.query(`SELECT r.*,u.first_name||' '||u.last_name as assigned_name
                  FROM repair_requests r LEFT JOIN users u ON u.id=r.assigned_to
                  ORDER BY r.created_at DESC LIMIT 10`),
      pool.query(`SELECT COUNT(*) FROM repair_requests WHERE status='pending'`),
    ]);
    res.json({ success:true, data:{ top_failing_equipment:topFailing.rows, recent_repairs:recentRepairs.rows, pending_repair_count:+pendingRepairs.rows[0].count } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});
