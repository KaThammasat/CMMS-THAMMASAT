"use strict";
require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const jwt     = require("jsonwebtoken");
const bcrypt  = require("bcryptjs");
const path    = require("path");

const { q }  = require("./db");
const { notifyNewTicket, notifyStatusChange, notifyLowStock, startSLAChecker } = require("./notify");

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "cmms-pro-secret-change-me-in-production";

/* ── Middleware ── */
app.use(cors({ origin: "*", methods: ["GET","POST","PUT","PATCH","DELETE"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, "..", "public")));

/* ── Logging ── */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/* ── Auth Middleware ── */
function auth(roles = []) {
  return (req, res, next) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "ไม่ได้ login" });
    try {
      const payload = jwt.verify(h.split(" ")[1], SECRET);
      if (roles.length && !roles.includes(payload.role))
        return res.status(403).json({ error: "ไม่มีสิทธิ์" });
      req.user = payload;
      next();
    } catch { res.status(401).json({ error: "Token หมดอายุ" }); }
  };
}

/* ── Helper: genTicketId ── */
function slaDeadline(hours) {
  return new Date(Date.now() + hours * 3600000)
    .toISOString().slice(0, 16).replace("T", " ");
}

/* ═══════════════════════════════════════════
   AUTH ROUTES
═══════════════════════════════════════════ */

/* POST /api/auth/login */
app.post("/api/auth/login", (req, res) => {
  const { role, pin } = req.body;
  if (!role || !pin) return res.status(400).json({ error: "กรุณาระบุ role และ PIN" });
  if (!["admin","tech"].includes(role)) return res.status(400).json({ error: "role ไม่ถูกต้อง" });
  const user = q.userByRole(role);
  if (!user || !bcrypt.compareSync(String(pin), user.pin_hash))
    return res.status(401).json({ error: "PIN ไม่ถูกต้อง" });
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: "12h" });
  q.audit({ user_role: role, action: "login", entity: "users", entity_id: user.id, detail: "logged in", ip: req.ip });
  res.json({ token, role: user.role, name: user.name });
});

/* POST /api/auth/change-pin */
app.post("/api/auth/change-pin", auth(["admin"]), (req, res) => {
  const { role, new_pin } = req.body;
  if (!role || !new_pin) return res.status(400).json({ error: "ขาด role หรือ new_pin" });
  if (String(new_pin).length < 4) return res.status(400).json({ error: "PIN ต้องมีอย่างน้อย 4 หลัก" });
  const hash = bcrypt.hashSync(String(new_pin), 10);
  q.updatePin(role, hash);
  q.audit({ user_role: req.user.role, action: "change_pin", entity: "users", entity_id: null, detail: `Changed PIN for ${role}`, ip: req.ip });
  res.json({ success: true });
});

/* GET /api/auth/me */
app.get("/api/auth/me", auth(), (req, res) => {
  res.json({ id: req.user.id, role: req.user.role, name: req.user.name });
});

/* ═══════════════════════════════════════════
   ASSETS ROUTES
═══════════════════════════════════════════ */

/* GET /api/assets */
app.get("/api/assets", auth(), (req, res) => {
  res.json(q.allAssets());
});

/* GET /api/assets/:id */
app.get("/api/assets/:id", auth(), (req, res) => {
  const asset = q.assetById(req.params.id);
  if (!asset) return res.status(404).json({ error: "ไม่พบสินทรัพย์" });
  res.json(asset);
});

/* GET /api/assets/qr/:code */
app.get("/api/assets/qr/:code", (req, res) => {
  // Public — no auth, for QR scan
  const asset = q.assetByCode(req.params.code);
  if (!asset) return res.status(404).json({ error: "ไม่พบสินทรัพย์" });
  res.json(asset);
});

/* POST /api/assets */
app.post("/api/assets", auth(["admin"]), (req, res) => {
  const d = req.body;
  if (!d.code || !d.name) return res.status(400).json({ error: "ขาด code หรือ name" });
  try {
    const result = q.insertAsset({
      code: d.code, name: d.name, type: d.type || "General",
      location: d.location || "", manufacturer: d.manufacturer || "",
      model: d.model || "", serial_no: d.serial_no || "",
      install_date: d.install_date || null, warranty_exp: d.warranty_exp || null,
      notes: d.notes || "", qr_code: d.code,
    });
    q.audit({ user_role: req.user.role, action: "create_asset", entity: "assets", entity_id: result.lastInsertRowid, detail: d.name, ip: req.ip });
    res.status(201).json({ id: result.lastInsertRowid });
  } catch(e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "รหัส Asset นี้มีอยู่แล้ว" });
    res.status(500).json({ error: e.message });
  }
});

/* PUT /api/assets/:id */
app.put("/api/assets/:id", auth(["admin"]), (req, res) => {
  const asset = q.assetById(req.params.id);
  if (!asset) return res.status(404).json({ error: "ไม่พบสินทรัพย์" });
  const d = { ...asset, ...req.body };
  q.updateAsset(req.params.id, d);
  q.audit({ user_role: req.user.role, action: "update_asset", entity: "assets", entity_id: req.params.id, detail: d.name, ip: req.ip });
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   WORK ORDERS ROUTES
═══════════════════════════════════════════ */

/* GET /api/work-orders */
app.get("/api/work-orders", auth(), (req, res) => {
  const { status, priority } = req.query;
  res.json(q.allWO({ status, priority }));
});

/* GET /api/work-orders/:id */
app.get("/api/work-orders/:id", auth(), (req, res) => {
  const wo = q.woById(req.params.id);
  if (!wo) return res.status(404).json({ error: "ไม่พบ Work Order" });
  res.json(wo);
});

/* POST /api/work-orders — create WO (admin, tech, or public with requester) */
app.post("/api/work-orders", (req, res) => {
  const d = req.body;
  if (!d.title) return res.status(400).json({ error: "กรุณาระบุหัวข้องาน" });

  // Auth check — public requests allowed but limited
  let userRole = "public";
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(h.split(" ")[1], SECRET);
      userRole = payload.role;
    } catch {}
  }

  const wo_number = q.nextWONumber();
  const sla_hours = parseInt(d.sla_hours) || 4;

  const data = {
    wo_number,
    title:             d.title,
    description:       d.description || "",
    asset_id:          d.asset_id || null,
    type:              d.type || "reactive",
    priority:          userRole === "public" ? "medium" : (d.priority || "medium"),
    assigned_to:       userRole !== "public" ? (d.assigned_to || "") : "",
    requester_name:    d.requester_name || "",
    requester_contact: d.requester_contact || "",
    sla_hours,
    sla_deadline:      slaDeadline(sla_hours),
    notes:             d.notes || "",
  };

  const result = q.insertWO(data);
  const wo = q.woById(result.lastInsertRowid);

  // Get asset name for notification
  const asset = wo.asset_id ? q.assetById(wo.asset_id) : null;
  notifyNewTicket(wo, asset?.name || "").catch(console.error);

  q.audit({ user_role: userRole, action: "create_wo", entity: "work_orders", entity_id: result.lastInsertRowid, detail: wo_number, ip: req.ip });
  res.status(201).json({ id: result.lastInsertRowid, wo_number });
});

/* PATCH /api/work-orders/:id/status */
app.patch("/api/work-orders/:id/status", auth(["admin","tech"]), (req, res) => {
  const wo = q.woById(req.params.id);
  if (!wo) return res.status(404).json({ error: "ไม่พบ Work Order" });

  const d = req.body;
  const oldStatus = wo.status;
  const newStatus = d.status || wo.status;

  const now = new Date().toISOString().slice(0,16).replace("T"," ");
  const updateData = {
    status:       newStatus,
    started_at:   newStatus === "in_progress" && !wo.started_at ? now : wo.started_at,
    completed_at: newStatus === "completed" ? now : wo.completed_at,
    root_cause:   d.root_cause || wo.root_cause,
    labor_hours:  d.labor_hours || wo.labor_hours,
    parts_used:   d.parts_used || wo.parts_used,
    notes:        d.notes || wo.notes,
  };

  q.updateWOStatus(req.params.id, updateData);
  notifyStatusChange(wo, oldStatus, newStatus).catch(console.error);

  q.audit({ user_role: req.user.role, action: "update_wo_status", entity: "work_orders", entity_id: req.params.id, detail: `${oldStatus}→${newStatus}`, ip: req.ip });
  res.json({ success: true, old: oldStatus, new: newStatus });
});

/* GET /api/work-orders/public/status/:wo_number — public tracking */
app.get("/api/public/status/:wo_number", (req, res) => {
  const { db } = require("./db");
  const wo = db.prepare("SELECT wo_number,title,status,priority,assigned_to,created_at,updated_at FROM work_orders WHERE wo_number=?").get(req.params.wo_number);
  if (!wo) return res.status(404).json({ error: "ไม่พบ Work Order" });
  res.json(wo);
});

/* ═══════════════════════════════════════════
   PM PLANS ROUTES
═══════════════════════════════════════════ */

/* GET /api/pm-plans */
app.get("/api/pm-plans", auth(), (req, res) => {
  res.json(q.allPM());
});

/* POST /api/pm-plans */
app.post("/api/pm-plans", auth(["admin"]), (req, res) => {
  const d = req.body;
  if (!d.title || !d.asset_id) return res.status(400).json({ error: "ขาด title หรือ asset_id" });
  const nextDue = d.next_due || new Date(Date.now() + (d.frequency_days||90)*86400000).toISOString().slice(0,10);
  const result = q.insertPM({ ...d, next_due: nextDue, checklist: JSON.stringify(d.checklist || []) });
  q.audit({ user_role: req.user.role, action: "create_pm", entity: "pm_plans", entity_id: result.lastInsertRowid, detail: d.title, ip: req.ip });
  res.status(201).json({ id: result.lastInsertRowid });
});

/* POST /api/pm-plans/:id/done */
app.post("/api/pm-plans/:id/done", auth(["admin","tech"]), (req, res) => {
  const { db } = require("./db");
  const pm = db.prepare("SELECT * FROM pm_plans WHERE id=?").get(req.params.id);
  if (!pm) return res.status(404).json({ error: "ไม่พบ PM Plan" });
  const today = new Date().toISOString().slice(0,10);
  const next  = new Date(Date.now() + pm.frequency_days*86400000).toISOString().slice(0,10);
  q.updatePMDone(req.params.id, today, next);
  res.json({ success: true, next_due: next });
});

/* ═══════════════════════════════════════════
   SPARE PARTS ROUTES
═══════════════════════════════════════════ */

/* GET /api/spare-parts */
app.get("/api/spare-parts", auth(), (req, res) => {
  const parts = q.allParts();
  const low = q.lowStockParts();
  res.json({ parts, low_stock_count: low.length });
});

/* POST /api/spare-parts */
app.post("/api/spare-parts", auth(["admin"]), (req, res) => {
  const d = req.body;
  if (!d.name) return res.status(400).json({ error: "ขาด name" });
  try {
    const result = q.insertPart({
      part_no:   d.part_no || null, name: d.name, category: d.category || "General",
      quantity:  parseInt(d.quantity) || 0, min_qty: parseInt(d.min_qty) || 5,
      unit_cost: parseFloat(d.unit_cost) || 0, location: d.location || "",
      supplier: d.supplier || "", notes: d.notes || "",
    });
    q.audit({ user_role: req.user.role, action: "create_part", entity: "spare_parts", entity_id: result.lastInsertRowid, detail: d.name, ip: req.ip });
    res.status(201).json({ id: result.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /api/spare-parts/:id/issue — issue parts for WO */
app.post("/api/spare-parts/:id/issue", auth(["admin","tech"]), (req, res) => {
  const { qty, wo_id, note } = req.body;
  if (!qty || qty <= 0) return res.status(400).json({ error: "จำนวนไม่ถูกต้อง" });
  const part = q.partById(req.params.id);
  if (!part) return res.status(404).json({ error: "ไม่พบอะไหล่" });
  if (part.quantity < qty) return res.status(400).json({ error: "อะไหล่ไม่เพียงพอ" });
  q.updatePartQty(req.params.id, -qty);
  const { db } = require("./db");
  db.prepare("INSERT INTO part_transactions(part_id,wo_id,type,qty,note,created_by) VALUES(?,?,?,?,?,?)").run(req.params.id, wo_id||null, "issue", qty, note||"", req.user.name);
  // Check low stock
  const updated = q.partById(req.params.id);
  if (updated.quantity <= updated.min_qty) notifyLowStock(updated).catch(console.error);
  res.json({ success: true, remaining: updated.quantity });
});

/* POST /api/spare-parts/:id/receive */
app.post("/api/spare-parts/:id/receive", auth(["admin"]), (req, res) => {
  const { qty, note } = req.body;
  if (!qty || qty <= 0) return res.status(400).json({ error: "จำนวนไม่ถูกต้อง" });
  q.updatePartQty(req.params.id, qty);
  const { db } = require("./db");
  db.prepare("INSERT INTO part_transactions(part_id,type,qty,note,created_by) VALUES(?,?,?,?,?)").run(req.params.id, "receive", qty, note||"", req.user.name);
  const updated = q.partById(req.params.id);
  res.json({ success: true, quantity: updated.quantity });
});

/* ═══════════════════════════════════════════
   KPI & REPORTS ROUTES
═══════════════════════════════════════════ */

/* GET /api/kpi/summary */
app.get("/api/kpi/summary", auth(), (req, res) => {
  const summary = q.kpiSummary();
  const { db } = require("./db");
  // Monthly breakdown
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS month,
           COUNT(*) AS total,
           SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
           AVG(CASE WHEN labor_hours>0 THEN labor_hours END) AS avg_mttr
    FROM work_orders
    GROUP BY month ORDER BY month DESC LIMIT 6
  `).all();
  // By priority
  const byPriority = db.prepare(`
    SELECT priority, COUNT(*) AS n FROM work_orders GROUP BY priority
  `).all();
  // By type
  const byType = db.prepare(`
    SELECT type, COUNT(*) AS n FROM work_orders GROUP BY type
  `).all();
  res.json({ summary, monthly, byPriority, byType });
});

/* GET /api/kpi/assets */
app.get("/api/kpi/assets", auth(), (req, res) => {
  const { db } = require("./db");
  const assets = db.prepare(`
    SELECT a.id,a.code,a.name,a.type,a.health_score,a.status,
           COUNT(w.id) AS total_wo,
           SUM(CASE WHEN w.status='completed' THEN 1 ELSE 0 END) AS completed_wo,
           AVG(CASE WHEN w.labor_hours>0 THEN w.labor_hours END) AS avg_mttr
    FROM assets a LEFT JOIN work_orders w ON a.id=w.asset_id
    GROUP BY a.id ORDER BY a.health_score ASC
  `).all();
  res.json(assets);
});

/* ═══════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════ */

/* GET /api/notifications */
app.get("/api/notifications", auth(), (req, res) => {
  res.json({ notifications: q.allNotifications(), unread: q.unreadCount() });
});

/* POST /api/notifications/:id/read */
app.post("/api/notifications/:id/read", auth(), (req, res) => {
  q.markRead(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   HEALTH CHECK
═══════════════════════════════════════════ */

app.get("/api/health", (req, res) => {
  res.json({
    status:  "ok",
    app:     "CMMS PRO",
    version: "3.0.0",
    time:    new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
    timezone:"Asia/Bangkok",
  });
});

/* ═══════════════════════════════════════════
   FRONTEND SPA FALLBACK
═══════════════════════════════════════════ */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`\n🚀 CMMS PRO v3.0 running on port ${PORT}`);
  console.log(`   Time zone : Asia/Bangkok`);
  console.log(`   API docs  : http://localhost:${PORT}/api/health\n`);
  startSLAChecker();
});
