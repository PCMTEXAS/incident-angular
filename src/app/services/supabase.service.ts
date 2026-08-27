import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import {
  Incident, CarWashIncident, CwSite, CwEquipment,
  CwEvidence, CwCorrectiveAction, CwSupplementalNote,
  CwAuditEntry, CwWorkflowStage, CW_SLA_HOURS,
} from '../models';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  // ─── EHS Incidents ────────────────────────────────────────────────────────

  async getIncidents(filters?: { status?: string; type?: string; site?: string; search?: string }): Promise<Incident[]> {
    let q = this.client.from('incidents').select('*').order('submitted_at', { ascending: false });
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.type)   q = q.eq('incident_type', filters.type);
    if (filters?.site)   q = q.eq('incident_site', filters.site);
    if (filters?.search) q = q.or(`incident_id.ilike.%${filters.search}%,description.ilike.%${filters.search}%,reporter_last.ilike.%${filters.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async getIncident(id: string): Promise<Incident | null> {
    const { data, error } = await this.client.from('incidents').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async createIncident(incident: Partial<Incident>): Promise<Incident> {
    const { data, error } = await this.client.from('incidents').insert(incident).select().single();
    if (error) throw error;
    return data;
  }

  async updateIncident(id: string, patch: Partial<Incident>): Promise<Incident> {
    const { data, error } = await this.client.from('incidents').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async generateIncidentId(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const { count } = await this.client.from('incidents').select('*', { count: 'exact', head: true }).like('incident_id', `INC-${y}-${m}-%`);
    const seq = String((count ?? 0) + 1).padStart(4, '0');
    return `INC-${y}-${m}-${seq}`;
  }

  async getEmployees(): Promise<any[]> {
    const { data, error } = await this.client.from('employees').select('*').eq('status', 'active').order('last_name');
    if (error) throw error;
    return data ?? [];
  }

  async uploadIncidentAttachment(incidentId: string, file: File): Promise<string> {
    const path = `${incidentId}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await this.client.storage.from('incident-attachments').upload(path, file);
    if (error) throw error;
    const { data } = this.client.storage.from('incident-attachments').getPublicUrl(path);
    return data.publicUrl;
  }

  // ─── Car Wash: Sites & Equipment ─────────────────────────────────────────

  async getCwSites(): Promise<CwSite[]> {
    const { data, error } = await this.client.from('cw_sites').select('*').eq('active', true).order('name');
    if (error) throw error;
    return data ?? [];
  }

  async getCwEquipment(siteId: string): Promise<CwEquipment[]> {
    const { data, error } = await this.client.from('cw_equipment').select('*').eq('site_id', siteId).eq('active', true).order('name');
    if (error) throw error;
    return data ?? [];
  }

  // ─── Car Wash: Incidents ─────────────────────────────────────────────────

  async getCarWashIncidents(filters?: { stage?: string; search?: string }): Promise<CarWashIncident[]> {
    let q = this.client.from('car_wash_incidents').select('*').order('created_at', { ascending: false });
    if (filters?.stage)  q = q.eq('workflow_stage', filters.stage);
    if (filters?.search) q = q.or(`incident_id.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,cw_site_name.ilike.%${filters.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async getCarWashIncident(id: string): Promise<CarWashIncident | null> {
    const { data, error } = await this.client.from('car_wash_incidents').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async createCarWashIncident(incident: Partial<CarWashIncident>): Promise<CarWashIncident> {
    const incidentId = await this.generateCwIncidentId();
    const now = new Date();
    const slaMs = (CW_SLA_HOURS['draft'] ?? 48) * 3_600_000;
    const payload = {
      ...incident,
      incident_id: incidentId,
      workflow_stage: 'draft' as CwWorkflowStage,
      sla_deadline: new Date(now.getTime() + slaMs).toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const { data, error } = await this.client.from('car_wash_incidents').insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async updateCarWashIncident(id: string, patch: Partial<CarWashIncident>): Promise<CarWashIncident> {
    const { data, error } = await this.client.from('car_wash_incidents')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async transitionCarWashStage(id: string, incidentId: string, toStage: CwWorkflowStage, userId: string, prevStage: CwWorkflowStage): Promise<void> {
    const now = new Date();
    const slaMs = (CW_SLA_HOURS[toStage] ?? 0) * 3_600_000;
    const slaDeadline = toStage !== 'closed' ? new Date(now.getTime() + slaMs).toISOString() : null;
    await this.client.from('car_wash_incidents').update({ workflow_stage: toStage, sla_deadline: slaDeadline, updated_at: now.toISOString() }).eq('id', id);
    await this.addCwAuditEntry({ car_wash_incident_id: id, incident_id: incidentId, user_id: userId, action: `Stage changed: ${prevStage} → ${toStage}`, previous_value: { stage: prevStage }, new_value: { stage: toStage } });
  }

  async generateCwIncidentId(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const { count } = await this.client.from('car_wash_incidents').select('*', { count: 'exact', head: true }).like('incident_id', `CWI-${y}-${m}-%`);
    const seq = String((count ?? 0) + 1).padStart(4, '0');
    return `CWI-${y}-${m}-${seq}`;
  }

  async getCwStats(): Promise<{ total: number; open: number; claimsOpen: number; closedThisMonth: number }> {
    const openStages: CwWorkflowStage[] = ['submitted', 'under_review', 'evidence_pending', 'claims_review', 'root_cause_analysis', 'corrective_action_open', 'ready_for_closure'];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [total, open, claimsOpen, closedThisMonth] = await Promise.all([
      this.client.from('car_wash_incidents').select('*', { count: 'exact', head: true }),
      this.client.from('car_wash_incidents').select('*', { count: 'exact', head: true }).in('workflow_stage', openStages),
      this.client.from('car_wash_incidents').select('*', { count: 'exact', head: true }).in('claim_status', ['filed', 'under_review']),
      this.client.from('car_wash_incidents').select('*', { count: 'exact', head: true }).eq('workflow_stage', 'closed').gte('updated_at', monthStart),
    ]);

    return { total: total.count ?? 0, open: open.count ?? 0, claimsOpen: claimsOpen.count ?? 0, closedThisMonth: closedThisMonth.count ?? 0 };
  }

  // ─── Car Wash: Evidence ──────────────────────────────────────────────────

  async getCwEvidence(carWashIncidentId: string): Promise<CwEvidence[]> {
    const { data, error } = await this.client.from('cw_evidence').select('*').eq('car_wash_incident_id', carWashIncidentId).is('deleted_at', null).order('created_at');
    if (error) throw error;
    return data ?? [];
  }

  async uploadCwEvidence(carWashIncidentId: string, incidentId: string, file: File, category: string, uploadedBy: string): Promise<CwEvidence> {
    const ext = file.name.split('.').pop();
    const path = `${incidentId}/${category}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await this.client.storage.from('cw-evidence').upload(path, file);
    if (uploadErr) throw uploadErr;
    const { data: urlData } = this.client.storage.from('cw-evidence').getPublicUrl(path);
    const record: Partial<CwEvidence> = { car_wash_incident_id: carWashIncidentId, incident_id: incidentId, category, file_url: urlData.publicUrl, file_name: file.name, file_size: file.size, mime_type: file.type, uploaded_by: uploadedBy };
    const { data, error } = await this.client.from('cw_evidence').insert(record).select().single();
    if (error) throw error;
    return data;
  }

  async deleteCwEvidence(id: string): Promise<void> {
    const { error } = await this.client.from('cw_evidence').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  // ─── Car Wash: Corrective Actions ────────────────────────────────────────

  async getCwCorrectiveActions(carWashIncidentId: string): Promise<CwCorrectiveAction[]> {
    const { data, error } = await this.client.from('cw_corrective_actions').select('*').eq('car_wash_incident_id', carWashIncidentId).order('created_at');
    if (error) throw error;
    return data ?? [];
  }

  async createCwCorrectiveAction(action: Partial<CwCorrectiveAction>): Promise<CwCorrectiveAction> {
    const { data, error } = await this.client.from('cw_corrective_actions').insert({ ...action, status: 'open', created_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    return data;
  }

  async updateCwCorrectiveAction(id: string, patch: Partial<CwCorrectiveAction>): Promise<CwCorrectiveAction> {
    const { data, error } = await this.client.from('cw_corrective_actions').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  // ─── Car Wash: Notes ─────────────────────────────────────────────────────

  async getCwNotes(carWashIncidentId: string): Promise<CwSupplementalNote[]> {
    const { data, error } = await this.client.from('cw_supplemental_notes').select('*').eq('car_wash_incident_id', carWashIncidentId).order('created_at');
    if (error) throw error;
    return data ?? [];
  }

  async addCwNote(note: Partial<CwSupplementalNote>): Promise<CwSupplementalNote> {
    const { data, error } = await this.client.from('cw_supplemental_notes').insert({ ...note, created_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    return data;
  }

  // ─── Car Wash: Audit Log ─────────────────────────────────────────────────

  async getCwAuditLog(carWashIncidentId: string): Promise<CwAuditEntry[]> {
    const { data, error } = await this.client.from('cw_audit_log').select('*').eq('car_wash_incident_id', carWashIncidentId).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async addCwAuditEntry(entry: Partial<CwAuditEntry>): Promise<void> {
    await this.client.from('cw_audit_log').insert({ ...entry, created_at: new Date().toISOString() });
  }

  // ─── OSHA Storage ────────────────────────────────────────────────────────

  async listOshaPdfs(): Promise<any[]> {
    const { data, error } = await this.client.storage.from('osha-pdfs').list('', { sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;
    return data ?? [];
  }

  getOshaPdfUrl(path: string): string {
    const { data } = this.client.storage.from('osha-pdfs').getPublicUrl(path);
    return data.publicUrl;
  }

  async deleteOshaPdf(path: string): Promise<void> {
    const { error } = await this.client.storage.from('osha-pdfs').remove([path]);
    if (error) throw error;
  }
}
