import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { Incident } from '../../models';

@Component({
  selector: 'app-incident-form',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './incident-form.html',
  styleUrl: './incident-form.scss',
})
export class IncidentFormComponent implements OnInit {
  protected auth = inject(AuthService);
  private supa = inject(SupabaseService);
  private router = inject(Router);

  step = signal(1);
  totalSteps = 6;
  submitting = signal(false);
  error = signal('');
  successId = signal('');

  employees: any[] = [];

  readonly steps = ['Reporter', 'Incident', 'Involved Person', 'Injury/Medical', 'Investigation', 'Review'];

  readonly incidentTypes = [
    { value: 'injury', label: 'Injury' }, { value: 'illness', label: 'Illness' },
    { value: 'nearmiss', label: 'Near Miss' }, { value: 'vehicle', label: 'Vehicle' },
    { value: 'environmental', label: 'Environmental' }, { value: 'property', label: 'Property Damage' },
    { value: 'contractor', label: 'Contractor' }, { value: 'security', label: 'Security' },
    { value: 'observation', label: 'Observation' }, { value: 'chemical_exposure', label: 'Chemical Exposure' },
    { value: 'slip_fall', label: 'Slip & Fall' }, { value: 'equipment_contact', label: 'Equipment Contact' },
    { value: 'vehicle_damage', label: 'Vehicle Damage' }, { value: 'customer_incident', label: 'Customer Incident' },
    { value: 'vehicle_damage_car_wash', label: 'Car Wash Damage' },
  ];

  readonly urgencies = [{ value: 'immediate', label: 'Immediate' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }];
  readonly sites = ['Deer Park', 'Baytown', 'Texas City', 'La Porte', 'Pasadena', 'Freeport', 'Port Arthur', 'Corporate HQ'];
  readonly departments = ['Operations', 'Maintenance', 'Safety', 'Engineering', 'Logistics', 'QA/QC', 'Administration', 'Contractor'];
  readonly injuryTypes = ['Laceration', 'Contusion', 'Fracture', 'Sprain/Strain', 'Burns', 'Eye injury', 'Hearing loss', 'Respiratory', 'Chemical exposure', 'Fatality', 'Other'];
  readonly bodyParts = ['Head', 'Face', 'Eye(s)', 'Neck', 'Back', 'Chest', 'Abdomen', 'Shoulder', 'Arm', 'Hand/Wrist', 'Leg', 'Knee', 'Foot/Ankle', 'Multiple'];
  readonly rootCauseCategories = ['Human error', 'Equipment failure', 'Environmental', 'Procedure deficiency', 'Training deficiency', 'Supervision deficiency', 'Communication failure', 'Other'];
  readonly rcaMethods = ['5-Why', 'Fishbone', 'Bowtie', 'FMEA', 'Other'];

  form: Partial<Incident> & { five_whys_text: string; witnesses_text: string; corrective_actions_text: string } = {
    reporter_first: '', reporter_last: '', reporter_email: '', reporter_phone: '',
    reporter_dept: '', reporter_site: '', reporter_title: '',
    incident_type: 'injury', urgency: 'medium',
    incident_date: new Date().toISOString().slice(0, 10),
    incident_time: new Date().toTimeString().slice(0, 5),
    incident_site: '', incident_area: '', description: '', immediate_actions: '',
    person_type: 'employee', involved_first: '', involved_last: '',
    employee_id: '', job_title: '', department: '', hire_date: '',
    supervisor_name: '', supervisor_email: '',
    injury_type: '', body_part: '', days_away: 0, days_restricted: 0,
    medical_treatment: '', work_related: true, osha_recordable: false,
    root_cause_category: '', training_deficiency: false, rca_method: '',
    five_whys_text: '', witnesses_text: '', corrective_actions_text: '',
  };

  get user() { return this.auth.currentUser; }

  async ngOnInit() {
    const u = this.user;
    if (u) {
      this.form.reporter_first = u.name?.split(' ')[0] ?? '';
      this.form.reporter_last = u.name?.split(' ').slice(1).join(' ') ?? '';
      this.form.reporter_email = u.email ?? '';
    }
    try {
      this.employees = await this.supa.getEmployees();
    } catch {}
  }

  onEmployeeSelect(empId: string) {
    const emp = this.employees.find(e => e.employee_id === empId || e.id === empId);
    if (emp) {
      this.form.involved_first = emp.first_name;
      this.form.involved_last = emp.last_name;
      this.form.job_title = emp.job_title;
      this.form.department = emp.department;
      this.form.supervisor_name = emp.supervisor_name;
      this.form.supervisor_email = emp.supervisor_email;
      this.form.hire_date = emp.hire_date;
    }
  }

  computeOsha() {
    const medical = this.form.medical_treatment ?? '';
    const days = (this.form.days_away ?? 0) + (this.form.days_restricted ?? 0);
    const type = this.form.incident_type ?? '';
    const recordable = ['injury', 'illness', 'chemical_exposure', 'slip_fall', 'equipment_contact'].includes(type) && (medical !== 'first_aid_only' || days > 0);
    this.form.osha_recordable = recordable;
  }

  canAdvance(): boolean {
    const s = this.step();
    if (s === 1) return !!(this.form.reporter_first && this.form.reporter_last);
    if (s === 2) return !!(this.form.incident_type && this.form.incident_date && this.form.description);
    return true;
  }

  next() { if (this.step() < this.totalSteps && this.canAdvance()) this.step.update(s => s + 1); }
  back() { if (this.step() > 1) this.step.update(s => s - 1); }

  async submit() {
    this.submitting.set(true);
    this.error.set('');
    try {
      const incidentId = await this.supa.generateIncidentId();
      const { five_whys_text, witnesses_text, corrective_actions_text, ...rest } = this.form;
      const payload: Partial<Incident> = {
        ...rest,
        incident_id: incidentId,
        status: 'Open',
        five_whys: five_whys_text.split('\n').filter(Boolean),
        witnesses: witnesses_text.split('\n').filter(Boolean),
        corrective_actions: corrective_actions_text.split('\n').filter(Boolean),
        submitted_at: new Date().toISOString(),
      };
      const incident = await this.supa.createIncident(payload);
      this.successId.set(incidentId);
      fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'ehs', incident }) }).catch(() => {});
      setTimeout(() => this.router.navigate(['/incident', incident.id]), 1500);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.submitting.set(false);
    }
  }
}
