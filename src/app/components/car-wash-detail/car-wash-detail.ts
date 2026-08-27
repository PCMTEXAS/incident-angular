import { Component, OnInit, inject, signal, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { CarWashDamageDiagramComponent } from '../car-wash-damage-diagram/car-wash-damage-diagram';
import { CarWashIncident, CwEvidence, CwCorrectiveAction, CwSupplementalNote, CwAuditEntry, CwWorkflowStage, CW_TRANSITIONS, CW_SLA_HOURS } from '../../models';

@Component({
  selector: 'app-car-wash-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule, DatePipe, CarWashDamageDiagramComponent],
  templateUrl: './car-wash-detail.html',
  styleUrl: './car-wash-detail.scss',
})
export class CarWashDetailComponent implements OnInit {
  @Input() id = '';

  auth = inject(AuthService);
  private supa = inject(SupabaseService);

  incident = signal<CarWashIncident | null>(null);
  evidence = signal<CwEvidence[]>([]);
  actions = signal<CwCorrectiveAction[]>([]);
  notes = signal<CwSupplementalNote[]>([]);
  auditLog = signal<CwAuditEntry[]>([]);

  loading = signal(true);
  error = signal('');
  activeTab = signal<'overview' | 'evidence' | 'actions' | 'notes' | 'audit' | 'workflow'>('overview');

  // New action form
  newAction = { description: '', owner: '', due_date: '' };
  // New note
  newNote = '';
  // Evidence upload
  uploadCategory = 'damage_close_up';
  uploadFile: File | null = null;
  uploading = signal(false);

  readonly evidenceCategories = ['front', 'rear', 'left_side', 'right_side', 'damage_close_up', 'wide_scene', 'equipment_area', 'signage', 'other'];

  get inc() { return this.incident(); }
  get user() { return this.auth.currentUser; }

  get allowedTransitions(): CwWorkflowStage[] {
    const stage = this.inc?.workflow_stage;
    return stage ? CW_TRANSITIONS[stage] ?? [] : [];
  }

  get isOverdue(): boolean {
    const dl = this.inc?.sla_deadline;
    return !!dl && this.inc?.workflow_stage !== 'closed' && new Date(dl) < new Date();
  }

  get slaHoursRemaining(): number {
    const dl = this.inc?.sla_deadline;
    if (!dl) return 0;
    return Math.round((new Date(dl).getTime() - Date.now()) / 3_600_000);
  }

  async ngOnInit() {
    await this.loadAll();
  }

  async loadAll() {
    this.loading.set(true);
    try {
      const inc = await this.supa.getCarWashIncident(this.id);
      this.incident.set(inc);
      if (inc) {
        const [ev, acts, notes, audit] = await Promise.all([
          this.supa.getCwEvidence(this.id),
          this.supa.getCwCorrectiveActions(this.id),
          this.supa.getCwNotes(this.id),
          this.supa.getCwAuditLog(this.id),
        ]);
        this.evidence.set(ev);
        this.actions.set(acts);
        this.notes.set(notes);
        this.auditLog.set(audit);
      }
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }

  async transition(toStage: CwWorkflowStage) {
    if (!this.inc) return;
    try {
      await this.supa.transitionCarWashStage(this.id, this.inc.incident_id, toStage, this.user?.user_id ?? 'system', this.inc.workflow_stage);
      await this.loadAll();
    } catch (e: any) {
      this.error.set(e.message);
    }
  }

  async addAction() {
    if (!this.inc || !this.newAction.description) return;
    await this.supa.createCwCorrectiveAction({ car_wash_incident_id: this.id, incident_id: this.inc.incident_id, ...this.newAction, created_by: this.user?.name });
    this.newAction = { description: '', owner: '', due_date: '' };
    this.actions.set(await this.supa.getCwCorrectiveActions(this.id));
  }

  async completeAction(action: CwCorrectiveAction) {
    await this.supa.updateCwCorrectiveAction(action.id!, { status: 'completed', completed_at: new Date().toISOString() });
    this.actions.set(await this.supa.getCwCorrectiveActions(this.id));
  }

  async addNote() {
    if (!this.inc || !this.newNote.trim()) return;
    await this.supa.addCwNote({ car_wash_incident_id: this.id, incident_id: this.inc.incident_id, note: this.newNote, created_by: this.user?.name });
    this.newNote = '';
    this.notes.set(await this.supa.getCwNotes(this.id));
  }

  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    this.uploadFile = input.files?.[0] ?? null;
  }

  async uploadEvidence() {
    if (!this.inc || !this.uploadFile) return;
    this.uploading.set(true);
    try {
      await this.supa.uploadCwEvidence(this.id, this.inc.incident_id, this.uploadFile, this.uploadCategory, this.user?.name ?? 'unknown');
      this.uploadFile = null;
      this.evidence.set(await this.supa.getCwEvidence(this.id));
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.uploading.set(false);
    }
  }

  async deleteEvidence(id: string) {
    await this.supa.deleteCwEvidence(id);
    this.evidence.set(await this.supa.getCwEvidence(this.id));
  }

  stageLabel(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  stageClass(s: string): string {
    return s.replace(/_/g, '_');
  }
}
