// ─── Auth ───────────────────────────────────────────────────────────────────

export type UserRole = 'reporter' | 'manager' | 'admin';

export interface AppUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  is_temp_password?: boolean;
}

// ─── Tenant ─────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  admin_email: string;
  active: boolean;
  created_at: string;
}

// ─── EHS Incident ────────────────────────────────────────────────────────────

export type IncidentStatus = 'Open' | 'In Progress' | 'Pending Review' | 'Closed';

export type IncidentType =
  | 'injury' | 'illness' | 'nearmiss' | 'vehicle' | 'environmental'
  | 'property' | 'contractor' | 'security' | 'observation'
  | 'chemical_exposure' | 'slip_fall' | 'equipment_contact'
  | 'vehicle_damage' | 'customer_incident' | 'vehicle_damage_car_wash';

export type Urgency = 'immediate' | 'high' | 'medium' | 'low';

export interface Incident {
  id?: string;
  incident_id: string;
  tenant_id?: string;
  status: IncidentStatus;
  incident_type: IncidentType;
  urgency: Urgency;
  incident_date: string;
  incident_time: string;
  incident_site: string;
  incident_area?: string;
  description: string;
  immediate_actions?: string;
  equipment_involved?: string;
  // Reporter
  reporter_first: string;
  reporter_last: string;
  reporter_email?: string;
  reporter_phone?: string;
  reporter_dept?: string;
  reporter_site?: string;
  reporter_title?: string;
  // Involved
  person_type?: 'employee' | 'contractor' | 'visitor' | 'customer';
  involved_first?: string;
  involved_last?: string;
  employee_id?: string;
  job_title?: string;
  department?: string;
  hire_date?: string;
  supervisor_name?: string;
  supervisor_email?: string;
  // Medical / OSHA
  injury_type?: string;
  body_area?: string;
  body_part?: string;
  days_away?: number;
  days_restricted?: number;
  medical_treatment?: string;
  work_related?: boolean;
  osha_recordable?: boolean;
  osha_result?: string;
  // Investigation
  root_cause_category?: string;
  training_deficiency?: boolean;
  rca_method?: string;
  five_whys?: string[];
  witnesses?: string[];
  corrective_actions?: string[];
  attachments?: string[];
  submitted_at?: string;
  updated_at?: string;
}

// ─── Car Wash ────────────────────────────────────────────────────────────────

export type CwWorkflowStage =
  | 'draft' | 'submitted' | 'under_review' | 'evidence_pending'
  | 'claims_review' | 'root_cause_analysis' | 'corrective_action_open'
  | 'ready_for_closure' | 'closed';

export const CW_STAGES: CwWorkflowStage[] = [
  'draft', 'submitted', 'under_review', 'evidence_pending',
  'claims_review', 'root_cause_analysis', 'corrective_action_open',
  'ready_for_closure', 'closed',
];

export const CW_TRANSITIONS: Record<CwWorkflowStage, CwWorkflowStage[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'evidence_pending'],
  under_review: ['evidence_pending', 'claims_review', 'root_cause_analysis'],
  evidence_pending: ['under_review'],
  claims_review: ['root_cause_analysis', 'corrective_action_open', 'ready_for_closure'],
  root_cause_analysis: ['corrective_action_open', 'ready_for_closure'],
  corrective_action_open: ['ready_for_closure'],
  ready_for_closure: ['closed'],
  closed: [],
};

export const CW_SLA_HOURS: Record<CwWorkflowStage, number> = {
  draft: 48, submitted: 4, under_review: 24, evidence_pending: 72,
  claims_review: 120, root_cause_analysis: 72, corrective_action_open: 168,
  ready_for_closure: 24, closed: 0,
};

export interface CwSite {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  active: boolean;
}

export interface CwEquipment {
  id: string;
  site_id: string;
  name: string;
  equipment_type?: string;
  active: boolean;
  last_maintenance_date?: string;
  last_inspection_date?: string;
}

export interface CarWashIncident {
  id?: string;
  incident_id: string;
  tenant_id?: string;
  base_incident_uuid?: string;
  workflow_stage: CwWorkflowStage;
  assigned_to?: string;
  sla_deadline?: string;
  // Customer
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_preferred_contact?: string;
  customer_in_vehicle?: boolean;
  // Vehicle
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_license_plate?: string;
  vehicle_plate_state?: string;
  vehicle_vin?: string;
  vehicle_drivable?: boolean;
  vehicle_tow_required?: boolean;
  // Site / Equipment
  cw_site_id?: string;
  cw_site_name?: string;
  equipment_id?: string;
  bay_tunnel_label?: string;
  equipment_type?: string;
  machine_mode?: string;
  wash_stage_at_incident?: string;
  wash_package?: string;
  wash_add_ons?: string[];
  transaction_ref?: string;
  occurred_at?: string;
  emergency_stop_activated?: boolean;
  lane_out_of_service?: boolean;
  // Narratives
  narrative_employee_observations?: string;
  narrative_customer_statement?: string;
  narrative_witness_statement?: string;
  narrative_timeline_of_events?: string;
  // Evidence flags
  cctv_preserved?: boolean;
  equipment_logs_preserved?: boolean;
  maintenance_docs_attached?: boolean;
  repair_estimate_attached?: boolean;
  evidence_unavailable_reason?: string;
  // Investigation
  damage_assessment?: Record<string, any>;
  contributing_factors?: string[];
  suspected_root_cause?: string;
  confirmed_root_cause?: string;
  // Claim
  claim_number?: string;
  claim_status?: string;
  claim_amount?: number;
  claim_resolution_notes?: string;
  // Closure
  closure_notes?: string;
  closure_corrective_actions_complete?: boolean;
  closure_approved_by?: string;
  // Reporter (from logged-in user)
  reporter_name?: string;
  reporter_email?: string;
  reporter_title?: string;
  injury_reported?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CwEvidence {
  id: string;
  car_wash_incident_id: string;
  incident_id: string;
  category: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  notes?: string;
  uploaded_by?: string;
  created_at: string;
}

export interface CwCorrectiveAction {
  id?: string;
  car_wash_incident_id: string;
  incident_id: string;
  description: string;
  owner?: string;
  due_date?: string;
  status: 'open' | 'in_progress' | 'completed';
  completion_notes?: string;
  completed_at?: string;
  created_by?: string;
  created_at?: string;
}

export interface CwSupplementalNote {
  id?: string;
  car_wash_incident_id: string;
  incident_id: string;
  note: string;
  created_by?: string;
  created_at?: string;
}

export interface CwAuditEntry {
  id?: string;
  car_wash_incident_id: string;
  incident_id: string;
  user_id?: string;
  action: string;
  previous_value?: Record<string, any>;
  new_value?: Record<string, any>;
  created_at?: string;
}
