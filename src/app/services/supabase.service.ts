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

export interface AppUserRecord {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'reporter';
  password_hash: string;
  is_temp_password: boolean;
  invite_token: string | null;
  invite_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
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
      .from('incidents').select('*').eq('id', id).single();
    return { data, error };
  }

  async createIncident(incident: Incident): Promise<{ data: Incident | null; error: any }> {
    const { data, error } = await this.supabase
      .from('incidents').insert([incident]).select().single();
    return { data, error };
  }

  async updateIncidentStatus(id: string, status: string): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('incidents').update({ status }).eq('id', id);
    return { error };
  }

  // ── EMPLOYEES ─────────────────────────────────────────────────
  async searchEmployees(query: string): Promise<{ data: Employee[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('employees').select('*')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,employee_id.ilike.%${query}%`)
      .eq('status', 'Active').limit(10);
    return { data, error };
  }

  // ── FILE UPLOAD ────────────────────────────────────────────────
  async uploadFile(file: File, incidentId: string): Promise<{ url: string | null; error: any }> {
    const ext = file.name.split('.').pop();
    const path = `${incidentId}/${Date.now()}.${ext}`;
    const { error } = await this.supabase.storage
      .from('incident-attachments').upload(path, file);
    if (error) return { url: null, error };
    const { data } = this.supabase.storage
      .from('incident-attachments').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  // ── OSHA PDF STORAGE ──────────────────────────────────────────
  async uploadOshaPdf(filename: string, blob: Blob): Promise<{ url: string | null; error: any }> {
    const { error } = await this.supabase.storage
      .from('osha-pdfs')
      .upload(filename, blob, { upsert: true, contentType: 'application/pdf' });
    if (error) return { url: null, error };
    const { data } = this.supabase.storage.from('osha-pdfs').getPublicUrl(filename);
    return { url: data.publicUrl, error: null };
  }

  async listOshaPdfs(): Promise<{ name: string; publicUrl: string; created_at?: string }[]> {
    const { data, error } = await this.supabase.storage.from('osha-pdfs').list('', {
      limit: 200,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' }
    });
    if (error || !data) return [];
    return data.map(f => ({
      name: f.name,
      created_at: f.created_at ?? undefined,
      publicUrl: this.supabase.storage.from('osha-pdfs').getPublicUrl(f.name).data.publicUrl
    }));
  }

  async deleteOshaPdf(filename: string): Promise<{ error: any }> {
    const { error } = await this.supabase.storage.from('osha-pdfs').remove([filename]);
    return { error };
  }

  // ── STATS ──────────────────────────────────────────────────────
  async getStats(): Promise<{ total: number; open: number; recordable: number; thisMonth: number }> {
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

  // ── APP USERS ──────────────────────────────────────────────────
  async getAppUsers(): Promise<{ data: AppUserRecord[] | null; error: any }> {
    return this.supabase
      .from('app_users').select('*').order('created_at', { ascending: false });
  }

  async getUserByCredentials(userId: string, passwordHash: string): Promise<{ data: AppUserRecord | null; error: any }> {
    const { data, error } = await this.supabase
      .from('app_users').select('*')
      .eq('user_id', userId)
      .eq('password_hash', passwordHash)
      .eq('is_active', true)
      .single();
    return { data: data ?? null, error };
  }

  async getUserByInviteToken(token: string): Promise<{ user_id: string; temp_password: string } | null> {
    const { data } = await this.supabase
      .from('app_users').select('user_id, invite_token, invite_expires_at, is_active')
      .eq('invite_token', token)
      .eq('is_active', true)
      .single();
    if (!data) return null;
    if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) return null;
    return { user_id: data.user_id, temp_password: token };
  }

  async createAppUser(user: {
    user_id: string;
    name: string;
    email: string;
    role: 'admin' | 'manager' | 'reporter';
    password_hash: string;
    invite_token: string;
    invite_expires_at: string;
  }): Promise<{ data: AppUserRecord | null; error: any }> {
    const { data, error } = await this.supabase
      .from('app_users')
      .insert([{ ...user, is_temp_password: true, is_active: true }])
      .select().single();
    return { data: data ?? null, error };
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.supabase
      .from('app_users').update({ last_login: new Date().toISOString() }).eq('id', userId);
  }

  async toggleUserActive(userId: string, isActive: boolean): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('app_users').update({ is_active: isActive }).eq('id', userId);
    return { error };
  }

  async resetUserPassword(userId: string, passwordHash: string, inviteToken: string, expiresAt: string): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('app_users').update({
        password_hash: passwordHash,
        is_temp_password: true,
        invite_token: inviteToken,
        invite_expires_at: expiresAt
      }).eq('id', userId);
    return { error };
  }
}
