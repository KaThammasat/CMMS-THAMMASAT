"use strict";
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const jwt     = require("jsonwebtoken");
const bcrypt  = require("bcryptjs");
const path    = require("path");

const { q }  = require("./db");
const { notifyNewTicket, notifyStatusChange } = require("./notify");

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "cmms-dev-secret-change-me";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

/* ── ID Generators ──────────────────────────────── */
const genTicketId = () => {
  const last = q.ticketList("1=1")[0];
  if (!last) return "WO-0001";
  return "WO-" + String(parseInt(last.id.replace("WO-",""))+1).padStart(4,"0");
};
const genPMId = () => {
  const list = q.pmList();
  if (!list.length) return "PM-001";
  return "PM-" + String(Math.max(...list.map(p=>parseInt(p.id.replace("PM-",""))||0))+1).padStart(3,"0");
};
const genSpareId = () => {
  const list = q.spareList();
  if (!list.length) return "SP-001";
  return "SP-" + String(Math.max(...list.map(p=>parseInt(p.id.replace("SP-",""))||0))+1).padStart(3,"0");
};

/* ── Auth Middleware ────────────────────────────── */
function auth(roles=[]) {
  return (req, res, next) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) return res.status(401).json({error:"ไม่ได้ login"});
    try {
      const payload = jwt.verify(h.split(" ")[1], SECRET);
      if (roles.length && !roles.includes(payload.role))
        return res.status(403).json({error:"ไม่มีสิทธิ์"});
      req.user = payload;
      next();
    } catch { res.status(401).json({error:"Token หมดอายุ"}); }
  };
}

/* ══ AUTH ══════════════════════════════════════════ */
app.post("/api/auth/login", (req, res) => {
  const { role, pin } = req.body;
  if (!role||!pin) return res.status(400).json({error:"กรุณาระบุ role และ PIN"});
  if (!["admin","tech"].includes(role)) return res.status(400).json({error:"role ไม่ถูกต้อง"});
  const user = q.userByRole(role);
  if (!user||!bcrypt.compareSync(String(pin), user.pin_hash))
    return res.status(401).json({error:"PIN ไม่ถูกต้อง"});
  const token = jwt.sign({id:user.id,role:user.role,name:user.name}, SECRET, {expiresIn:"12h"});
  res.json({token, role:user.role, name:user.name});
});

app.post("/api/auth/change-pin", auth(["admin"]), (req, res) => {
  const { role, new_pin } = req.body;
  if (!["admin","tech"].includes(role)) return res.status(400).json({error:"role ไม่ถูกต้อง"});
  if (!new_pin||String(new_pin).length<4) return res.status(400).json({error:"PIN ต้องมีอย่างน้อย 4 หลัก"});
  const { db } = require("./db");
  db.prepare("UPDATE users SET pin_hash=? WHERE role=?").run(bcrypt.hashSync(String(new_pin),10), role);
  res.json({ok:true});
});

/* ══ STATS / KPI ════════════════════════════════════ */
app.get("/api/stats", auth(), (req, res) => res.json(q.stats()));
app.get("/api/kpi",   auth(["admin"]), (req, res) => res.json(q.kpi()));

/* ══ SETTINGS ══════════════════════════════════════ */
app.get("/api/settings", auth(["admin"]), (req, res) => res.json(q.settingAll()));
app.put("/api/settings", auth(["admin"]), (req, res) => {
  const data = req.body;
  for (const [k,v] of Object.entries(data)) q.settingSet(k, String(v));
  res.json(q.settingAll());
});

/* ══ TICKETS ════════════════════════════════════════ */
app.get("/api/tickets", auth(), (req, res) => {
  const {status,priority,type,q:srch} = req.query;
  let where="1=1"; const params=[];
  if(status)   {where+=" AND status=?";   params.push(status);}
  if(priority) {where+=" AND priority=?"; params.push(priority);}
  if(type)     {where+=" AND type=?";     params.push(type);}
  if(srch)     {where+=" AND (title LIKE ? OR id LIKE ? OR location LIKE ? OR reporter LIKE ?)"; const w=`%${srch}%`; params.push(w,w,w,w);}
  res.json(q.ticketList(where,params));
});

app.get("/api/tickets/:id", auth(), (req, res) => {
  const t = q.ticketOne(req.params.id);
  if(!t) return res.status(404).json({error:"ไม่พบ"});
  res.json({...t, timeline:q.ticketTimeline(t.id)});
});

app.post("/api/tickets", (req, res) => {
  const {title,location,type,priority,reporter,phone,dept,assigned_to,due_date,description} = req.body;
  if(!title||!location||!type||!priority||!reporter||!description)
    return res.status(400).json({error:"กรุณากรอกข้อมูลให้ครบ"});
  const id = genTicketId();
  q.ticketInsert.run({id,title,location,type,priority,reporter,phone:phone||"",dept:dept||"",assigned_to:assigned_to||"",due_date:due_date||"",description});
  let source="แจ้งซ่อมผ่าน User Portal";
  if(req.headers.authorization){
    try{const p=jwt.verify(req.headers.authorization.split(" ")[1],SECRET);source="แจ้งซ่อมโดย "+(p.role==="admin"?"Admin":"Technician Team");}catch(_){}
  }
  q.timelineInsert.run(id,source,"acc",reporter);
  notifyNewTicket({id,title,location,type,priority,reporter,phone,description});
  res.status(201).json({...q.ticketOne(id),timeline:q.ticketTimeline(id)});
});

app.patch("/api/tickets/:id/status", auth(["admin","tech"]), (req, res) => {
  const {status} = req.body;
  if(!["open","in-progress","done","pending"].includes(status)) return res.status(400).json({error:"สถานะไม่ถูกต้อง"});
  const patch={status};
  if(status==="done") patch.closed_at=new Date().toLocaleString("th-TH",{hour12:false});
  q.ticketUpdate(req.params.id, patch);
  const lbls={done:"ปิดงานเรียบร้อย","in-progress":"เริ่มดำเนินการซ่อม",pending:"รอชิ้นส่วน/อะไหล่",open:"เปิดงานใหม่"};
  const typs={done:"done","in-progress":"acc",pending:"warn",open:"acc"};
  q.timelineInsert.run(req.params.id,lbls[status],typs[status],req.user.name);
  const t=q.ticketOne(req.params.id);
  notifyStatusChange(t,status,req.user.name);
  res.json({...t,timeline:q.ticketTimeline(t.id)});
});

app.patch("/api/tickets/:id/assign", auth(["admin"]), (req, res) => {
  const {assigned_to,due_date} = req.body;
  const patch={};
  if(assigned_to!==undefined) patch.assigned_to=assigned_to;
  if(due_date!==undefined)    patch.due_date=due_date;
  if(!Object.keys(patch).length) return res.status(400).json({error:"ไม่มีข้อมูล"});
  q.ticketUpdate(req.params.id,patch);
  if(assigned_to) q.timelineInsert.run(req.params.id,"มอบหมายงานให้: "+assigned_to,"acc",req.user.name);
  if(due_date)    q.timelineInsert.run(req.params.id,"กำหนดเสร็จ: "+due_date,"acc",req.user.name);
  res.json({...q.ticketOne(req.params.id),timeline:q.ticketTimeline(req.params.id)});
});

app.post("/api/tickets/:id/comment", auth(), (req, res) => {
  const {message} = req.body;
  if(!message?.trim()) return res.status(400).json({error:"กรุณาระบุข้อความ"});
  q.timelineInsert.run(req.params.id,"💬 "+message.trim(),"acc",req.user.name);
  res.json({timeline:q.ticketTimeline(req.params.id)});
});

app.delete("/api/tickets/:id", auth(["admin"]), (req, res) => {
  if(!q.ticketDelete.run(req.params.id).changes) return res.status(404).json({error:"ไม่พบ"});
  res.json({ok:true});
});

app.get("/api/track/:id", (req, res) => {
  const t = q.ticketOne(req.params.id.toUpperCase());
  if(!t) return res.status(404).json({error:"ไม่พบ"});
  const {id,title,location,type,priority,status,reporter,assigned_to,due_date,created_at}=t;
  res.json({id,title,location,type,priority,status,reporter,assigned_to,due_date,created_at,timeline:q.ticketTimeline(id)});
});

/* ══ TECHNICIANS ════════════════════════════════════ */
app.get("/api/technicians", auth(), (req,res)=>res.json(q.techs()));
app.post("/api/technicians", auth(["admin"]), (req,res)=>{ const{name,phone,dept}=req.body; if(!name)return res.status(400).json({error:"กรุณาระบุชื่อ"}); q.techInsert.run(name,phone||"",dept||""); res.status(201).json(q.techs()); });
app.put("/api/technicians/:id", auth(["admin"]), (req,res)=>{ const{name,phone,dept}=req.body; q.techUpdate.run(name,phone||"",dept||"",req.params.id); res.json(q.techs()); });
app.delete("/api/technicians/:id", auth(["admin"]), (req,res)=>{ q.techDelete.run(req.params.id); res.json(q.techs()); });

/* ══ PM ═════════════════════════════════════════════ */
app.get("/api/pm", auth(), (req,res)=>res.json(q.pmList()));
app.post("/api/pm", auth(["admin"]), (req,res)=>{ const{name,location,frequency,next_date,last_date,technician,progress,notes}=req.body; if(!name||!location||!frequency||!next_date)return res.status(400).json({error:"ข้อมูลไม่ครบ"}); const id=genPMId(); q.pmInsert.run(id,name,location,frequency,next_date,last_date||"",technician||"",progress||0,notes||""); res.status(201).json(q.pmList()); });
app.put("/api/pm/:id", auth(["admin"]), (req,res)=>{ const{name,location,frequency,next_date,last_date,technician,progress,notes}=req.body; q.pmUpdate(req.params.id,{name,location,frequency,next_date,last_date:last_date||"",technician:technician||"",progress:progress||0,notes:notes||""}); res.json(q.pmList()); });
app.delete("/api/pm/:id", auth(["admin"]), (req,res)=>{ q.pmDelete.run(req.params.id); res.json(q.pmList()); });

/* ══ SPARE PARTS ════════════════════════════════════ */
app.get("/api/spare", auth(), (req,res)=>{
  const{category,q:srch,low}=req.query;
  if(low) return res.json(q.spareLowStock());
  let where="1=1"; const params=[];
  if(category){where+=" AND category=?"; params.push(category);}
  if(srch){where+=" AND (name LIKE ? OR code LIKE ?)"; const w=`%${srch}%`; params.push(w,w);}
  res.json(q.spareList(where,params));
});

app.get("/api/spare/:id", auth(), (req,res)=>{
  const p=q.spareOne(req.params.id);
  if(!p) return res.status(404).json({error:"ไม่พบ"});
  res.json({...p, transactions:q.spareTxnList(p.id)});
});

app.post("/api/spare", auth(["admin"]), (req,res)=>{
  const{name,code,category,unit,qty,min_qty,price,location,supplier,description}=req.body;
  if(!name||!category||!unit) return res.status(400).json({error:"ข้อมูลไม่ครบ"});
  const id=genSpareId();
  q.spareInsert.run(id,name,code||"",category,unit,qty||0,min_qty||5,price||0,location||"",supplier||"",description||"");
  if(qty>0) q.spareTxnInsert.run(id,"in",qty,"","ยอดเริ่มต้น",req.user.name);
  res.status(201).json(q.spareOne(id));
});

app.put("/api/spare/:id", auth(["admin"]), (req,res)=>{
  const{name,code,category,unit,min_qty,price,location,supplier,description}=req.body;
  q.spareUpdate(req.params.id,{name,code:code||"",category,unit,min_qty:min_qty||5,price:price||0,location:location||"",supplier:supplier||"",description:description||""});
  res.json(q.spareOne(req.params.id));
});

app.delete("/api/spare/:id", auth(["admin"]), (req,res)=>{
  q.spareDelete.run(req.params.id);
  res.json({ok:true});
});

// เบิกอะไหล่ (tech + admin)
app.post("/api/spare/:id/withdraw", auth(["admin","tech"]), (req,res)=>{
  const{qty,ticket_id,note}=req.body;
  if(!qty||qty<=0) return res.status(400).json({error:"ระบุจำนวนที่ถูกต้อง"});
  const part=q.spareOne(req.params.id);
  if(!part) return res.status(404).json({error:"ไม่พบอะไหล่"});
  if(part.qty<qty) return res.status(400).json({error:`สต็อกไม่พอ (มี ${part.qty} ${part.unit})`});
  q.spareUpdate(req.params.id,{qty:part.qty-qty});
  q.spareTxnInsert.run(req.params.id,"out",qty,ticket_id||"",note||"เบิกใช้งาน",req.user.name);
  if(ticket_id) q.timelineInsert.run(ticket_id,`เบิกอะไหล่: ${part.name} x${qty} ${part.unit}`,"acc",req.user.name);
  res.json({...q.spareOne(req.params.id), transactions:q.spareTxnList(req.params.id)});
});

// นำเข้าอะไหล่ (tech + admin)
app.post("/api/spare/:id/receive", auth(["admin","tech"]), (req,res)=>{
  const{qty,note}=req.body;
  if(!qty||qty<=0) return res.status(400).json({error:"ระบุจำนวนที่ถูกต้อง"});
  const part=q.spareOne(req.params.id);
  if(!part) return res.status(404).json({error:"ไม่พบอะไหล่"});
  q.spareUpdate(req.params.id,{qty:part.qty+qty});
  q.spareTxnInsert.run(req.params.id,"in",qty,"",note||"รับเข้าคลัง",req.user.name);
  res.json({...q.spareOne(req.params.id), transactions:q.spareTxnList(req.params.id)});
});

/* ══ SPA ════════════════════════════════════════════ */
app.get("*", (_,res)=>res.sendFile(path.join(__dirname,"..","public","index.html")));

app.listen(PORT, ()=>{
  console.log(`✅ CMMS PRO running on port ${PORT}`);
  console.log(`   Roles: admin | tech | user-portal(no PIN)`);
  console.log(`   LINE: ${process.env.LINE_NOTIFY_TOKEN?"✅":"❌"} | Email: ${process.env.RESEND_API_KEY?"✅":"❌"}`);
});
