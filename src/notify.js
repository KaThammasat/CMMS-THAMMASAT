"use strict";
const https = require("https");
const { q } = require("./db");

const LINE_TOKEN = process.env.LINE_TOKEN || "";

async function sendLine(message) {
  if (!LINE_TOKEN) return console.log("[Notify] LINE_TOKEN not set, skip:", message.substring(0,60));
  return new Promise((resolve) => {
    const body = "message=" + encodeURIComponent(message);
    const req = https.request({
      hostname: "notify-api.line.me",
      path: "/api/notify",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Bearer " + LINE_TOKEN,
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { console.log("[Notify] LINE response:", res.statusCode); resolve(); });
    });
    req.on("error", (e) => { console.error("[Notify] LINE error:", e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

async function notifyNewTicket(wo, assetName) {
  const emoji = { critical:"!", high:"!", medium:"~", low:"-" }[wo.priority] || "~";
  const msg = ["New WO: " + wo.wo_number, "Priority: " + emoji + " " + wo.priority, "Title: " + wo.title, assetName ? "Asset: " + assetName : "", wo.assigned_to ? "Assigned: " + wo.assigned_to : "", "SLA: " + wo.sla_hours + "hrs"].filter(Boolean).join("\n");
  q.addNotification({ type: "new_wo", title: "WO: " + wo.wo_number, message: wo.title });
  await sendLine(msg);
}

async function notifyStatusChange(wo, oldStatus, newStatus) {
  q.addNotification({ type: "status_change", title: wo.wo_number + " -> " + newStatus, message: oldStatus + " => " + newStatus });
  await sendLine("WO " + wo.wo_number + ": " + oldStatus + " => " + newStatus);
}

async function notifySLABreach(wo) {
  q.addNotification({ type: "sla_breach", title: "SLA Breach: " + wo.wo_number, message: wo.title });
  await sendLine("SLA Breach!\nWO " + wo.wo_number + ": " + wo.title);
}

async function notifyLowStock(part) {
  q.addNotification({ type: "low_stock", title: "Low Stock: " + part.name, message: "Qty " + part.quantity });
  await sendLine("Low Stock: " + part.name + " - Qty " + part.quantity);
}

function startSLAChecker() {
  setInterval(async () => {
    try {
      const { db } = require("./db");
      const now = new Date().toISOString().slice(0,16).replace("T"," ");
      const breached = db.prepare("SELECT * FROM work_orders WHERE status IN ('open','in_progress') AND sla_deadline IS NOT NULL AND sla_deadline < ? AND priority IN ('critical','high')").all(now);
      for (const wo of breached) {
        db.prepare("UPDATE work_orders SET status='overdue' WHERE id=?").run(wo.id);
        await notifySLABreach(wo);
      }
    } catch(e) { console.error("[SLA]", e.message); }
  }, 5*60*1000);
  console.log("[Notify] SLA checker started");
}

module.exports = { notifyNewTicket, notifyStatusChange, notifySLABreach, notifyLowStock, startSLAChecker };
