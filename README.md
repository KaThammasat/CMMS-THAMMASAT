# CMMS Thammasat Industrial v5.0

> Enterprise-grade Computerized Maintenance Management System for Manufacturing, High-rise Buildings, Data Centers & Hospitals.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer / Nginx                    │
└──────────────┬────────────────────────┬─────────────────────┘
               │                        │
    ┌──────────▼──────────┐  ┌──────────▼──────────┐
    │   React Frontend    │  │   Node.js Backend   │
    │  (React 18 + RTK)   │  │  (Express + WS)     │
    └─────────────────────┘  └──────────┬──────────┘
                                        │
              ┌─────────────┬───────────┴────────────┐
              │             │                         │
   ┌──────────▼──┐  ┌───────▼──────┐  ┌─────────────▼───┐
   │ PostgreSQL  │  │    Redis     │  │   Socket.IO     │
   │  (Primary)  │  │  (Cache/Pub) │  │  (Real-time)    │
   └─────────────┘  └─────────────┘  └─────────────────┘
```

## ✅ Features

| Module | Features |
|--------|----------|
| 🏭 Asset Hierarchy | Site → Zone → Location → Equipment |
| ⚙ Equipment | Health scores, sensor data, specifications |
| 📋 Work Orders | Full lifecycle, SLA engine, auto-generation |
| ⛔ Downtime | Real-time tracking, auto cost calculation |
| 🔐 LOTO Safety | Full energy isolation enforcement |
| 📦 Inventory | Min/max stock, BOM, auto reorder alerts |
| 📊 KPI Engine | MTTR, MTBF, OEE, Availability, Downtime Cost |
| 🤖 AI Predict | Failure prediction with risk scoring |
| 🔴 Real-time | Socket.IO dashboard, SLA countdown, alerts |
| 🔒 Security | JWT, RBAC, bcrypt, rate limiting, helmet |

---

## ⚡ Quick Start (Docker - Recommended)

### Prerequisites
- Docker 24+ & Docker Compose v2
- Git

### 1. Clone the repository
```bash
git clone https://github.com/KaThammasat/CMMS-THAMMASAT.git
cd CMMS-THAMMASAT
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — at minimum, change all passwords and JWT_SECRET
nano .env
```

### 3. Start all services
```bash
docker compose up -d
```

### 4. Verify services are running
```bash
docker compose ps
# Expected: postgres ✓, redis ✓, backend ✓, frontend ✓, nginx ✓

# Check backend health
curl http://localhost:5000/health

# Expected: {"success":true,"status":"healthy"}
```

### 5. Access the system
| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| API | http://localhost:5000/api/v1 |
| API Docs | http://localhost:5000/api/docs |
| Grafana | http://localhost:3001 (with monitoring profile) |

### 6. Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@thammasat.ac.th | password123 |
| Manager | manager@thammasat.ac.th | password123 |
| Technician | tech1@thammasat.ac.th | password123 |
| Operator | operator1@thammasat.ac.th | password123 |

---

## 🛠 Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Redis 7+ (optional for dev)

### Backend setup
```bash
cd backend
npm install

# Create database
createdb cmms_thammasat
psql cmms_thammasat < ../database/schema.sql
psql cmms_thammasat < ../database/seed.sql

# Configure environment
cp ../.env.example .env
# Edit .env with your local DB credentials

# Start development server
npm run dev
# Server: http://localhost:5000
# API Docs: http://localhost:5000/api/docs
```

### Frontend setup
```bash
cd frontend
npm install

# Configure environment
echo "REACT_APP_API_URL=http://localhost:5000/api/v1" > .env
echo "REACT_APP_SOCKET_URL=http://localhost:5000" >> .env

# Start development server
npm start
# App: http://localhost:3000
```

---

## 🧪 Testing

### Run all tests
```bash
cd backend

# Unit tests (AI service, KPI calculations, SLA logic)
npm test

# Integration tests (requires PostgreSQL)
npm run test:integration

# Coverage report
npm test -- --coverage
```

### Test the API manually
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@thammasat.ac.th","password":"password123"}' \
  | jq -r '.data.accessToken')

# List equipment
curl http://localhost:5000/api/v1/equipment \
  -H "Authorization: Bearer $TOKEN" | jq .

# Get KPI summary (last 30 days)
curl "http://localhost:5000/api/v1/kpi/summary?from=$(date -d '30 days ago' -Iseconds)" \
  -H "Authorization: Bearer $TOKEN" | jq .data.oee

# Start a breakdown downtime
curl -X POST http://localhost:5000/api/v1/downtime \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": "55555555-0000-0000-0000-000000000001",
    "type": "breakdown",
    "category": "mechanical",
    "description": "Spindle bearing noise"
  }' | jq .
# → Work Order auto-created by DB trigger!

# Run AI prediction
curl http://localhost:5000/api/v1/equipment/55555555-0000-0000-0000-000000000001/predict \
  -H "Authorization: Bearer $TOKEN" | jq .data.riskScore
```

---

## 🚀 Production Deployment

### Docker Compose (Single server)
```bash
# Production .env (change ALL passwords!)
JWT_SECRET=$(openssl rand -base64 48)
DB_PASSWORD=$(openssl rand -base64 32)

docker compose -f docker-compose.yml up -d

# With monitoring stack (Prometheus + Grafana)
docker compose --profile monitoring up -d
```

### Kubernetes
```bash
# Apply all manifests
kubectl apply -f k8s/deployment.yaml

# Check rollout
kubectl -n cmms rollout status deployment/cmms-backend
kubectl -n cmms rollout status deployment/cmms-frontend

# Scale backend
kubectl -n cmms scale deployment/cmms-backend --replicas=4

# View logs
kubectl -n cmms logs -l app=cmms-backend -f

# Port forward for testing
kubectl -n cmms port-forward svc/backend-service 5000:5000
```

---

## 📊 Key Business Logic

### SLA Engine
```
Critical equipment → 4-hour SLA
High priority      → 8-hour SLA
Medium priority    → 24-hour SLA
Low priority       → 72-hour SLA

Auto-breach detection: runs every 5 minutes
Real-time countdown: Socket.IO → Dashboard
Alert at: 1 hour before breach
```

### Auto Work Order (DB Trigger)
```sql
-- When downtime.type = 'breakdown' is inserted:
-- 1. Fetch equipment criticality → determine SLA hours
-- 2. Auto-generate WO number: WO-YYYY-NNNNNN
-- 3. INSERT work_order with:
--    status = 'open'
--    priority = equipment.criticality
--    sla_due_at = NOW() + SLA_HOURS
--    is_auto_generated = TRUE
-- Zero application code required!
```

### Downtime Cost Engine
```
downtime_cost = duration_minutes × cost_per_minute
(Calculated automatically via PostgreSQL trigger on end_time update)

Example: CNC-001 down 90 minutes × ฿850/min = ฿76,500
```

### OEE Formula
```
OEE = Availability × Performance × Quality
    = 91.2% × 92.0% × 98.5%
    = 82.4%

Availability = (Total Time - Downtime) / Total Time × 100
MTTR = Mean Time To Repair = avg(completed_at - opened_at)
MTBF = Mean Time Between Failures = avg(next_failure - prev_failure_end)
```

---

## 🔐 Security Notes

1. **Change all default passwords** in `.env` before production
2. **JWT_SECRET must be ≥32 characters** and cryptographically random
3. **Enable SSL** by setting `DB_SSL=true` for PostgreSQL
4. **Reverse proxy** (Nginx) handles TLS termination — never expose backend directly
5. **RBAC roles**: admin → manager → technician → operator → viewer
6. **Rate limiting**: 300 req/15min globally, 10 req/15min for auth endpoints

---

## 📁 Project Structure

```
CMMS-THAMMASAT/
├── backend/
│   ├── src/
│   │   ├── server.js          # Main Express + Socket.IO server
│   │   ├── config/
│   │   │   └── database.js    # PostgreSQL pool config
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT + RBAC
│   │   ├── routes/
│   │   │   ├── auth.js        # /auth/login, /auth/me
│   │   │   ├── equipment.js   # Equipment CRUD + prediction
│   │   │   ├── workOrders.js  # Work order lifecycle
│   │   │   ├── downtime.js    # Downtime tracking
│   │   │   ├── loto.js        # LOTO safety
│   │   │   ├── inventory.js   # Spare parts
│   │   │   ├── kpi.js         # MTTR/MTBF/OEE
│   │   │   ├── reports.js     # Reports
│   │   │   └── alerts.js      # Alerts
│   │   ├── services/
│   │   │   ├── aiService.js   # Predictive maintenance
│   │   │   ├── socketService.js # Socket.IO + schedulers
│   │   │   └── schedulerService.js # Cron jobs
│   │   └── utils/
│   │       └── logger.js      # Winston logger
│   ├── tests/
│   │   ├── unit.test.js       # Unit tests
│   │   └── integration.test.js # API integration tests
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Router
│   │   ├── store/             # Zustand state
│   │   ├── hooks/
│   │   │   └── useSocket.js   # Real-time hook
│   │   ├── utils/
│   │   │   └── api.js         # Axios API client
│   │   ├── components/
│   │   │   └── Layout.jsx     # Sidebar + topbar
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── DashboardPage.jsx
│   │       ├── EquipmentPage.jsx
│   │       ├── WorkOrdersPage.jsx
│   │       ├── KPIPage.jsx
│   │       └── ...
│   └── Dockerfile
├── database/
│   ├── schema.sql             # Full PostgreSQL schema + triggers
│   └── seed.sql               # Sample data
├── docs/
│   └── api.yaml               # OpenAPI 3.0 specification
├── nginx/
│   └── nginx.conf             # Reverse proxy config
├── k8s/
│   └── deployment.yaml        # Kubernetes manifests
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions CI/CD
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Run tests: `cd backend && npm test`
4. Commit: `git commit -m "feat: add your feature"`
5. Push and open a Pull Request

---

## 📄 License

MIT License — Thammasat University Engineering © 2026
