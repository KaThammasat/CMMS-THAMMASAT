"use strict";
const https = require("https");
const { q } = require("./db");

const LINE_TOKEN = process.env.LINE_TOKEN || "";
const LINE_GROUP = process.env.LINE_GROUP_ID || "";

/* ── LINE Notify ── */
async function sendLine(message) {
  if (!LINE_TOKEN) return console.log("[Notify] LINE_TOKEN not set, skip LINE:", message.substring(0,60));
  return new Promise((resolve) => {
    const body = `message=${encodeURIComponent(message)}`;
    const req = https.request({
      hostname: "notify-api.line.me",
      path: "/api/notify",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${LINE_TOKEN}`,
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        console.log("[Notify] LINE response:", res.statusCode, data.substring(0,100));
        resolve();
      });
    });
    req.on("error", (e) => { console.error("[Notify] LINE error:", e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

/* ── Notify: New Work Order ── */
async function notifyNewTicket(wo, assetName) {
  const priorityEmoji = { critical:"🔴", high:"🟡", medium:"🔵", low:"⚪" };
  const emoji = priorityEmoji[wo.priority] || "🔵";

  const msg = [
    `\n🔧 งานแจ้งซ่อมใหม่ — CMMS PRO`,
    `━━━━━━━━━━━━━━━━━━`,
    `📋 เลขที่: ${wo.wo_number}`,
    `${emoji} ความสำคัญ: ${wo.priority?.toUpperCase()}`,
    `📌 หัวข้อ: ${wo.title}`,
    assetName ? `🏭 สินทรัพย์: ${assetName}` : "",
    wo.assigned_to ? `👷 ผู้รับผิดชอบ: ${wo.assigned_to}` : "",
    `⏰ SLA: ${wo.sla_hours} ชั่วโมง`,
    wo.requester_name ? `📞 ผู้แจ้ง: ${wo.requester_name}` : "",
    `🕐 เวลา: ${new Date().toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}`,
  ].filter(Boolean).join("\n");

  q.addNotification({ type: "new_wo", title: `WO ใหม่: ${wo.wo_number}`, message: `${emoji} ${wo.title} [${wo.priority}]` });

  await sendLine(msg);
}

/* ── Notify: Status Changed ── */
async function notifyStatusChange(wo, oldStatus, newStatus) {
  const statusEmoji = { open:"📬", in_progress:"🔨", completed:"✅", overdue:"🚨", cancelled:"❌" };
  const emoji = statusEmoji[newStatus] || "🔄";

  const msg = [
    `\n${emoji} อัพเดตสถานะงาน — CMMS PRO`,
    `━━━━━━━━━━━━━━━━━━`,
    `📋 ${wo.wo_number}: ${wo.title}`,
    `🔄 สถานะ: ${oldStatus} → ${newStatus}`,
    wo.assigned_to ? `👷 ช่าง: ${wo.assigned_to}` : "",
    wo.labor_hours ? `⏱️ ชั่วโมงซ่อม: ${wo.labor_hours}h` : "",
    wo.root_cause ? `🔍 สาเหตุ: ${wo.root_cause}` : "",
    `🕐 ${new Date().toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}`,
  ].filter(Boolean).join("\n");

  q.addNotification({ type: "status_change", title: `${wo.wo_number} → ${newStatus}`, message: msg.substring(0,150) });

  await sendLine(msg);
}

/* ── Notify: SLA Breach ── */
async function notifySLABreach(wo) {
  const msg = [
    `\n🚨 SLA เกินกำหนด — CMMS PRO`,
    `━━━━━━━━━━━━━━━━━━`,
    `📋 ${wo.wo_number}: ${wo.title}`,
    `⏰ SLA กำหนด: ${wo.sla_hours}h`,
    `❌ เกินเวลาแล้ว — ต้องดำเนินการทันที!`,
    wo.assigned_to ? `👷 ผู้รับผิดชอบ: ${wo.assigned_to}` : "",
  ].filter(Boolean).join("\n");

  q.addNotification({ type: "sla_breach", title: `🚨 SLA Breach: ${wo.wo_number}`, message: `เกินกาหนด — ${wo.title}` });
  await sendLine(msg);
}

/* ── Notify: Low Stock ── */
async function notifyLowStock(part) {
  const msg = `\n⚠️ อะไหล่ใกล้หมด — CMMS PRO\n━━━━━━━━━━━━━━━━━━\n📦 ${part.name} (${part.part_no})\n🔢 คงเหลือ: ${part.quantity} / ขั้นต่ำ: ${part.min_qty}`;
  q.addNotification({ type: "low_stock", title: `อะไหล่ใกล้หมด: ${part.name}`, message: `คงเหลือ ${part.quantity} ชิ้น` });
  await sendLine(msg);
}

/* ── SLA Checker (runs every 5 min) ── */
function startSLAChecker() {
  setInterval(async () => {
    try {
      const { db } = require("./db");
      const now = new Date().toISOString().slice(0,16).replace("T"," ");
      const breached = db.prepare(
        `SELECT * FROM work_orders WHERE status IN ('open','in_progress') AND sla_deadline IS NOT NULL AND sla_deadline < ? AND priority IN ('critical','high')`
      ).all(now);
      for (const wo of breached) {
        db.prepare("UPDATE work_orders SET status='overdue' WHERE id=?").run(wo.id);
        await notifySLABreach(wo);
        console.log(`[SLA] Marked overdue: ${wo.wo_number}`);
      }
    } catch(e) { console.error("[SLA Checker]", e.message); }
  }, 5 * 60 * 1000);
  console.log("[Notify] SLA checker started (every 5 min)");
}

module.exports = { notifyNewTicket, notifyStatusChange, notifySLABreach, notifyLowStock, startSLAChecker };
