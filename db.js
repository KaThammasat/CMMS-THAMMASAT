"use strict";
const Database = require("better-sqlite3");
const bcrypt   = require("bcryptjs");
const path     = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "cmms.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* ── Schema ── */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  role      TEXT NOT NULL UNIQUE,          -- 'admin' | 'tech'
  name      TEXT NOT NULL,
  pin_hash  TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS assets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'General',
  location     TEXT,
  manufacturer TEXT,
  model        TEXT,
  serial_no    TEXT,
  install_date TEXT,
  warranty_exp TEXT,
  status       TEXT DEFAULT 'active',
  health_score REAL DEFAULT 100,
  qr_code      TEXT,
  notes        TEXT,
  created_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS work_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  wo_number    TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  description  TEXT,
  asset_id     INTEGER REFERENCES assets(id),
  type         TEXT DEFAULT 'reactive',
  priority     TEXT DEFAULT 'medium',
  status       TEXT DEFAULT 'open',
  assigned_to  TEXT,
  requester_name TEXT,
  requester_contact TEXT,
  sla_hours    INTEGER DEFAULT 4,
  sla_deadline TEXT,
  started_at   TEXT,
  completed_at TEXT,
  root_cause   TEXT,
  labor_hours  REAL,
  parts_used   TEXT,
  notes        TEXT,
  created_at   TEXT DEFAULT (datetime('now','localtime')),
  updated_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pm_plans (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id       INTEGER REFERENCES assets(id),
  title          TEXT NOT NULL,
  description    TEXT,
  frequency_days INTEGER NOT NULL DEFAULT 90,
  last_done      TEXT,
  next_due       TEXT,
  assigned_to    TEXT,
  checklist      TEXT,
  status         TEXT DEFAULT 'active',
  created_at     TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS spare_parts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  part_no     TEXT UNIQUE,
  name        TEXT NOT NULL,
  category    TEXT,
  quantity    INTEGER DEFAULT 0,
  min_qty     INTEGER DEFAULT 5,
  unit_cost   REAL DEFAULT 0,
  location    TEXT,
  supplier    TEXT,
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS part_transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id    INTEGER REFERENCES spare_parts(id),
  wo_id      INTEGER REFERENCES work_orders(id),
  type       TEXT NOT NULL,          -- 'issue' | 'receive' | 'adjust'
  qty        INTEGER NOT NULL,
  note       TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_role  TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  INTEGER,
  detail     TEXT,
  ip         TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT,
  title      TEXT,
  message    TEXT,
  is_read    INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  total_wo    INTEGER DEFAULT 0,
  open_wo     INTEGER DEFAULT 0,
  completed   INTEGER DEFAULT 0,
  overdue     INTEGER DEFAULT 0,
  avg_mttr_h  REAL DEFAULT 0,
  availability REAL DEFAULT 100,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
`);

/* ── Seed default users ── */
function seedUsers() {
  const exists = db.prepare("SELECT id FROM users WHERE role='admin'").get();
  if (!exists) {
    const adminHash = bcrypt.hashSync("1234", 10);
    const techHash  = bcrypt.hashSync("5678", 10);
    db.prepare("INSERT INTO users(role,name,pin_hash) VALUES(?,?,?)").run("admin","Admin CMMS",adminHash);
    db.prepare("INSERT INTO users(role,name,pin_hash) VALUES(?,?,?)").run("tech","Somchai J.",techHash);
    console.log("[DB] Seeded default users: admin/1234, tech/5678");
  }
}

/* ── Seed sample assets ── */
function seedAssets() {
  const exists = db.prepare("SELECT id FROM assets LIMIT 1").get();
  if (!exists) {
    const assets = [
      ["PUMP-01","Coolant Pump","Mechanical","Zone A","ITT","3x3","MTU-0842","2019-03-15","2024-03-15","active",92],
      ["UPS-A3","UPS Unit A3","Power","Zone B","Eaton","9PX","APC-1147","2020-08-01","2025-08-01","active",42],
      ["CRAC-01","CRAC Unit 1","HVAC","Zone A","Stulz","CyberAir","LEN-0421","2021-01-10","2026-01-10","active",88],
      ["CRAC-02","CRAC Unit 2","HVAC","Zone C","Stulz","CyberAir","LEN-0563","2021-06-20","2026-06-20","active",74],
      ["GEN-01","Generator G-01","Generator","Rooftop","CAT","C18","CAT-0291","2018-05-01","2023-05-01","active",88],
      ["PDU-B2","PDU Row B2","Electrical","Zone B","Raritan","PX3","RAR-2201","2022-03-01","2027-03-01","active",95],
    ];
    const ins = db.prepare("INSERT INTO assets(code,name,type,location,manufacturer,model,serial_no,install_date,warranty_exp,status,health_score) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
    assets.forEach(a => ins.run(...a));
    console.log("[DB] Seeded sample assets");
  }
}

/* ── Seed sample work orders ── */
function seedWO() {
  const exists = db.prepare("SELECT id FROM work_orders LIMIT 1").get();
  if (!exists) {
    const now  = new Date();
    const ago2 = new Date(now - 2*3600000).toISOString().slice(0,16).replace("T"," ");
    const wos = [
      ["WO-2024-001","PUMP-01 — แบริ่งสั่นผิดปกติ","ค่าสั่นสะเทือน 4.8mm/s เกินค่ากำหนด",1,"reactive","critical","overdue","Krit T.","",4,ago2,null,null,null,null,null,null],
      ["WO-2024-002","CRAC-02 — ทำความสะอาด Filter","PM ประจำไตรมาส",4,"preventive","high","in_progress","Nong S.","",8,null,null,null,null,null,null,null],
      ["WO-2024-003","GEN-01 — PM รายเดือน","ตรวจสอบน้ำมันและระบบทำความเย็น",5,"preventive","high","open","Tan W.","",8,null,null,null,null,null,null,null],
      ["WO-2024-004","Fire Suppression — Quarterly Test","ทดสอบระบบดับเพลิง",null,"preventive","medium","completed","Praew K.","",4,null,null,null,"System passed","2.0",null,null],
    ];
    const ins = db.prepare(`INSERT INTO work_orders(wo_number,title,description,asset_id,type,priority,status,assigned_to,requester_name,sla_hours,sla_deadline,started_at,completed_at,root_cause,labor_hours,parts_used,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    wos.forEach(w => ins.run(...w));
    console.log("[DB] Seeded sample work orders");
  }
}

/* ── Seed spare parts ── */
function seedParts() {
  const exists = db.prepare("SELECT id FROM spare_parts LIMIT 1").get();
  if (!exists) {
    const parts = [
      ["BRG-6205","Bearing 6205-2RS","Bearing",12,5,350,"Shelf A-1","SKF",""],
      ["BELT-B50","V-Belt B50","Belt",8,3,280,"Shelf A-2","Gates",""],
      ["FILT-HEPA","HEPA Filter 24x24","Filter",6,4,1200,"Shelf B-1","Camfil",""],
      ["FUSE-32A","Fuse 32A","Electrical",20,10,85,"Shelf C-1","Legrand",""],
      ["OIL-SAE30","Engine Oil SAE30 1L","Oil",15,5,320,"Shelf D-1","Shell",""],
      ["BAT-12V40","Battery 12V 40Ah","Battery",4,2,2800,"Shelf E-1","GS",""],
    ];
    const ins = db.prepare("INSERT INTO spare_parts(part_no,name,category,quantity,min_qty,unit_cost,location,supplier,notes) VALUES(?,?,?,?,?,?,?,?,?)");
    parts.forEach(p => ins.run(...p));
    console.log("[DB] Seeded spare parts");
  }
}

seedUsers();
seedAssets();
seedWO();
seedParts();

/* ── Query helpers ── */
const q = {
  // Users
  userByRole:   (role)     => db.prepare("SELECT * FROM users WHERE role=?").get(role),
  updatePin:    (role,hash) => db.prepare("UPDATE users SET pin_hash=? WHERE role=?").run(hash, role),

  // Assets
  allAssets:    ()         => db.prepare("SELECT * FROM assets ORDER BY type,name").all(),
  assetById:    (id)       => db.prepare("SELECT * FROM assets WHERE id=?").get(id),
  assetByCode:  (code)     => db.prepare("SELECT * FROM assets WHERE code=?").get(code),
  insertAsset:  (d)        => db.prepare("INSERT INTO assets(code,name,type,location,manufacturer,model,serial_no,install_date,warranty_exp,notes) VALUES(@code,@name,@type,@location,@manufacturer,@model,@serial_no,@install_date,@warranty_exp,@notes)").run(d),
  updateAsset:  (id,d)     => db.prepare("UPDATE assets SET name=@name,type=@type,location=@location,manufacturer=@manufacturer,model=@model,serial_no=@serial_no,install_date=@install_date,warranty_exp=@warranty_exp,health_score=@health_score,status=@status,notes=@notes,qr_code=@qr_code WHERE id=@id").run({...d,id}),

  // Work Orders
  allWO:        (filters)  => {
    let sql = `SELECT w.*,a.name AS asset_name,a.code AS asset_code,a.type AS asset_type FROM work_orders w LEFT JOIN assets a ON w.asset_id=a.id`;
    const conds=[]; const vals=[];
    if(filters?.status){conds.push("w.status=?");vals.push(filters.status);}
    if(filters?.priority){conds.push("w.priority=?");vals.push(filters.priority);}
    if(conds.length) sql += " WHERE "+conds.join(" AND ");
    sql += " ORDER BY CASE w.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, w.created_at DESC";
    return db.prepare(sql).all(...vals);
  },
  woById:       (id)       => db.prepare("SELECT w.*,a.name AS asset_name,a.code AS asset_code FROM work_orders w LEFT JOIN assets a ON w.asset_id=a.id WHERE w.id=?").get(id),
  nextWONumber: ()         => {
    const yr = new Date().getFullYear();
    const last = db.prepare("SELECT wo_number FROM work_orders WHERE wo_number LIKE ? ORDER BY id DESC LIMIT 1").get(`WO-${yr}-%`);
    if(!last) return `WO-${yr}-001`;
    const num = parseInt(last.wo_number.split("-").pop())+1;
    return `WO-${yr}-${String(num).padStart(3,"0")}`;
  },
  insertWO:     (d)        => db.prepare("INSERT INTO work_orders(wo_number,title,description,asset_id,type,priority,assigned_to,requester_name,requester_contact,sla_hours,sla_deadline,notes) VALUES(@wo_number,@title,@description,@asset_id,@type,@priority,@assigned_to,@requester_name,@requester_contact,@sla_hours,@sla_deadline,@notes)").run(d),
  updateWOStatus:(id,data) => db.prepare("UPDATE work_orders SET status=@status,started_at=@started_at,completed_at=@completed_at,root_cause=@root_cause,labor_hours=@labor_hours,parts_used=@parts_used,notes=@notes,updated_at=datetime('now','localtime') WHERE id=@id").run({...data,id}),

  // PM Plans
  allPM:        ()         => db.prepare("SELECT p.*,a.name AS asset_name,a.code AS asset_code FROM pm_plans p LEFT JOIN assets a ON p.asset_id=a.id ORDER BY p.next_due ASC").all(),
  insertPM:     (d)        => db.prepare("INSERT INTO pm_plans(asset_id,title,description,frequency_days,last_done,next_due,assigned_to,checklist) VALUES(@asset_id,@title,@description,@frequency_days,@last_done,@next_due,@assigned_to,@checklist)").run(d),
  updatePMDone: (id,done,next) => db.prepare("UPDATE pm_plans SET last_done=?,next_due=? WHERE id=?").run(done,next,id),

  // Spare Parts
  allParts:     ()         => db.prepare("SELECT * FROM spare_parts ORDER BY category,name").all(),
  partById:     (id)       => db.prepare("SELECT * FROM spare_parts WHERE id=?").get(id),
  insertPart:   (d)        => db.prepare("INSERT INTO spare_parts(part_no,name,category,quantity,min_qty,unit_cost,location,supplier,notes) VALUES(@part_no,@name,@category,@quantity,@min_qty,@unit_cost,@location,@supplier,@notes)").run(d),
  updatePartQty:(id,delta) => db.prepare("UPDATE spare_parts SET quantity=quantity+? WHERE id=?").run(delta,id),
  lowStockParts:()         => db.prepare("SELECT * FROM spare_parts WHERE quantity<=min_qty").all(),

  // KPIs
  kpiSummary: () => {
    const total    = db.prepare("SELECT COUNT(*) AS n FROM work_orders").get().n;
    const open     = db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE status='open'").get().n;
    const inprog   = db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE status='in_progress'").get().n;
    const completed= db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE status='completed'").get().n;
    const overdue  = db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE status='overdue'").get().n;
    const avgMttr  = db.prepare("SELECT AVG(labor_hours) AS h FROM work_orders WHERE status='completed' AND labor_hours>0").get().h || 0;
    const assets   = db.prepare("SELECT COUNT(*) AS n FROM assets WHERE status='active'").get().n;
    const critical = db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE priority='critical' AND status NOT IN ('completed','cancelled')").get().n;
    return { total, open, inprog, completed, overdue, avgMttr: +avgMttr.toFixed(1), assets, critical };
  },

  // Audit
  audit: (data) => db.prepare("INSERT INTO audit_logs(user_role,action,entity,entity_id,detail,ip) VALUES(@user_role,@action,@entity,@entity_id,@detail,@ip)").run(data),

  // Notifications
  allNotifications: () => db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50").all(),
  addNotification:  (d) => db.prepare("INSERT INTO notifications(type,title,message) VALUES(@type,@title,@message)").run(d),
  markRead:         (id) => db.prepare("UPDATE notifications SET is_read=1 WHERE id=?").run(id),
  unreadCount:      () => db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE is_read=0").get().n,
};

module.exports = { db, q };
