# CMMS PRO v3.0 🔧

ระบบบริหารงานซ่อมบำรุง (Computerized Maintenance Management System)  
สำหรับ Data Center, โรงงาน และอาคารสูง

## 🚀 Quick Start

### Login Credentials
| Role | PIN | Access |
|------|-----|--------|
| Admin | `1234` | Full access + Settings |
| Technician | `5678` | WO, PM, Spare Parts |
| Public | No PIN | แจ้งซ่อม + ติดตามสถานะ |

## 📡 API Endpoints
- `GET /api/health` — Health check
- `POST /api/auth/login` — Login {role, pin}
- `GET /api/work-orders` — Work orders list
- `POST /api/work-orders` — Create work order (public allowed)
- `GET /api/public/status/:wo_number` — Track WO status (public)
- `GET /api/assets` — Asset register
- `GET /api/pm-plans` — PM plans
- `GET /api/spare-parts` — Inventory
- `GET /api/kpi/summary` — KPI data
- `GET /api/notifications` — Notifications

## ⚙️ Environment Variables
```
JWT_SECRET=your-strong-secret-here
NODE_ENV=production
TZ=Asia/Bangkok
LINE_TOKEN=your-line-notify-token (optional)
PORT=3000
```

## 🏗️ Project Structure
```
├── src/
│   ├── server.js    # Express API (all routes)
│   ├── db.js        # SQLite + schema + seed data
│   └── notify.js    # LINE Notify + SLA checker
├── public/
│   └── index.html   # Full frontend SPA
├── package.json
├── Procfile         # Railway/Heroku
└── railway.json     # Railway config
```
