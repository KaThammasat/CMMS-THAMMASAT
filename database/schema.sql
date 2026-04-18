-- ============================================================
-- CMMS THAMMASAT INDUSTRIAL - DATABASE SCHEMA v5.0
-- PostgreSQL Production Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE equipment_type AS ENUM ('cnc','pump','hvac','compressor','motor','conveyor','generator','boiler','crane','robot');
CREATE TYPE criticality_level AS ENUM ('critical','high','medium','low');
CREATE TYPE work_order_status AS ENUM ('draft','open','assigned','in_progress','pending_approval','loto_prep','loto_executed','completed','closed','cancelled');
CREATE TYPE work_order_type AS ENUM ('corrective','preventive','predictive','inspection','project');
CREATE TYPE downtime_type AS ENUM ('breakdown','planned','setup','idle');
CREATE TYPE downtime_category AS ENUM ('electrical','mechanical','hydraulic','pneumatic','software','operator','material','quality');
CREATE TYPE loto_status AS ENUM ('pending','isolating','isolated','verified','released');
CREATE TYPE user_role AS ENUM ('admin','manager','technician','operator','viewer');
CREATE TYPE alert_severity AS ENUM ('critical','high','medium','low','info');

-- ============================================================
-- SITES & LOCATIONS HIERARCHY
-- ============================================================
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    country VARCHAR(50) DEFAULT 'Thailand',
    timezone VARCHAR(50) DEFAULT 'Asia/Bangkok',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, code)
);

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    floor VARCHAR(20),
    building VARCHAR(50),
    gps_lat DECIMAL(10,8),
    gps_lng DECIMAL(11,8),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(zone_id, code)
);

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================
CREATE TABLE users (
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
    skills TEXT[], -- Array of skills e.g. {'electrical','hydraulic','plc'}
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    refresh_token_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EQUIPMENT
-- ============================================================
CREATE TABLE equipment (
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
    cost_per_minute DECIMAL(10,2) DEFAULT 0, -- production loss per minute downtime
    health_score INTEGER DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    runtime_hours DECIMAL(10,2) DEFAULT 0,
    last_maintenance_date TIMESTAMPTZ,
    next_maintenance_date TIMESTAMPTZ,
    specifications JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment sensor readings (for predictive maintenance)
CREATE TABLE sensor_readings (
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
) PARTITION BY RANGE (recorded_at);

-- Monthly partitions for sensor_readings (performance)
CREATE TABLE sensor_readings_2024_01 PARTITION OF sensor_readings
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE sensor_readings_2024_q2 PARTITION OF sensor_readings
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');
CREATE TABLE sensor_readings_2025 PARTITION OF sensor_readings
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE sensor_readings_2026 PARTITION OF sensor_readings
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- ============================================================
-- SPARE PARTS / INVENTORY
-- ============================================================
CREATE TABLE spare_parts (
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
);

-- Bill of Materials per equipment
CREATE TABLE equipment_bom (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    spare_part_id UUID NOT NULL REFERENCES spare_parts(id),
    quantity_required DECIMAL(10,2) NOT NULL DEFAULT 1,
    is_critical BOOLEAN DEFAULT FALSE,
    notes TEXT,
    UNIQUE(equipment_id, spare_part_id)
);

-- ============================================================
-- WORK ORDERS
-- ============================================================
CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wo_number VARCHAR(20) UNIQUE NOT NULL, -- WO-2024-001234
    equipment_id UUID NOT NULL REFERENCES equipment(id),
    type work_order_type NOT NULL DEFAULT 'corrective',
    status work_order_status NOT NULL DEFAULT 'draft',
    priority criticality_level NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    -- Assignments
    created_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    opened_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    -- SLA
    sla_due_at TIMESTAMPTZ,
    sla_breached BOOLEAN DEFAULT FALSE,
    sla_breach_notified BOOLEAN DEFAULT FALSE,
    -- Estimates vs Actuals
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    -- Downtime link
    downtime_id UUID, -- linked to downtime record
    -- Root cause
    root_cause TEXT,
    corrective_action TEXT,
    failure_mode VARCHAR(100),
    -- Auto-generated flag
    is_auto_generated BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work order tasks / checklist
CREATE TABLE wo_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    description TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_by UUID REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    notes TEXT
);

-- Work order parts used
CREATE TABLE wo_parts_used (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    spare_part_id UUID NOT NULL REFERENCES spare_parts(id),
    quantity_used DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) GENERATED ALWAYS AS (quantity_used * unit_cost) STORED
);

-- Work order labor
CREATE TABLE wo_labor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    hours_worked DECIMAL(5,2),
    hourly_rate DECIMAL(8,2) DEFAULT 0,
    notes TEXT
);

-- ============================================================
-- DOWNTIME TRACKING
-- ============================================================
CREATE TABLE downtime_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES equipment(id),
    work_order_id UUID REFERENCES work_orders(id),
    type downtime_type NOT NULL,
    category downtime_category,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes DECIMAL(10,2) GENERATED ALWAYS AS (
        CASE WHEN end_time IS NOT NULL
        THEN EXTRACT(EPOCH FROM (end_time - start_time)) / 60
        ELSE NULL END
    ) STORED,
    reported_by UUID REFERENCES users(id),
    lost_production_units DECIMAL(10,2) DEFAULT 0,
    downtime_cost DECIMAL(12,2), -- calculated on end
    root_cause TEXT,
    prevention_action TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOTO (LOCKOUT-TAGOUT)
-- ============================================================
CREATE TABLE loto_procedures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES equipment(id),
    work_order_id UUID REFERENCES work_orders(id),
    procedure_number VARCHAR(30) UNIQUE NOT NULL,
    status loto_status NOT NULL DEFAULT 'pending',
    -- Energy isolation steps
    energy_sources JSONB NOT NULL DEFAULT '[]', -- [{type:'electrical',location:'MDB-A1',verified:false}]
    -- Personnel
    initiated_by UUID NOT NULL REFERENCES users(id),
    authorized_by UUID REFERENCES users(id),
    -- Timestamps
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    isolated_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    -- Verification
    zero_energy_verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(100),
    notes TEXT
);

-- ============================================================
-- PREVENTIVE MAINTENANCE SCHEDULES
-- ============================================================
CREATE TABLE pm_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES equipment(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    frequency_type VARCHAR(20) NOT NULL, -- 'daily','weekly','monthly','hours','custom'
    frequency_value INTEGER NOT NULL DEFAULT 1,
    estimated_hours DECIMAL(5,2),
    last_done_date DATE,
    next_due_date DATE,
    tasks JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID REFERENCES equipment(id),
    work_order_id UUID REFERENCES work_orders(id),
    type VARCHAR(50) NOT NULL, -- 'sla_breach','health_low','sensor_anomaly','stock_low','pm_due'
    severity alert_severity NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI PREDICTIONS
-- ============================================================
CREATE TABLE ai_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES equipment(id),
    predicted_at TIMESTAMPTZ DEFAULT NOW(),
    risk_score DECIMAL(5,2) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    failure_probability DECIMAL(5,4), -- 0.0000 to 1.0000
    estimated_failure_date DATE,
    failure_mode VARCHAR(100),
    recommendation TEXT,
    confidence_level DECIMAL(5,2),
    model_version VARCHAR(20) DEFAULT 'v1.0',
    input_features JSONB DEFAULT '{}'
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX idx_equipment_location ON equipment(location_id);
CREATE INDEX idx_equipment_type ON equipment(type);
CREATE INDEX idx_equipment_criticality ON equipment(criticality);
CREATE INDEX idx_equipment_health ON equipment(health_score);
CREATE INDEX idx_equipment_asset_code ON equipment(asset_code);

CREATE INDEX idx_wo_status ON work_orders(status);
CREATE INDEX idx_wo_equipment ON work_orders(equipment_id);
CREATE INDEX idx_wo_assigned ON work_orders(assigned_to);
CREATE INDEX idx_wo_sla ON work_orders(sla_due_at) WHERE sla_breached = FALSE;
CREATE INDEX idx_wo_created ON work_orders(created_at DESC);

CREATE INDEX idx_downtime_equipment ON downtime_records(equipment_id);
CREATE INDEX idx_downtime_start ON downtime_records(start_time DESC);
CREATE INDEX idx_downtime_type ON downtime_records(type);

CREATE INDEX idx_alerts_unread ON alerts(is_read, created_at DESC);
CREATE INDEX idx_sensor_equipment_time ON sensor_readings(equipment_id, recorded_at DESC);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_equipment_updated BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_wo_updated BEFORE UPDATE ON work_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_downtime_updated BEFORE UPDATE ON downtime_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto work order from breakdown
CREATE OR REPLACE FUNCTION auto_create_work_order()
RETURNS TRIGGER AS $$
DECLARE v_eq RECORD; v_wo_num VARCHAR(20); v_sla_hours INTEGER;
BEGIN
    IF NEW.type = 'breakdown' THEN
        SELECT e.*, 
               CASE e.criticality 
                   WHEN 'critical' THEN 4 WHEN 'high' THEN 8 
                   WHEN 'medium' THEN 24 ELSE 72 END AS sla_hours
        INTO v_eq FROM equipment e WHERE e.id = NEW.equipment_id;
        
        v_wo_num := 'WO-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
                    LPAD(NEXTVAL('wo_sequence')::TEXT, 6, '0');
        
        INSERT INTO work_orders (
            wo_number, equipment_id, type, status, priority, title,
            description, sla_due_at, downtime_id, is_auto_generated, opened_at
        ) VALUES (
            v_wo_num, NEW.equipment_id, 'corrective', 'open', 
            v_eq.criticality::criticality_level,
            'AUTO: Breakdown - ' || v_eq.name,
            'Automatically generated from breakdown report. Started: ' || NEW.start_time::TEXT,
            NOW() + (v_eq.sla_hours || ' hours')::INTERVAL,
            NEW.id, TRUE, NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE wo_sequence START 1000;
CREATE TRIGGER trg_auto_work_order AFTER INSERT ON downtime_records
    FOR EACH ROW EXECUTE FUNCTION auto_create_work_order();

-- Calculate downtime cost on end
CREATE OR REPLACE FUNCTION calc_downtime_cost()
RETURNS TRIGGER AS $$
DECLARE v_cost_per_min DECIMAL(10,2);
BEGIN
    IF NEW.end_time IS NOT NULL AND OLD.end_time IS NULL THEN
        SELECT cost_per_minute INTO v_cost_per_min 
        FROM equipment WHERE id = NEW.equipment_id;
        NEW.downtime_cost := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60 * v_cost_per_min;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_downtime_cost BEFORE UPDATE ON downtime_records
    FOR EACH ROW EXECUTE FUNCTION calc_downtime_cost();
