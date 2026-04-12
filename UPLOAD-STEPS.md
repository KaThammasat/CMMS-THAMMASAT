# CMMS PRO v3.0 — วิธี Deploy (5 นาที)

## วิธีที่ 1: Upload ผ่าน GitHub Web UI (ง่ายที่สุด)

### Step 1: แตก CMMS-PRO-v3-FINAL.zip
แตกได้โฟลเดอร์ `deploy/` ที่มีไฟล์ทั้งหมด

### Step 2: Upload ไปยัง GitHub
1. ไปที่: https://github.com/KaThammasat/CMMS-PRO1
2. ลบไฟล์เก่าทั้งหมด (DEPLOY.md, env.example เดิม)
3. กด **"Add file" → "Upload files"**
4. ลากทั้ง **folder** `src/` และ `public/` พร้อม **ไฟล์** เหล่านี้:
   - `src/server.js`
   - `src/db.js`  
   - `src/notify.js`
   - `public/index.html`
   - `package.json`
   - `Procfile`
   - `railway.json`
   - `nixpacks.toml`
5. กด **"Commit changes"**

---

## วิธีที่ 2: Push ด้วย Git Bundle (ถ้ามี Git)

```bash
# แตก bundle
git clone CMMS-PRO-v3-deploy.bundle cmms-local
cd cmms-local

# เพิ่ม remote ของคุณ
git remote add origin https://github.com/KaThammasat/CMMS-PRO1.git

# Push (ต้องมี token)
git push origin main --force
```

---

## Step 3: Deploy บน Railway

1. ไปที่: https://railway.com/project/de328372-9159-45bd-b9d2-701366a88871
2. กด **+ New → GitHub Repo → CMMS-PRO1**
3. Railway ตรวจ `Procfile` และ `railway.json` อัตโนมัติ
4. ไปที่ **Variables** tab → Add:

| Key | Value |
|-----|-------|
| `JWT_SECRET` | `cmms-pro-2024-bangkok-secret` |
| `NODE_ENV` | `production` |
| `TZ` | `Asia/Bangkok` |
| `LINE_TOKEN` | (optional — จาก notify.line.me) |

5. กด **Deploy** → รอ 3-5 นาที

---

## Login
| Role | PIN | สิทธิ์ |
|------|-----|--------|
| Admin | `1234` | ทุกอย่าง |
| Technician | `5678` | WO + PM + Parts |
| Public | ไม่ต้อง | แจ้งซ่อม + ติดตาม |

