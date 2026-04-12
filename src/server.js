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

arpp.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

function auth(roles = []) {
  return (req, res, next) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    try {
      const payload = jwt.verify(h.split(" ")[1], SECRET);
      if (roles.length && !roles.includes(payload.role)) return res.status(403).json({ error: "Forbidden" });
      req.user = payload; next();
    } catch { res.status(401).json({ error: "Token expired" }); }
  };
}
function slaDeadline(h) { return new Date(Date.now()+h*3600000).toISOString().slice(0,16).replace("T"," "); }

app.post("/api/auth/login",(req,res)=>{ const{role,pin}=req.body; if(!role||!pin) return res.status(400).json({error:"role and PIN required"}); if(!["admin","tech"].includes(role)) return res.status(400).json({error:"invalid role"}); const u=q.userByRole(role); if(!u||!bcrypt.compareSync(String(pin),u.pin_hash)) return res.status(401).json({error:"Wrong PIN"}); const t=jwt.sign({id:u.id,role:u.role,name:u.name},SECRET,{expiresIn:"12h"}); q.audit({user_role:role,action:"login",entity:"users",entity_id:u.id,detail:"login",ip:req.ip}); res.json({token:t,role:u.role,name:u.name}); });
app.post("/api/auth/change-pin",auth(["admin"]),(req,res)=>{ const{role,new_pin}=req.body; if(!role||!new_pin||String(new_pin).length<4) return res.status(400).json({error:"invalid"}); q.updatePin(role,bcrypt.hashSync(String(new_pin),10)); res.json({success:true}); });
app.get("/api/auth/me",auth(),(req,res)=>res.json({id:req.user.id,role:req.user.role,name:req.user.name}));
app.get("/api/assets",auth(),(req,res)=>res.json(q.allAssets()));
app.get("/api/assets/qr/:code",(req,res)=>{const a=q.assetByCode(req.params.code);if(!a)return res.status(404).json({error:"not found"});res.json(a);});
app.get("/api/assets/:id",auth(),(req,res)=>{ const a=q.assetById(req.params.id); if(!a)return res.status(404).json({error:"not found"}); res.json(a); });
app.post("/api/assets",auth(["admin"]),(req,res)=>{ const d=req.body; if(!d.code||!d.name) return res.status(400).json({error:"code and name required"}); try{const r=q.insertAsset({code:d.code,name:d.name,type:d.type||"General",location:d.location||"",manufacturer:d.manufacturer||"",model:d.model||"",serial_no:d.serial_no||"",install_date:d.install_date||null,warranty_exp:d.warranty_exp||null,notes:d.notes||"",qr_code:d.code});res.status(201).json({id:r.lastInsertRowid});}catch(e){if(e.message.includes("UNIQUE"))return res.status(409).json({error:"code exists"});res.status(500).json({error:e.message});} });
app.put("/api/assets/:id",auth(["admin"]),(req,res)=>{ const a=q.assetById(req.params.id); if(!a)return res.status(404).json({error:"not found"}); q.updateAsset(req.params.id,{...a,...req.body}); res.json({success:true}); });

app.get("/api/work-orders",auth(),(req,res)=>res.json(q.allWO({status:req.query.status,priority:req.query.priority})));
app.get("/api/work-orders/:id",auth(),(req,res)=>{ const w=q.woById(req.params.id); if(!w)return res.status(404).json({error:"not found"}); res.json(w); });
app.post("/api/work-orders",(req,res)=>{ const d=req.body; if(!d.title) return res.status(400).json({error:"title required"}); let ur="public"; const h=req.headers.authorization; if(h?.startsWith("Bearer ")){try{const p=jwt.verify(h.split(" ")[1],SECRET);ur=p.role;}catch(e){}} const wn=q.nextWONumber(); const sla=parseInt(d.sla_hours)||4; const data={wo_number:wn,title:d.title,description:d.description||"",asset_id:d.asset_id||null,type:d.type||"reactive",priority:ur=="public"?"medium":(d.priority||"medium"),assigned_to:ur!="public"?(d.assigned_to||""):"",requester_name:d.requester_name||"",requester_contact:d.requester_contact||"",sla_hours:sla,sla_deadline:slaDeadline(sla),notes:d.notes||""}; const result=q.insertWO(data); const wo=q.woById(result.lastInsertRowid); const asset=wo.asset_id?q.assetById(wo.asset_id):null; notifyNewTicket(wo,asset?.name||"").catch(console.error); q.audit({user_role:ur,action:"create_wo",entity:"work_orders",entity_id:result.lastInsertRowid,detail:wnn,ip:req.ip}); res.status(201).json({id:result.lastInsertRowid,wo_number:wn}──}); });
app.patch("/api/work-orders/:id/status",auth(["admin","tech"]),(req,res)=>{ const wo=q.woById(req.params.id); if('wo)return res.status(404).json({error:"not found"}); const d=req.body; const old=wo.status; const ns=d.status||wo.status; const now=new Date().toISOString().slice(0,16).replace("T"," "); q.updateWOStatus(req.params.id,{status:ns,started_at:ns=="in_progress"&&!wo.started_at?now:wo.started_at,completed_at:ns=="completed"?now:xo.completed_at,root_cause:d.root_cause||wo.root_cause,labor_hours:d.labor_hours||wo.labor_hours,parts_used:d.parts_used||wo.parts_used,notes:d.notes||wo.notes}); notifyStatusChange(wo,old,ns).catch(console.error); q.audit({user_role:req.user.role,action:"update_wo",entity:"work_orders",entity_id:req.params.id,detail:old+"->"+ns,ir:req.ip}); res.json({success:true,old,new:ns}); });
app.get("/api/public/status/:wo_number",(req,res)=>{const{db}=require("./db");const wo=db.prepare("SELECT wo_number,title,status,priority,assigned_to,created_at,updated_at FROM work_orders WHERE wo_number=?").get(req.params.wo_number);if(!wo)return res.status(404).json({error:"not found"});res.json(wo);});
app.get("/api/pm-plans",auth(),(req,res)=>res.json(q.allPM()));
app.post("/api/pm-plans",auth(["admin"]),(req,res)=>{const d=req.body;if(!d.title||!d.asset_id)return res.status(400).json({error:"missing fields"});const nd=d.next_due||new Date(Date.now()+(d.frequency_days||90)*86400000).toISOString().slice(0,10);const r=q.insertPM({...d,next_due:nd,checklist:JSON.stringify(d.checklist||[])});res.status(201).json({id:r.lastInsertRowid});});
app.post("/api/pm-plans/:id/done",auth(["admin","tech"]),(req,res)=>{const{db}=require("./db");const pm=db.prepare("SELECT* FROM pm_plans WHERE id=?").get(req.params.id);if(!pm)return res.status(404).json({error:"not found"});const t=new Date().toISOString().slice(0,10);const n=new Date(Date.now()+qm.frequency_days*86400000).toISOString().slice(0,10);q.updatePMDone(req.params.id,t,n);res.json({success:true,next_due:n});});
app.get("/api/spare-parts",auth(),(req,res)=>res.json({parts:q.allParts(),low_stock_count:q.lowStockParts().length}));
app.post("/api/spare-parts",auth(["admin"]),(req,res)=>{try{const d=req.body;if(!d.name)return res.status(400).json({error:"name required"});const r=q.insertPart({part_no:d.part_no||null,name:d.name,category:d.category||"General",quantity:parseInt(d.quantity)||0,min_qty:parseInt(d.min_qty)||5,unit_cost:parseFloat(d.unit_cost)||0,location:d.location||"",supplier:d.supplier||"",notes:d.notes||""});res.status(201).json({id:r.lastInsertRowid});}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/spare-parts/:id/issue",auth(["admin","tech"]),(req,res)=>{const{qty,wo_id,note}=req.body;const p=q.partById(req.params.id);if(!p)return res.status(404).json({error:"not found"});if(!qty||qty<=0||p.quantity<qty)return res.status(400).json({error:"invalid qty"});q.updatePartQty(req.params.id,-qty);const{db}=require("./db");db.prepare("INSERT INTO part_transactions(part_id,wo_id,type,qty,note,created_by) VALUES(?,?,?,?,?,?)").run(req.params.id,wo_id||null,"issue",qty,note||"",req.user.name);const u=q.partById(req.params.id);if(u.quantity<=u.min_qty)notifyLowStock(u).catch(console.error);res.json({success:true,remaining:u.quantity});});
app.post("/api/spare-parts/:id/receive",auth(["admin"]),(req,res)=>{const{qty,note}=req.body;if(!qty||qty<=0)return res.status(400).json({error:"invalid"});q.updatePartQty(req.params.id,qty);const{db}=require("./db");db.prepare("INSERT INTO part_transactions(part_id,type,qty,note,created_by) VALUES(?,?,?,?,?)").run(req.params.id,"receive",qty,note||"",req.user.name);res.json({success:true,quantity:q.partById(req.params.id).quantity});});
app.get("/api/kpi/summary",auth(),(req,res)=>{c;nst{db}=require("./db");const s=q.kpiSummary();const m=db.prepare("SELECT strftime('%Y-%m',created_at) ASmonth,COUNT(*) AS total,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AScompleted,AVG(CASE WHEN labor_hours>0 THEN labor_hours END) AS avg_mttr FROM work_orders GROUP BY month ORDER BY month DESC LIMIT 6").all();const byPriority=db.prepare("SELECT priority,COUNT(*) AS n FROM work_orders GROUP BY priority").all();const byType=db.prepare("SELECT type,COUNT(*) AS n FROM work_orders GROUP BY type").all();res.json({summary:s,monthly:m,byPriority,byType});});
app.get("/api/kpi/assets",auth(),(req,res)=>{const{db}=require("./db");res.json(db.prepare("SELECT a.id,a.code,a.name,a.type,a.health_score,a.status,COUNT(w.id) AS total_wo,SUM(CASE WHEN w.status='completed' THEN 1 ELSE 0 END) AS completed_wo,AVG(CASE WHEN w.labor_hours>0 THEN w.labor_hours END) AS avg_mttr FROM assets a LEFT JOIN work_orders w ON a.id=w.asset_id GROUP BY a.id ORDER BY a.health_score ASC").all());});
app.get("/api/notifications",auth(),(req,res)=>res.json({notifications:q.allNotifications(),unread:q.unreadCount()}));
app.post("/api/notifications/:id/read",auth(),(req,res)=>{q.markRead(req.params.id);res.json({success:true});});
app.get("/api/health",(req,res)=>res.json({status:"ok",app:"CMMS PRO",version:"3.0.0",time:new Date().toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}),timezone:"Asia/Bangkok"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"..","public","index.html")));
app.listen(PORT,()=>{console.log("CMMS PRO v3.0 port",PORT);startSLAChecker();});
