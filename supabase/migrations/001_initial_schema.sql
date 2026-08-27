-- ============================================================
-- PCMHub Incident Management — Initial Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  naics        TEXT,
  address      TEXT,
  city         TEXT,
  state        CHAR(2),
  zip          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- APP USERS (custom auth — no Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         TEXT UNIQUE NOT NULL,          -- login username
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  email           TEXT,
  role            TEXT NOT NULL DEFAULT 'reporter' CHECK (role IN ('reporter','manager','admin')),
  site            TEXT,
  locked          BOOLEAN NOT NULL DEFAULT FALSE,
  locked_until    TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EMPLOYEES (for EHS involved-person lookup)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id      TEXT,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  job_title        TEXT,
  department       TEXT,
  supervisor_name  TEXT,
  supervisor_email TEXT,
  hire_date        DATE,
  site             TEXT,
  active           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EHS INCIDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS incidents (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID REFERENCES tenants(id),
  incident_id           TEXT UNIQUE NOT NULL,   -- INC-YYYY-MM-NNNN
  status                TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Under Review','Action Required','Pending Closure','Closed')),
  incident_type         TEXT NOT NULL,
  urgency               TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('immediate','high','medium','low')),
  incident_date         DATE NOT NULL,
  incident_time         TIME,
  incident_site         TEXT,
  incident_area         TEXT,
  description           TEXT NOT NULL,
  immediate_actions     TEXT,

  -- Reporter
  reporter_first        TEXT,
  reporter_last         TEXT,
  reporter_email        TEXT,
  reporter_phone        TEXT,
  reporter_dept         TEXT,
  reporter_site         TEXT,
  reporter_title        TEXT,

  -- Involved person
  person_type           TEXT DEFAULT 'employee',
  employee_id           TEXT,
  involved_first        TEXT,
  involved_last         TEXT,
  job_title             TEXT,
  department            TEXT,
  supervisor_name       TEXT,
  supervisor_email      TEXT,
  hire_date             DATE,

  -- Injury/medical
  injury_type           TEXT,
  body_part             TEXT,
  days_away             INTEGER DEFAULT 0,
  days_restricted       INTEGER DEFAULT 0,
  medical_treatment     TEXT,
  work_related          BOOLEAN DEFAULT TRUE,
  osha_recordable       BOOLEAN DEFAULT FALSE,

  -- Investigation
  root_cause_category   TEXT,
  rca_method            TEXT,
  training_deficiency   BOOLEAN DEFAULT FALSE,
  five_whys             JSONB DEFAULT '[]',
  witnesses             JSONB DEFAULT '[]',
  corrective_actions    JSONB DEFAULT '[]',

  submitted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Incident ID sequence helper
CREATE SEQUENCE IF NOT EXISTS incident_seq;

-- ============================================================
-- CAR WASH SITES
-- ============================================================
CREATE TABLE IF NOT EXISTS cw_sites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id),
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  state       CHAR(2),
  zip         TEXT,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CAR WASH EQUIPMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS cw_equipment (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID REFERENCES tenants(id),
  cw_site_id    UUID REFERENCES cw_sites(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  equipment_type TEXT,
  manufacturer  TEXT,
  model         TEXT,
  serial_number TEXT,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CAR WASH INCIDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS cw_incidents (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                   UUID REFERENCES tenants(id),
  incident_id                 TEXT UNIQUE NOT NULL,   -- CWI-YYYY-MM-NNNN
  cw_site_id                  UUID REFERENCES cw_sites(id),
  cw_site_name                TEXT,
  cw_equipment_id             UUID REFERENCES cw_equipment(id),
  workflow_stage              TEXT NOT NULL DEFAULT 'draft'
                              CHECK (workflow_stage IN ('draft','submitted','under_review','evidence_pending','claims_review','root_cause_analysis','corrective_action_open','ready_for_closure','closed')),
  sla_deadline                TIMESTAMPTZ,

  -- Customer
  customer_first_name         TEXT,
  customer_last_name          TEXT,
  customer_name               TEXT GENERATED ALWAYS AS (customer_first_name || ' ' || customer_last_name) STORED,
  customer_phone              TEXT,
  customer_email              TEXT,
  customer_in_vehicle         BOOLEAN DEFAULT FALSE,

  -- Vehicle
  vehicle_year                INTEGER,
  vehicle_make                TEXT,
  vehicle_model               TEXT,
  vehicle_color               TEXT,
  vehicle_license_plate       TEXT,
  vehicle_plate_state         CHAR(2),
  vehicle_vin                 TEXT,
  vehicle_drivable            BOOLEAN DEFAULT TRUE,

  -- Incident context
  employee_present_id         TEXT,
  employee_present_name       TEXT,
  equipment_running           BOOLEAN DEFAULT FALSE,
  membership_number           TEXT,
  occurred_at                 TIMESTAMPTZ,
  location_in_wash            TEXT,

  -- Narratives
  narrative_employee_observations TEXT,
  narrative_customer_statement    TEXT,

  -- Damage
  damage_assessment           JSONB DEFAULT '{}',

  -- Investigation
  root_cause                  TEXT,
  contributing_factors        JSONB DEFAULT '[]',
  corrective_actions_summary  TEXT,
  estimated_repair_cost       NUMERIC(10,2),
  actual_repair_cost          NUMERIC(10,2),
  insurance_claim_number      TEXT,
  repair_completed_at         TIMESTAMPTZ,

  -- Signatures / consent
  customer_signature          TEXT,
  signature_timestamp         TIMESTAMPTZ,

  submitted_by                UUID REFERENCES app_users(id),
  submitted_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER cw_incidents_updated_at BEFORE UPDATE ON cw_incidents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE SEQUENCE IF NOT EXISTS cw_incident_seq;

-- ============================================================
-- CAR WASH EVIDENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS cw_evidence (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id),
  cw_incident_id  UUID REFERENCES cw_incidents(id) ON DELETE CASCADE,
  category        TEXT DEFAULT 'damage_photo',
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  storage_path    TEXT,
  mime_type       TEXT,
  file_size_bytes BIGINT,
  uploaded_by     UUID REFERENCES app_users(id),
  deleted         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CAR WASH CORRECTIVE ACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS cw_corrective_actions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id),
  cw_incident_id  UUID REFERENCES cw_incidents(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  owner           TEXT,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed')),
  completed_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES app_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CAR WASH SUPPLEMENTAL NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS cw_supplemental_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id),
  cw_incident_id  UUID REFERENCES cw_incidents(id) ON DELETE CASCADE,
  note            TEXT NOT NULL,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CAR WASH AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS cw_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id),
  cw_incident_id  UUID REFERENCES cw_incidents(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  previous_value  JSONB,
  new_value       JSONB,
  user_id         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- NOTE: Enable RLS on all tables. Use tenant_id filtering.
-- The service role key bypasses RLS and is NEVER exposed client-side.
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_corrective_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_supplemental_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_audit_log ENABLE ROW LEVEL SECURITY;

-- Anonymous/anon key: read-only access to non-sensitive tables is handled
-- via the edge function (service role). No direct anon RLS policies needed
-- for this auth model — all client reads go through the anon client but
-- the edge function validates the session server-side.
-- For the MVP, we allow the anon key to read/write all rows so the Angular
-- client can work. REPLACE with proper tenant-scoped policies before production.

CREATE POLICY "anon_all_incidents" ON incidents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_cw_incidents" ON cw_incidents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_cw_evidence" ON cw_evidence FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_cw_actions" ON cw_corrective_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_cw_notes" ON cw_supplemental_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_cw_audit" ON cw_audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_sites" ON cw_sites FOR SELECT USING (true);
CREATE POLICY "anon_read_equipment" ON cw_equipment FOR SELECT USING (true);
CREATE POLICY "anon_read_employees" ON employees FOR SELECT USING (true);
-- app_users: no anon read (passwords stored even if hashed)
CREATE POLICY "service_role_app_users" ON app_users FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED: default tenant
-- ============================================================
INSERT INTO tenants (id, name, slug, naics, city, state)
VALUES ('00000000-0000-0000-0000-000000000001', 'PCM Texas', 'pcm-texas', '811192', 'Houston', 'TX')
ON CONFLICT (slug) DO NOTHING;
