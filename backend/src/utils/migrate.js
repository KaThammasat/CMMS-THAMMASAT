'use strict';
const { pool } = require('../config/database');
const logger = require('./logger');

async function migrate() {
  try {
    // Check if already migrated
    const check = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='equipment') as exists"
    );
    if (check.rows[0].exists) {
      logger.info('DB schema already initialized');
      return;
    }

    logger.info('Running inline schema migration...');

    // Run schema statements individually for Railway compatibility
    const statements = getSchemaStatements();
    let ok = 0, skip = 0;
    for (const sql of statements) {
      if (!sql.trim()) continue;
      try {
        await pool.query(sql);
        ok++;
      } catch (e) {
        // Log but continue — some statements may already exist or be unsupported
        logger.warn(`Schema stmt skipped: ${e.message.split('\n')[0]}`);
        skip++;
      }
    }
    logger.info(`✅ Schema migration complete (${ok} ok, ${skip} skipped)`);

    // Seed demo data
    await seedData();
    logger.info('✅ Seed data loaded');
    await fixPasswords();
  } catch (err) {
    logger.error('Migration error:', err.message);
  }
}

function getSchemaStatements() {
  return [
    // Extensions
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
    `CREATE EXTENSION IF NOT EXISTS "pg_trgm"`,

    // Enums
    `DO $$ BEGIN CREATE TYPE equipment_type AS ENUM ('cnc','pump','hvac','compressor','motor','conveyor','generator','boiler','crane','robot'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE criticality_level AS ENUM ('critical','high','medium','low'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE work_order_status AS ENUM ('draft','open','assigned','in_progress','pending_approval','loto_prep','loto_executed','completed','closed','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE work_order_type AS ENUM ('corrective','preventive','predictive','inspection','project'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE downtime_type AS ENUM ('breakdown','planned','setup','idle'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE downtime_category AS ENUM ('electrical','mechanical','hydraulic','pneumatic','software','operator','material','quality'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE loto_status AS ENUM ('pending','isolating','isolated','verified','released'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin','manager','technician','operator','viewer'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE alert_severity AS ENUM ('critical','high','medium','low','info'); EXCEPTION WHEN duplicate_object THEN null; END $$`,

    // Sites
    `CREATE TABLE IF NOT EXISTS sites (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      address TEXT,
      country VARCHAR(50) DEFAULT 'Thailand',
      timezone VARCHAR(50) DEFAULT 'Asia/Bangkok',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Zones
    `CREATE TABLE IF NOT EXISTS zones (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      code VARCHAR(20) NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Locations
    `CREATE TABLE IF NOT EXISTS locations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
      code VARCHAR(20) NOT NULL,
      name VARCHAR(100) NOT NULL,
      floor VARCHAR(20),
      building VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Users
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      site_id UUID REFERENCES sites(id),
      employee_id VARCHAR(20) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      role user_role NOT NULL DEFAULT 'technician',
      department VARCHAR(50),
      phone VARCHAR(20),
      skills TEXT[],
      is_active BOOLEAN DEFAULT TRUE,
      last_login TIMESTAMPTZ,
      refresh_token_hash VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Equipment
    `CREATE TABLE IF NOT EXISTS equipment (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      location_id UUID NOT NULL REFERENCES locations(id),
      asset_code VARCHAR(30) UNIQUE NOT NULL,
      name VARCHAR(150) NOT NULL,
      type equipment_type NOT NULL,
      criticality criticality_level NOT NULL DEFAULT 'medium',
      manufacturer VARCHAR(100),
      model VARCHAR(100),
      serial_number VARCHAR(100),
      purchase_date DATE,
      install_date DATE,
      warranty_expiry DATE,
      cost_per_minute DECIMAL(10,2) DEFAULT 0,
      health_score INTEGER DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
      runtime_hours DECIMAL(10,2) DEFAULT 0,
      last_maintenance_date TIMESTAMPTZ,
      next_maintenance_date TIMESTAMPTZ,
      specifications JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Sensor readings (simple table, no partitioning for Railway)
    `CREATE TABLE IF NOT EXISTS sensor_readings (
      id BIGSERIAL PRIMARY KEY,
      equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      temperature DECIMAL(6,2),
      vibration DECIMAL(8,4),
      pressure DECIMAL(8,2),
      current_amps DECIMAL(8,2),
      voltage DECIMAL(8,2),
      rpm DECIMAL(8,2),
      oil_level DECIMAL(5,2),
      noise_db DECIMAL(6,2),
      raw_data JSONB DEFAULT '{}'
    )`,

    // Spare parts
    `CREATE TABLE IF NOT EXISTS spare_parts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      site_id UUID NOT NULL REFERENCES sites(id),
      part_number VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      category VARCHAR(50),
      unit_of_measure VARCHAR(20) DEFAULT 'EA',
      unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      quantity_on_hand DECIMAL(10,2) DEFAULT 0,
      quantity_reserved DECIMAL(10,2) DEFAULT 0,
      min_stock DECIMAL(10,2) DEFAULT 0,
      max_stock DECIMAL(10,2) DEFAULT 0,
      reorder_point DECIMAL(10,2) DEFAULT 0,
      reorder_quantity DECIMAL(10,2) DEFAULT 0,
      lead_time_days INTEGER DEFAULT 0,
      supplier VARCHAR(100),
      storage_location VARCHAR(50),
      is_critical BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Equipment BOM
    `CREATE TABLE IF NOT EXISTS equipment_bom (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      spare_part_id UUID NOT NULL REFERENCES spare_parts(id),
      quantity_required DECIMAL(10,2) NOT NULL DEFAULT 1,
      is_critical BOOLEAN DEFAULT FALSE,
      notes TEXT,
      UNIQUE(equipment_id, spare_part_id)
    )`,

    // WO sequence
    `CREATE SEQUENCE IF NOT EXISTS wo_sequence START 1000`,

    // Work orders
    `CREATE TABLE IF NOT EXISTS work_orders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      wo_number VARCHAR(20) UNIQUE NOT NULL,
      equipment_id UUID NOT NULL REFERENCES equipment(id),
      type work_order_type NOT NULL DEFAULT 'corrective',
      status work_order_status NOT NULL DEFAULT 'draft',
      priority criticality_level NOT NULL DEFAULT 'medium',
      title VARCHAR(255) NOT NULL,
      description TEXT,
      created_by UUID REFERENCES users(id),
      assigned_to UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      opened_at TIMESTAMPTZ,
      assigned_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      sla_due_at TIMESTAMPTZ,
      sla_breached BOOLEAN DEFAULT FALSE,
      sla_breach_notified BOOLEAN DEFAULT FALSE,
      estimated_hours DECIMAL(5,2),
      actual_hours DECIMAL(5,2),
      estimated_cost DECIMAL(10,2),
      actual_cost DECIMAL(10,2),
      downtime_id UUID,
      root_cause TEXT,
      corrective_action TEXT,
      failure_mode VARCHAR(100),
      is_auto_generated BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // WO tasks
    `CREATE TABLE IF NOT EXISTS wo_tasks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      description TEXT NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      completed_by UUID REFERENCES users(id),
      completed_at TIMESTAMPTZ,
      notes TEXT
    )`,

    // WO parts used
    `CREATE TABLE IF NOT EXISTS wo_parts_used (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      spare_part_id UUID NOT NULL REFERENCES spare_parts(id),
      quantity_used DECIMAL(10,2) NOT NULL,
      unit_cost DECIMAL(10,2) NOT NULL,
      total_cost DECIMAL(10,2)
    )`,

    // Downtime records
    `CREATE TABLE IF NOT EXISTS downtime_records (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      equipment_id UUID NOT NULL REFERENCES equipment(id),
      work_order_id UUID REFERENCES work_orders(id),
      type downtime_type NOT NULL,
      category downtime_category,
      description TEXT,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ,
      duration_minutes DECIMAL(10,2),
      reported_by UUID REFERENCES users(id),
      lost_production_units DECIMAL(10,2) DEFAULT 0,
      downtime_cost DECIMAL(12,2),
      root_cause TEXT,
      prevention_action TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // LOTO
    `CREATE TABLE IF NOT EXISTS loto_procedures (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      equipment_id UUID NOT NULL REFERENCES equipment(id),
      work_order_id UUID REFERENCES work_orders(id),
      procedure_number VARCHAR(30) UNIQUE NOT NULL,
      status loto_status NOT NULL DEFAULT 'pending',
      energy_sources JSONB NOT NULL DEFAULT '[]',
      initiated_by UUID NOT NULL REFERENCES users(id),
      authorized_by UUID REFERENCES users(id),
      initiated_at TIMESTAMPTZ DEFAULT NOW(),
      isolated_at TIMESTAMPTZ,
      verified_at TIMESTAMPTZ,
      released_at TIMESTAMPTZ,
      zero_energy_verified BOOLEAN DEFAULT FALSE,
      verification_method VARCHAR(100),
      notes TEXT
    )`,

    // PM schedules
    `CREATE TABLE IF NOT EXISTS pm_schedules (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      equipment_id UUID NOT NULL REFERENCES equipment(id),
      name VARCHAR(150) NOT NULL,
      description TEXT,
      frequency_type VARCHAR(20) NOT NULL,
      frequency_value INTEGER NOT NULL DEFAULT 1,
      estimated_hours DECIMAL(5,2),
      last_done_date DATE,
      next_due_date DATE,
      tasks JSONB DEFAULT '[]',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Alerts
    `CREATE TABLE IF NOT EXISTS alerts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      equipment_id UUID REFERENCES equipment(id),
      work_order_id UUID REFERENCES work_orders(id),
      type VARCHAR(50) NOT NULL,
      severity alert_severity NOT NULL DEFAULT 'medium',
      title VARCHAR(255) NOT NULL,
      message TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      is_resolved BOOLEAN DEFAULT FALSE,
      resolved_by UUID REFERENCES users(id),
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // AI predictions
    `CREATE TABLE IF NOT EXISTS ai_predictions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      equipment_id UUID NOT NULL REFERENCES equipment(id),
      predicted_at TIMESTAMPTZ DEFAULT NOW(),
      risk_score DECIMAL(5,2) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
      failure_probability DECIMAL(5,4),
      estimated_failure_date DATE,
      failure_mode VARCHAR(100),
      recommendation TEXT,
      confidence_level DECIMAL(5,2),
      model_version VARCHAR(20) DEFAULT 'v1.0',
      input_features JSONB DEFAULT '{}'
    )`,

    // Key indexes
    `CREATE INDEX IF NOT EXISTS idx_equipment_criticality ON equipment(criticality)`,
    `CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status)`,
    `CREATE INDEX IF NOT EXISTS idx_wo_equipment ON work_orders(equipment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_downtime_equipment ON downtime_records(equipment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(is_read, created_at DESC)`,
  ];
}

async function seedData() {
  // Check if already seeded
  const check = await pool.query("SELECT COUNT(*) as cnt FROM sites");
  if (parseInt(check.rows[0].cnt) > 0) return;

  const SITE_ID = '11111111-0000-0000-0000-000000000001';
  const ZONE_ID = '22222222-0000-0000-0000-000000000001';
  const LOC_ID  = '33333333-0000-0000-0000-000000000001';
  const LOC_ID2 = '33333333-0000-0000-0000-000000000003';

  await pool.query(`INSERT INTO sites (id,code,name,timezone) VALUES ($1,'TU-MAIN','Thammasat Industrial Plant','Asia/Bangkok') ON CONFLICT DO NOTHING`, [SITE_ID]);
  await pool.query(`INSERT INTO zones (id,site_id,code,name) VALUES ($1,$2,'ZONE-A','Production Zone A') ON CONFLICT DO NOTHING`, [ZONE_ID, SITE_ID]);
  await pool.query(`INSERT INTO locations (id,zone_id,code,name) VALUES ($1,$2,'A-101','CNC Machine Bay 1'),($3,$2,'B-201','Pump Room') ON CONFLICT DO NOTHING`, [LOC_ID, ZONE_ID, LOC_ID2]);

  await pool.query(`INSERT INTO users (id,site_id,employee_id,email,password_hash,first_name,last_name,role,department) VALUES
    ('44444444-0000-0000-0000-000000000001',$1,'EMP-0001','admin@thammasat.ac.th','$2b$12$dummy','Somchai','Srisuk','admin','IT'),
    ('44444444-0000-0000-0000-000000000002',$1,'EMP-0002','manager@thammasat.ac.th','$2b$12$dummy','Wanchai','Jiraporn','manager','Maintenance'),
    ('44444444-0000-0000-0000-000000000003',$1,'EMP-0003','tech1@thammasat.ac.th','$2b$12$dummy','Arunee','Tanaka','technician','Maintenance')
    ON CONFLICT DO NOTHING`, [SITE_ID]);

  await pool.query(`INSERT INTO equipment (id,location_id,asset_code,name,type,criticality,manufacturer,model,cost_per_minute,health_score) VALUES
    ('55555555-0000-0000-0000-000000000001',$1,'CNC-001','CNC Machining Center #1','cnc','critical','Mazak','VARIAXIS i-700',850.00,72),
    ('55555555-0000-0000-0000-000000000002',$1,'CNC-002','CNC Machining Center #2','cnc','high','DMG Mori','DMU 50',650.00,88),
    ('55555555-0000-0000-0000-000000000003',$2,'PUMP-001','Cooling Water Pump #1','pump','critical','Grundfos','CR 95-3',320.00,91),
    ('55555555-0000-0000-0000-000000000004',$2,'PUMP-002','Cooling Water Pump #2','pump','high','Grundfos','CR 95-3',320.00,65)
    ON CONFLICT DO NOTHING`, [LOC_ID, LOC_ID2]);

  await pool.query(`INSERT INTO ai_predictions (equipment_id,risk_score,failure_probability,estimated_failure_date,failure_mode,recommendation,confidence_level) VALUES
    ('55555555-0000-0000-0000-000000000001',78.5,0.785,CURRENT_DATE+3,'Spindle bearing wear','Schedule immediate bearing replacement.',87.2),
    ('55555555-0000-0000-0000-000000000004',65.0,0.650,CURRENT_DATE+7,'Mechanical seal failure','Replace mechanical seal within 7 days.',82.1)
    ON CONFLICT DO NOTHING`);
}



async function fixPasswords() {
  try {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('password123', 12);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE password_hash LIKE $2',
      [hash, '%dummy%']
    );
    if (result.rowCount > 0) logger.info('Passwords fixed: ' + result.rowCount + ' users');
  } catch(e) { logger.warn('Password fix skipped:', e.message); }
}

module.exports = { migrate };
