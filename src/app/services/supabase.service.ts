import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface Incident {
  id?: string;
  incident_id?: string;
  submitted_at?: string;
  status?: string;
  reporter_first?: string;
  reporter_last?: string;
  reporter_email?: string;
  reporter_phone?: string;
  reporter_dept?: string;
  reporter_site?: string;
  reporter_title?: string;
  incident_type?: string;
  urgency?: string;
  incident_date?: string;
  incident_time?: string;
  incident_site?: string;
  incident_area?: string;
  description?: string;
  immediate_actions?: string;
  equipment_involved?: string;
  person_type?: string;
  involved_first?: string;
  involved_last?: string;
  employee_id?: string;
  job_title?: string;
  department?: string;
  hire_date?: string;
  supervisor_name?: string;
  supervisor_email?: string;
  injury_type?: string;
  body_area?: string;
  body_part?: string;
  days_away?: number;
  days_restricted?: number;
  medical_treatment?: string;
  work_related?: string;
  osha_recordable?: boolean;
  osha_result?: string;
  root_cause_category?: string;
  training_deficiency?: boolean;
  rca_method?: string;
  witnesses?: any[];
  corrective_actions?: any[];
  five_whys?: any[];
  attachments?: any[];
  updated_at?: string;
}

export interface Employee {
  id?: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title?: string;
  department?: string;
  site?: string;
  supervisor_name?: string;
  supervisor_email?: string;
  hire_date?: string;
  status?: string;
  shift?: string;
  union_member?: boolean;
  email?: string;
  phone?: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  // ── INCIDENTS ─────────────────────────────────────────────────
  async getIncidents(filters?: {
    status?: string;
    incident_type?: string;
    incident_site?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ data: Incident[] | null; error: any }> {
    let query = this.supabase
      .from('incidents')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.incident_type) query = query.eq('incident_type', filters.incident_type);
    if (filters?.incident_site) query = query.eq('incident_site', filters.incident_site);
    if (filters?.dateFrom) query = query.gte('incident_date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('incident_date', filters.dateTo);

    return query;
  }

  async getIncidentById(id: string): Promise<{ data: Incident | null; error: any }> {
    const { data, error } = await this.supabase
      .from('incidents')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  }

  async createIncident(incident: Incident): Promise<{ data: Incident | null; error: any }> {
    const { data, error } = await this.supabase
      .from('incidents')
      .insert([incident])
      .select()
      .single();
    return { data, error };
  }

  async updateIncidentStatus(id: string, status: string): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('incidents')
      .update({ status })
      .eq('id', id);
    return { error };
  }

  // ── EMPLOYEES ─────────────────────────────────────────────────
  async searchEmployees(query: string): Promise<{ data: Employee[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('employees')
      .select('*')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,employee_id.ilike.%${query}%`)
      .eq('status', 'Active')
      .limit(10);
    return { data, error };
  }

  // ── FILE UPLOAD ────────────────────────────────────────────────
  async uploadFile(file: File, incidentId: string): Promise<{ url: string | null; error: any }> {
    const ext = file.name.split('.').pop();
    const path = `${incidentId}/${Date.now()}.${ext}`;
    const { error } = await this.supabase.storage
      .from('incident-attachments')
      .upload(path, file);
    if (error) return { url: null, error };
    const { data } = this.supabase.storage
      .from('incident-attachments')
      .getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  // ── STATS ──────────────────────────────────────────────────────
  async getStats(): Promise<{
    total: number;
    open: number;
    recordable: number;
    thisMonth: number;
  }> {
    const { data } = await this.supabase.from('incidents').select('status, osha_recordable, incident_date');
    if (!data) return { total: 0, open: 0, recordable: 0, thisMonth: 0 };

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return {
      total: data.length,
      open: data.filter(r => r.status === 'Open' || r.status === 'In Progress').length,
      recordable: data.filter(r => r.osha_recordable).length,
      thisMonth: data.filter(r => r.incident_date?.startsWith(monthStr)).length
    };
  }
}
