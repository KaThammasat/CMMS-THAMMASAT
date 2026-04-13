"use strict";
const Database = require("better-sqlite3");
const bcrypt   = require("bcryptjs");
const path     = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "cmms.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  role      TEXT NOT NULL UNIQUE,
  name      TEXT NOT NULL,
  pin_hash  TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS assets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'General',
  location      TEXT,
  manufacturer  TEXT,
  model         TEXT,
  serial_no     TEXT,
  install_date  TEXT,
  warranty_exp  TEXT,
  status        TEXT DEFAULT 'active',
  health_score  REAL DEFAULT 100,
  qr_code       TEXT,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS work_orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  wo_number         TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  description       TEXT,
  asset_id          INTEGER REFERENCES assets(id),
  type              TEXT DEFAULT 'reactive',
  priority          TEXT DEFAULT 'medium',
  status            TEXT DEFAULT 'open',
  assigned_to       TEXT,
  requester_name    TEXT,
  requester_contact TEXT,
  sla_hours         INTEGER DEFAULT 4,
  sla_deadline      TEXT,
  started_at        TEXT,
  completed_at      TEXT,
  root_cause        TEXT,
  labor_hours       REAL,
  parts_used        TEXT,
  notes             TEXT,
  created_at        TEXT DEFAULT (datetime('now','localtime')),
  updated_at        TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS pm_plans (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id        INTEGER REFERENCES assets(id),
  title           TEXT NOT NULL,
  description     TEXT,
  frequency_days  INTEGER NOT NULL DEFAULT 90,
  last_done       TEXT,
  next_due        TEXT,
  assigned_to     TEXT,
  checklist       TEXT,
  status          TEXT DEFAULT 'active',
  created_at      TEXT DEFAULT (datetime('now','localtime'))
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
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id     INTEGER REFERENCES spare_parts(id),
  wo_id       INTEGER REFERENCES work_orders(id),
  type        TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  note        TEXT,
  created_by  TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_role   TEXT,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   INTEGER,
  detail      TEXT,
  ip          TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT,
  title       TEXT,
  message     TEXT,
  is_read     INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
`);

function seedUsers() {
  if (!db.prepare("SELECT id FROM users WHERE role='admin'").get()) {
    db.prepare("INSERT INTO users(role,name,pin_hash) VALUES(?,?,?)").run("admin","Admin CMMS",bcrypt.hashSync("1234",10));
    db.prepare("INSERT INTO users(role,name,pin_hash) VALUES(?,?,?)").run("tech","Somchai J.",bcrypt.hashSync("5678",10));
    console.log("[DB] Seeded users: admin/1234, tech/5678");
  }
}

function seedAssets() {
  if (!db.prepare("SELECT id FROM assets LIMIT 1").get()) {
    const ins = db.prepare("INSERT INTO assets(code,name,type,location,manufacturer,model,serial_no,install_date,warranty_exp,status,health_score) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
    [
      ["PUMP-01","Coolant Pump A","Mechanical","Zone A","ITT","3x3","MTU-0842","2019-03-15","2024-03-15","active",78],
      ["UPS-A3","UPS Unit A3","Power","Zone B","Eaton","9PX","APC-1147","2020-08-01","2025-08-01","active",42],
      ["CRAC-01","CRAC Unit 1","HVAC","Zone A","Stulz","CyberAir","LEN-0421","2021-01-10","2026-01-10","active",88],
      ["CRAC-02","CRAC Unit 2","HVAC","Zone C","Stulz","CyberAir","LEN-0563","2021-06-20","2026-06-20","active",74],
      ["GEN-01","Generator G-01","Generator","Rooftop","CAT","C18","CAT-0291","2018-05-01","2023-05-01","active",65],
      ["PDU-B2","PDU Row B2","Electrical","Zone B","Raritan","PX3","RAR-2201","2022-03-01","2027-03-01","active",95],
    ].forEach(a => ins.run(...a));
    console.log("[DB] Seeded assets");
  }
}

function seedParts() {
  if (!db.prepare("SELECT id FROM spare_parts LIMIT 1").get()) {
    const ins = db.prepare("INSERT INTO spare_parts(part_no,name,category,quantity,min_qty,unit_cost,location,supplier,notes) VALUES(?,?,?,?,?,?,?,?,?)");
    [
      ["BRG-6205","Bearing 6205-2RS","Bearing",12,5,350,"Shelf A-1","SKF",""],
      ["BELT-B50","V-Belt B50","Belt",3,3,280,"Shelf A-2","Gates",""],
      ["FILT-HEPA","HEPA Filter 24x24","Filter",6,4,1200,"Shelf B-1","Camfil",""],
      ["FUSE-32A","Fuse 32A","Electrical",20,10,85,"Shelf C-1","Legrand",""],
      ["OIL-SAE30","Engine Oil SAE30 1L","Oil",15,5,320,"Shelf D-1","Shell",""],
    ].forEach(p => ins.run(...p));
    console.log("[DB] Seeded parts");
  }
}

function seedWO() {
  if (!db.prepare("SELECT id FROM work_orders LIMIT 1").get()) {
    const ins = db.prepare(`INSERT INTO work_orders(wo_number,title,description,asset_id,type,priority,status,assigned_to,sla_hours,sla_deadline,started_at,completed_at,root_cause,labor_hours,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const now = new Date();
    const ago = (h) => new Date(now - h*3600000).toISOString().slice(0,16).replace('T',' ');
    const future = (h) => new Date(now.getTime() + h*3600000).toISOString().slice(0,16).replace('T',' ');
    [
      ["WO-2026-001","PUMP-01 - Coolant Pump Vibration High","Abnormal vibration detected at 4.8mm/s. Check bearing and alignment.",1,"reactive","critical","overdue","Somchai J.",4,ago(8),ago(8),null,null,null,"Urgent - may cause pump failure",ago(10)],
      ["WO-2026-002","CRAC-02 - Filter Replacement PM","Quarterly HEPA filter replacement per PM schedule.",4,"preventive","high","in_progress","Nong S.",8,future(4),ago(2),null,null,null,"",ago(5)],
      ["WO-2026-003","GEN-01 - Annual Load Test","Annual generator load test and oil change.",5,"preventive","high","open","Tan W.",8,future(48),null,null,null,null,"Schedule during low-demand period",ago(2)],
      ["WO-2026-004","Fire Suppression - Quarterly Test","Quarterly fire suppression system functional test.",null,"preventive","medium","completed","Praew K.",4,ago(20),ago(25),ago(1),"System passed all tests. Replaced 2 defective nozzles.",2.0,"All checks passed",ago(30)],
      ["WO-2026-005","UPS-A3 - Battery Capacity Test","UPS battery capacity degraded to 68%. Test and replace if needed.",2,"inspection","critical","open","Somchai J.",2,future(2),null,null,null,null,"Battery health critical",ago(1)],
      ["WO-2026-006","PDU-B2 - Outlet Inspection","Routine inspection of PDU outlets and connections.",6,"inspection","low","open","",8,future(72),null,null,null,null,"",ago(1)],
    ].forEach(w => ins.run(...w));
    console.log("[DB] Seeded work orders");
  }
}

function seedPM() {
  if (!db.prepare("SELECT id FROM pm_plans LIMIT 1").get()) {
    const ins = db.prepare("INSERT INTO pm_plans(asset_id,title,description,frequency_days,last_done,next_due,assigned_to,checklist) VALUES(?,?,?,?,?,?,?,?)");
    [
      [1,"PUMP-01 Monthly PM","Check bearings, lubrication, alignment, vibration",30,"2026-03-15","2026-04-15","Somchai J.","[]"],
      [2,"UPS-A3 Battery Test","Monthly battery capacity and runtime test",30,"2026-03-01","2026-04-01","Somchai J.","[]"],
      [3,"CRAC-01 Filter Change","Replace HEPA filter and clean coils",90,"2026-01-10","2026-04-10","Nong S.","[]"],
      [4,"CRAC-02 Filter Change","Replace HEPA filter and clean coils",90,"2026-01-20","2026-04-20","Nong S.","[]"],
      [5,"GEN-01 Annual Service","Oil change, filter, load test, battery",365,"2025-04-15","2026-04-15","Tan W.","[]"],
      [6,"PDU-B2 Inspection","Check all outlets, connections, load balancing",180,"2025-10-01","2026-04-01","","[]"],
    ].forEach(p => ins.run(...p));
    console.log("[DB] Seeded PM plans");
  }
}

seedUsers();
seedAssets();
seedParts();
seedWO();
seedPM();

const q = {
  userByRole:   (role)      => db.prepare("SELECT * FROM users WHERE role=?").get(role),
  updatePin:    (role,hash) => db.prepare("UPDATE users SET pin_hash=? WHERE role=?").run(hash,role),

  allAssets:    ()          => db.prepare("SELECT * FROM assets ORDER BY type,name").all(),
  assetById:    (id)        => db.prepare("SELECT * FROM assets WHERE id=?").get(id),
  assetByCode:  (code)      => db.prepare("SELECT * FROM assets WHERE code=?").get(code),
  insertAsset:  (d)         => db.prepare("INSERT INTO assets(code,name,type,location,manufacturer,model,serial_no,install_date,warranty_exp,notes) VALUES(@code,@name,@type,@location,@manufacturer,@model,@serial_no,@install_date,@warranty_exp,@notes)").run(d),
  updateAsset:  (id,d)      => db.prepare("UPDATE assets SET name=@name,type=@type,location=@location,manufacturer=@manufacturer,model=@model,serial_no=@serial_no,install_date=@install_date,warranty_exp=@warranty_exp,health_score=@health_score,status=@status,notes=@notes,qr_code=@qr_code WHERE id=@id").run({...d,id}),

  allWO: (filters) => {
    let sql = "SELECT w.*,a.name AS asset_name,a.code AS asset_code FROM work_orders w LEFT JOIN assets a ON w.asset_id=a.id";
    const conds=[],vals=[];
    if(filters?.status){conds.push("w.status=?");vals.push(filters.status);}
    if(filters?.priority){conds.push("w.priority=?");vals.push(filters.priority);}
    if(conds.length) sql+=" WHERE "+conds.join(" AND ");
    sql+=" ORDER BY CASE w.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, w.created_at DESC";
    return db.prepare(sql).all(...vals);
  },
  woById:       (id)        => db.prepare("SELECT w.*,a.name AS asset_name FROM work_orders w LEFT JOIN assets a ON w.asset_id=a.id WHERE w.id=?").get(id),
  nextWONumber: ()          => {
    const yr = new Date().getFullYear();
    const last = db.prepare("SELECT wo_number FROM work_orders WHERE wo_number LIKE ? ORDER BY id DESC LIMIT 1").get(`WO-${yr}-%`);
    if(!last) return `WO-${yr}-001`;
    return `WO-${yr}-${String(parseInt(last.wo_number.split("-").pop())+1).padStart(3,"0")}`;
  },
  insertWO:     (d)         => db.prepare("INSERT INTO work_orders(wo_number,title,description,asset_id,type,priority,assigned_to,requester_name,requester_contact,sla_hours,sla_deadline,notes) VALUES(@wo_number,@title,@description,@asset_id,@type,@priority,@assigned_to,@requester_name,@requester_contact,@sla_hours,@sla_deadline,@notes)").run(d),
  updateWOStatus:(id,d)     => db.prepare("UPDATE work_orders SET status=@status,started_at=@started_at,completed_at=@completed_at,root_cause=@root_cause,labor_hours=@labor_hours,parts_used=@parts_used,notes=@notes,updated_at=datetime('now','localtime') WHERE id=@id").run({...d,id}),

  allPM:        ()          => db.prepare("SELECT p.*,a.name AS asset_name,a.code AS asset_code FROM pm_plans p LEFT JOIN assets a ON p.asset_id=a.id ORDER BY p.next_due ASC").all(),
  insertPM:     (d)         => db.prepare("INSERT INTO pm_plans(asset_id,title,description,frequency_days,last_done,next_due,assigned_to,checklist) VALUES(@asset_id,@title,@description,@frequency_days,@last_done,@next_due,@assigned_to,@checklist)").run(d),
  updatePMDone: (id,done,next) => db.prepare("UPDATE pm_plans SET last_done=?,next_due=? WHERE id=?").run(done,next,id),

  allParts:     ()          => db.prepare("SELECT * FROM spare_parts ORDER BY category,name").all(),
  partById:     (id)        => db.prepare("SELECT * FROM spare_parts WHERE id=?").get(id),
  insertPart:   (d)         => db.prepare("INSERT INTO spare_parts(part_no,name,category,quantity,min_qty,unit_cost,location,supplier,notes) VALUES(@part_no,@name,@category,@quantity,@min_qty,@unit_cost,@location,@supplier,@notes)").run(d),
  updatePartQty:(id,delta)  => db.prepare("UPDATE spare_parts SET quantity=quantity+? WHERE id=?").run(delta,id),
  lowStockParts:()          => db.prepare("SELECT * FROM spare_parts WHERE quantity<=min_qty").all(),

  kpiSummary: () => ({
    total:     db.prepare("SELECT COUNT(*) AS n FROM work_orders").get().n,
    open:      db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE status='open'").get().n,
    inprog:    db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE status='in_progress'").get().n,
    completed: db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE status='completed'").get().n,
    overdue:   db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE status='overdue'").get().n,
    avgMttr:   +(db.prepare("SELECT AVG(labor_hours) AS h FROM work_orders WHERE status='completed' AND labor_hours>0").get().h||0).toFixed(1),
    assets:    db.prepare("SELECT COUNT(*) AS n FROM assets WHERE status='active'").get().n,
    critical:  db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE priority='critical' AND status NOT IN ('completed','cancelled')").get().n,
  }),

  audit: (d) => db.prepare("INSERT INTO audit_logs(user_role,action,entity,entity_id,detail,ip) VALUES(@user_role,@action,@entity,@entity_id,@detail,@ip)").run(d),

  allNotifications: () => db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50").all(),
  addNotification:  (d) => db.prepare("INSERT INTO notifications(type,title,message) VALUES(@type,@title,@message)").run(d),
  markRead:         (id) => db.prepare("UPDATE notifications SET is_read=1 WHERE id=?").run(id),
  unreadCount:      () => db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE is_read=0").get().n,
};

module.exports = { db, q };
