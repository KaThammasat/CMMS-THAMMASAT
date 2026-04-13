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
const SECRET = process.env.JWT_SECRET || "cmms-pro-secret";

app.use(cors({ origin: "*", methods: ["GET","POST","PUT","PATCH","DELETE"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use((req, res, next) => { console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); next(); });

function auth(roles = []) {
  return (req, res, next) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    try {
      const payload = jwt.verify(h.split(" ")[1], SECRET);
      if (roles.length && !roles.includes(payload.role))
        return res.status(403).json({ error: "Forbidden" });
      req.user = payload;
      next();
    } catch { res.status(401).json({ error: "Token expired" }); }
  };
}

function slaDeadline(hours) {
  return new Date(Date.now() + hours * 3600000).toISOString().slice(0, 16).replace("T", " ");
}

// AUTH
app.post("/api/auth/login", (req, res) => {
  const { role, pin } = req.body;
  if (!role || !pin) return res.status(400).json({ error: "role and PIN required" });
  if (!["admin","tech"].includes(role)) return res.status(400).json({ error: "invalid role" });
  const user = q.userByRole(role);
  if (!user || !bcrypt.compareSync(String(pin), user.pin_hash))
    return res.status(401).json({ error: "Wrong PIN" });
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: "12h" });
  q.audit({ user_role: role, action: "login", entity: "users", entity_id: user.id, detail: "login", ip: req.ip });
  res.json({ token, role: user.role, name: user.name });
});

app.post("/api/auth/change-pin", auth(["admin"]), (req, res) => {
  const { role, new_pin } = req.body;
  if (!role || !new_pin || String(new_pin).length < 4) return res.status(400).json({ error: "invalid" });
  q.updatePin(role, bcrypt.hashSync(String(new_pin), 10));
  res.json({ success: true });
});

app.get("/api/auth/me", auth(), (req, res) => {
  res.json({ id: req.user.id, role: req.user.role, name: req.user.name });
});

// ASSETS
app.get("/api/assets", auth(), (req, res) => { res.json(q.allAssets()); });
app.get("/api/assets/qr/:code", (req, res) => {
  const asset = q.assetByCode(req.params.code);
  if (!asset) return res.status(404).json({ error: "not found" });
  res.json(asset);
});
app.get("/api/assets/:id", auth(), (req, res) => {
  const asset = q.assetById(req.params.id);
  if (!asset) return res.status(404).json({ error: "not found" });
  res.json(asset);
});
app.post("/api/assets", auth(["admin"]), (req, res) => {
  const d = req.body;
  if (!d.code || !d.name) return res.status(400).json({ error: "code and name required" });
  try {
    const result = q.insertAsset({ code: d.code, name: d.name, type: d.type||"General", location: d.location||"", manufacturer: d.manufacturer||"", model: d.model||"", serial_no: d.serial_no||"", install_date: d.install_date||null, warranty_exp: d.warranty_exp||null, notes: d.notes||"", qr_code: d.code });
    q.audit({ user_role: req.user.role, action: "create_asset", entity: "assets", entity_id: result.lastInsertRowid, detail: d.name, ip: req.ip });
    res.status(201).json({ id: result.lastInsertRowid });
  } catch(e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "code exists" });
    res.status(500).json({ error: e.message });
  }
});
app.put("/api/assets/:id", auth(["admin"]), (req, res) => {
  const asset = q.assetById(req.params.id);
  if (!asset) return res.status(404).json({ error: "not found" });
  q.updateAsset(req.params.id, { ...asset, ...req.body });
  res.json({ success: true });
});

// WORK ORDERS
app.get("/api/work-orders", auth(), (req, res) => {
  res.json(q.allWO({ status: req.query.status, priority: req.query.priority }));
});
app.get("/api/work-orders/:id", auth(), (req, res) => {
  const wo = q.woById(req.params.id);
  if (!wo) return res.status(404).json({ error: "not found" });
  res.json(wo);
});
app.post("/api/work-orders", (req, res) => {
  const d = req.body;
  if (!d.title) return res.status(400).json({ error: "title required" });
  let userRole = "public";
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) {
    try { const p = jwt.verify(h.split(" ")[1], SECRET); userRole = p.role; } catch {}
  }
  const wo_number = q.nextWONumber();
  const sla_hours = parseInt(d.sla_hours) || 4;
  const data = {
    wo_number, title: d.title, description: d.description||"",
    asset_id: d.asset_id||null, type: d.type||"reactive",
    priority: userRole === "public" ? "medium" : (d.priority||"medium"),
    assigned_to: userRole !== "public" ? (d.assigned_to||"") : "",
    requester_name: d.requester_name||"", requester_contact: d.requester_contact||"",
    sla_hours, sla_deadline: slaDeadline(sla_hours), notes: d.notes||"",
  };
  const result = q.insertWO(data);
  const wo = q.woById(result.lastInsertRowid);
  const asset = wo.asset_id ? q.assetById(wo.asset_id) : null;
  notifyNewTicket(wo, asset?.name||"").catch(console.error);
  q.audit({ user_role: userRole, action: "create_wo", entity: "work_orders", entity_id: result.lastInsertRowid, detail: wo_number, ip: req.ip });
  res.status(201).json({ id: result.lastInsertRowid, wo_number });
});
app.patch("/api/work-orders/:id/status", auth(["admin","tech"]), (req, res) => {
  const wo = q.woById(req.params.id);
  if (!wo) return res.status(404).json({ error: "not found" });
  const d = req.body;
  const oldStatus = wo.status;
  const newStatus = d.status || wo.status;
  const now = new Date().toISOString().slice(0,16).replace("T"," ");
  q.updateWOStatus(req.params.id, {
    status: newStatus,
    started_at: newStatus === "in_progress" && !wo.started_at ? now : wo.started_at,
    completed_at: newStatus === "completed" ? now : wo.completed_at,
    root_cause: d.root_cause||wo.root_cause, labor_hours: d.labor_hours||wo.labor_hours,
    parts_used: d.parts_used||wo.parts_used, notes: d.notes||wo.notes,
  });
  notifyStatusChange(wo, oldStatus, newStatus).catch(console.error);
  q.audit({ user_role: req.user.role, action: "update_wo_status", entity: "work_orders", entity_id: req.params.id, detail: `${oldStatus}=>${newStatus}`, ip: req.ip });
  res.json({ success: true, old: oldStatus, new: newStatus });
});
app.get("/api/public/status/:wo_number", (req, res) => {
  const { db } = require("./db");
  const wo = db.prepare("SELECT wo_number,title,status,priority,assigned_to,created_at,updated_at FROM work_orders WHERE wo_number=?").get(req.params.wo_number);
  if (!wo) return res.status(404).json({ error: "not found" });
  res.json(wo);
});

// PM PLANS
app.get("/api/pm-plans", auth(), (req, res) => { res.json(q.allPM()); });
app.post("/api/pm-plans", auth(["admin"]), (req, res) => {
  const d = req.body;
  if (!d.title || !d.asset_id) return res.status(400).json({ error: "missing fields" });
  const nextDue = d.next_due || new Date(Date.now() + (d.frequency_days||90)*86400000).toISOString().slice(0,10);
  const result = q.insertPM({ ...d, next_due: nextDue, checklist: JSON.stringify(d.checklist||[]) });
  res.status(201).json({ id: result.lastInsertRowid });
});
app.post("/api/pm-plans/:id/done", auth(["admin","tech"]), (req, res) => {
  const { db } = require("./db");
  const pm = db.prepare("SELECT * FROM pm_plans WHERE id=?").get(req.params.id);
  if (!pm) return res.status(404).json({ error: "not found" });
  const today = new Date().toISOString().slice(0,10);
  const next = new Date(Date.now() + pm.frequency_days*86400000).toISOString().slice(0,10);
  q.updatePMDone(req.params.id, today, next);
  res.json({ success: true, next_due: next });
});

// SPARE PARTS
app.get("/api/spare-parts", auth(), (req, res) => {
  res.json({ parts: q.allParts(), low_stock_count: q.lowStockParts().length });
});
app.post("/api/spare-parts", auth(["admin"]), (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return res.status(400).json({ error: "name required" });
    const result = q.insertPart({ part_no: d.part_no||null, name: d.name, category: d.category||"General", quantity: parseInt(d.quantity)||0, min_qty: parseInt(d.min_qty)||5, unit_cost: parseFloat(d.unit_cost)||0, location: d.location||"", supplier: d.supplier||"", notes: d.notes||"" });
    res.status(201).json({ id: result.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/spare-parts/:id/issue", auth(["admin","tech"]), (req, res) => {
  const { qty, wo_id, note } = req.body;
  const part = q.partById(req.params.id);
  if (!part) return res.status(404).json({ error: "not found" });
  if (!qty || qty <= 0 || part.quantity < qty) return res.status(400).json({ error: "invalid qty" });
  q.updatePartQty(req.params.id, -qty);
  const { db } = require("./db");
  db.prepare("INSERT INTO part_transactions(part_id,wo_id,type,qty,note,created_by) VALUES(?,?,?,?,?,?)").run(req.params.id, wo_id||null, "issue", qty, note||"", req.user.name);
  const updated = q.partById(req.params.id);
  if (updated.quantity <= updated.min_qty) notifyLowStock(updated).catch(console.error);
  res.json({ success: true, remaining: updated.quantity });
});
app.post("/api/spare-parts/:id/receive", auth(["admin"]), (req, res) => {
  const { qty, note } = req.body;
  if (!qty || qty <= 0) return res.status(400).json({ error: "invalid" });
  q.updatePartQty(req.params.id, qty);
  const { db } = require("./db");
  db.prepare("INSERT INTO part_transactions(part_id,type,qty,note,created_by) VALUES(?,?,?,?,?)").run(req.params.id, "receive", qty, note||"", req.user.name);
  res.json({ success: true, quantity: q.partById(req.params.id).quantity });
});

// KPI
app.get("/api/kpi/summary", auth(), (req, res) => {
  const { db } = require("./db");
  const summary = q.kpiSummary();
  const monthly = db.prepare(`SELECT strftime('%Y-%m',created_at) AS month,COUNT(*) AS total,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,AVG(CASE WHEN labor_hours>0 THEN labor_hours END) AS avg_mttr FROM work_orders GROUP BY month ORDER BY month DESC LIMIT 6`).all();
  const byPriority = db.prepare("SELECT priority,COUNT(*) AS n FROM work_orders GROUP BY priority").all();
  const byType = db.prepare("SELECT type,COUNT(*) AS n FROM work_orders GROUP BY type").all();
  res.json({ summary, monthly, byPriority, byType });
});
app.get("/api/kpi/assets", auth(), (req, res) => {
  const { db } = require("./db");
  res.json(db.prepare("SELECT a.id,a.code,a.name,a.type,a.health_score,a.status,COUNT(w.id) AS total_wo,SUM(CASE WHEN w.status='completed' THEN 1 ELSE 0 END) AS completed_wo,AVG(CASE WHEN w.labor_hours>0 THEN w.labor_hours END) AS avg_mttr FROM assets a LEFT JOIN work_orders w ON a.id=w.asset_id GROUP BY a.id ORDER BY a.health_score ASC").all());
});

// NOTIFICATIONS
app.get("/api/notifications", auth(), (req, res) => {
  res.json({ notifications: q.allNotifications(), unread: q.unreadCount() });
});
app.post("/api/notifications/:id/read", auth(), (req, res) => {
  q.markRead(req.params.id);
  res.json({ success: true });
});

// HEALTH
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "CMMS PRO", version: "3.0.0", time: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }), timezone: "Asia/Bangkok" });
});

// SPA FALLBACK
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n\u1F990 CMMS PRO v3.0 running on port ${PORT}`);
  console.log(`   Time zone : Asia/Bangkok`);
  startSLAChecker();
});
