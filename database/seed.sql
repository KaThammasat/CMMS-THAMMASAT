-- ============================================================
-- CMMS THAMMASAT - SEED DATA
-- ============================================================

-- Sites
INSERT INTO sites (id, code, name, address, timezone) VALUES
  ('11111111-0000-0000-0000-000000000001', 'TU-MAIN', 'Thammasat Industrial Plant - Main', '99 Moo 18, Klong Luang, Pathumthani 12120', 'Asia/Bangkok'),
  ('11111111-0000-0000-0000-000000000002', 'TU-NORTH', 'Thammasat Plant - North Building', '99 Moo 18, Klong Luang, Pathumthani 12120', 'Asia/Bangkok');

-- Zones
INSERT INTO zones (id, site_id, code, name) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'ZONE-A', 'Production Zone A'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'ZONE-B', 'Utility Zone B'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'ZONE-C', 'Maintenance Workshop');

-- Locations
INSERT INTO locations (id, zone_id, code, name, floor) VALUES
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'A-101', 'CNC Machine Bay 1', 'G'),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'A-102', 'Assembly Line 1', 'G'),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002', 'B-201', 'Pump Room', 'B1'),
  ('33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000002', 'B-202', 'HVAC Plant Room', 'R');

-- Users
INSERT INTO users (id, site_id, employee_id, email, password_hash, first_name, last_name, role, department, skills) VALUES
  ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'EMP-0001', 'admin@thammasat.ac.th', '$2b$12$hashed_admin_pw', 'Somchai', 'Srisuk', 'admin', 'IT', ARRAY['electrical','mechanical','plc']),
  ('44444444-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'EMP-0002', 'manager@thammasat.ac.th', '$2b$12$hashed_manager_pw', 'Wanchai', 'Jiraporn', 'manager', 'Maintenance', ARRAY['planning','electrical']),
  ('44444444-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'EMP-0003', 'tech1@thammasat.ac.th', '$2b$12$hashed_tech1_pw', 'Arunee', 'Tanaka', 'technician', 'Maintenance', ARRAY['mechanical','hydraulic','welding']),
  ('44444444-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'EMP-0004', 'tech2@thammasat.ac.th', '$2b$12$hashed_tech2_pw', 'Prasert', 'Nakorn', 'technician', 'Electrical', ARRAY['electrical','plc','instrumentation']),
  ('44444444-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'EMP-0005', 'operator1@thammasat.ac.th', '$2b$12$hashed_op_pw', 'Suda', 'Wiriya', 'operator', 'Production', ARRAY['operation']);

-- Equipment
INSERT INTO equipment (id, location_id, asset_code, name, type, criticality, manufacturer, model, serial_number, cost_per_minute, health_score, specifications) VALUES
  ('55555555-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'CNC-001', 'CNC Machining Center #1', 'cnc', 'critical', 'Mazak', 'VARIAXIS i-700', 'MZK2024001', 850.00, 72, '{"spindle_speed_max":12000,"axis":"5-axis","power_kw":37}'),
  ('55555555-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001', 'CNC-002', 'CNC Machining Center #2', 'cnc', 'high', 'DMG Mori', 'DMU 50', 'DMG2023045', 650.00, 88, '{"spindle_speed_max":18000,"axis":"5-axis","power_kw":25}'),
  ('55555555-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000003', 'PUMP-001', 'Cooling Water Pump #1', 'pump', 'critical', 'Grundfos', 'CR 95-3', 'GR2022011', 320.00, 91, '{"flow_m3h":95,"head_m":35,"power_kw":15,"type":"centrifugal"}'),
  ('55555555-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000003', 'PUMP-002', 'Cooling Water Pump #2', 'pump', 'high', 'Grundfos', 'CR 95-3', 'GR2022012', 320.00, 65, '{"flow_m3h":95,"head_m":35,"power_kw":15,"type":"centrifugal"}'),
  ('55555555-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000004', 'HVAC-001', 'Chiller Unit #1', 'hvac', 'high', 'Carrier', '30XA-502', 'CAR2021001', 450.00, 79, '{"cooling_kw":502,"refrigerant":"R134a","cop":6.2}'),
  ('55555555-0000-0000-0000-000000000006', '33333333-0000-0000-0000-000000000002', 'COMP-001', 'Air Compressor #1', 'compressor', 'medium', 'Atlas Copco', 'GA110', 'AC2022100', 180.00, 95, '{"capacity_cfm":560,"pressure_bar":10,"power_kw":110}');

-- Spare Parts
INSERT INTO spare_parts (id, site_id, part_number, name, category, unit_cost, quantity_on_hand, min_stock, max_stock, reorder_point) VALUES
  ('66666666-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'BRG-6205', 'Deep Groove Ball Bearing 6205', 'Bearings', 185.00, 24, 5, 50, 10),
  ('66666666-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'SEAL-A22', 'Mechanical Seal Type A 22mm', 'Seals', 450.00, 8, 3, 20, 5),
  ('66666666-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'BELT-B54', 'V-Belt B54', 'Belts', 95.00, 3, 5, 30, 8),
  ('66666666-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'FILT-HYD', 'Hydraulic Filter 10 Micron', 'Filters', 320.00, 12, 4, 25, 6),
  ('66666666-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'LUBR-ISO46', 'Hydraulic Oil ISO VG46 (20L)', 'Lubricants', 890.00, 6, 4, 20, 5);

-- Work Orders (sample)
INSERT INTO work_orders (wo_number, equipment_id, type, status, priority, title, description, created_by, assigned_to, sla_due_at, opened_at, estimated_hours) VALUES
  ('WO-2026-001001', '55555555-0000-0000-0000-000000000001', 'corrective', 'in_progress', 'critical', 'Spindle vibration abnormal - CNC-001', 'Operator reported excessive vibration from spindle. Noise level elevated above 85dB. Requires immediate inspection.', '44444444-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000003', NOW() + INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 4.0),
  ('WO-2026-001002', '55555555-0000-0000-0000-000000000004', 'corrective', 'open', 'high', 'PUMP-002 seal leaking', 'Water leakage detected at mechanical seal. Pump output reduced by 30%.', '44444444-0000-0000-0000-000000000002', NULL, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '30 minutes', 3.0),
  ('WO-2026-001003', '55555555-0000-0000-0000-000000000005', 'preventive', 'assigned', 'medium', 'Monthly PM - Chiller HVAC-001', 'Monthly preventive maintenance: filter cleaning, refrigerant check, bearing inspection', '44444444-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000004', NOW() + INTERVAL '20 hours', NOW() - INTERVAL '2 hours', 6.0),
  ('WO-2026-001004', '55555555-0000-0000-0000-000000000002', 'corrective', 'completed', 'high', 'Coolant pump failure - CNC-002', 'Coolant pump stopped. Replaced impeller and bearing.', '44444444-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000003', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '8 hours', 2.5);

-- Downtime Records
INSERT INTO downtime_records (equipment_id, work_order_id, type, category, description, start_time, end_time, reported_by, lost_production_units) VALUES
  ('55555555-0000-0000-0000-000000000001', NULL, 'breakdown', 'mechanical', 'Spindle bearing failure causing vibration', NOW() - INTERVAL '90 minutes', NULL, '44444444-0000-0000-0000-000000000005', 15),
  ('55555555-0000-0000-0000-000000000004', NULL, 'breakdown', 'mechanical', 'Mechanical seal failure - water leakage', NOW() - INTERVAL '45 minutes', NULL, '44444444-0000-0000-0000-000000000005', 0),
  ('55555555-0000-0000-0000-000000000002', NULL, 'breakdown', 'mechanical', 'Coolant pump failure', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '5 hours', '44444444-0000-0000-0000-000000000005', 45);

-- AI Predictions
INSERT INTO ai_predictions (equipment_id, risk_score, failure_probability, estimated_failure_date, failure_mode, recommendation, confidence_level) VALUES
  ('55555555-0000-0000-0000-000000000001', 78.5, 0.785, CURRENT_DATE + 3, 'Spindle bearing wear', 'Schedule immediate bearing replacement. Current vibration 3.2mm/s exceeds threshold of 2.8mm/s. Order: BRG-6205 x2.', 87.2),
  ('55555555-0000-0000-0000-000000000004', 65.0, 0.650, CURRENT_DATE + 7, 'Mechanical seal failure', 'Replace mechanical seal within 7 days. Leakage rate increasing. Order SEAL-A22.', 82.1),
  ('55555555-0000-0000-0000-000000000005', 45.0, 0.450, CURRENT_DATE + 14, 'Refrigerant leak', 'Check refrigerant levels. EER dropping from 6.2 to 5.1. Inspect coils.', 71.5),
  ('55555555-0000-0000-0000-000000000002', 22.0, 0.220, CURRENT_DATE + 30, 'Belt wear', 'Monitor belt tension. Consider replacement at next PM.', 65.0);
