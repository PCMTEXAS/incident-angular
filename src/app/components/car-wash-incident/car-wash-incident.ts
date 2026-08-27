import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { CarWashDamageDiagramComponent } from '../car-wash-damage-diagram/car-wash-damage-diagram';
import { CwSite, CwEquipment } from '../../models';

interface FormData {
  // Step 2 - Customer & Vehicle
  customer_name: string; customer_phone: string; customer_email: string;
  customer_preferred_contact: string; customer_in_vehicle: boolean;
  vehicle_year: string; vehicle_make: string; vehicle_model: string;
  vehicle_color: string; vehicle_license_plate: string; vehicle_plate_state: string;
  vehicle_vin: string; vehicle_drivable: boolean; vehicle_tow_required: boolean;
  // Step 3 - Service & Equipment
  cw_site_id: string; cw_site_name: string; equipment_id: string;
  equipment_type: string; machine_mode: string; wash_stage_at_incident: string;
  wash_package: string; wash_add_ons: string[]; transaction_ref: string;
  occurred_at: string; emergency_stop_activated: boolean; lane_out_of_service: boolean;
  // Step 4 - Narrative
  narrative_employee_observations: string; narrative_customer_statement: string;
  narrative_witness_statement: string; narrative_timeline_of_events: string;
  // Step 5 - Evidence categories flag
  evidence_unavailable_reason: string;
  // Step 6 - Damage map
  damage_assessment: Record<string, any>;
  // Step 7 - Investigation
  contributing_factors: string[]; suspected_root_cause: string;
  cctv_preserved: boolean; equipment_logs_preserved: boolean;
  maintenance_docs_attached: boolean; injury_reported: boolean;
}

@Component({
  selector: 'app-car-wash-incident',
  standalone: true,
  imports: [FormsModule, CommonModule, CarWashDamageDiagramComponent],
  templateUrl: './car-wash-incident.html',
  styleUrl: './car-wash-incident.scss',
})
export class CarWashIncidentComponent implements OnInit {
  private auth = inject(AuthService);
  private supa = inject(SupabaseService);
  private router = inject(Router);

  step = signal(1);
  totalSteps = 8;
  loading = signal(false);
  submitting = signal(false);
  error = signal('');
  successId = signal('');

  sites = signal<CwSite[]>([]);
  equipment = signal<CwEquipment[]>([]);

  readonly steps = [
    'Reporter', 'Customer & Vehicle', 'Service & Equipment',
    'Narrative', 'Evidence', 'Damage Map', 'Investigation', 'Review',
  ];

  readonly washPackages = ['Basic', 'Deluxe', 'Premium', 'Ultimate', 'Monthly Member'];
  readonly washStages = ['Pre-soak', 'Foam bath', 'Wheel clean', 'High pressure rinse', 'Soap/wax application', 'Final rinse', 'Blow dry', 'Spot-free rinse'];
  readonly contributingFactors = [
    'Equipment malfunction', 'Operator error', 'Customer non-compliance',
    'Vehicle incompatibility', 'Maintenance overdue', 'Weather conditions',
    'Sensor failure', 'Software/control issue', 'Foreign object',
    'Improper loading', 'Speed too high', 'Training deficiency',
  ];
  readonly rootCauses = [
    'Equipment failure', 'Human error — operator', 'Human error — customer',
    'Design deficiency', 'Inadequate maintenance', 'Lack of training',
    'Environmental factor', 'Policy non-compliance', 'Unknown', 'Other',
  ];

  form: FormData = {
    customer_name: '', customer_phone: '', customer_email: '',
    customer_preferred_contact: 'phone', customer_in_vehicle: false,
    vehicle_year: '', vehicle_make: '', vehicle_model: '', vehicle_color: '',
    vehicle_license_plate: '', vehicle_plate_state: 'TX', vehicle_vin: '',
    vehicle_drivable: true, vehicle_tow_required: false,
    cw_site_id: '', cw_site_name: '', equipment_id: '',
    equipment_type: '', machine_mode: 'automatic', wash_stage_at_incident: '',
    wash_package: '', wash_add_ons: [], transaction_ref: '',
    occurred_at: new Date().toISOString().slice(0, 16),
    emergency_stop_activated: false, lane_out_of_service: false,
    narrative_employee_observations: '', narrative_customer_statement: '',
    narrative_witness_statement: '', narrative_timeline_of_events: '',
    evidence_unavailable_reason: '',
    damage_assessment: {},
    contributing_factors: [], suspected_root_cause: '',
    cctv_preserved: false, equipment_logs_preserved: false,
    maintenance_docs_attached: false, injury_reported: false,
  };

  get user() { return this.auth.currentUser; }

  async ngOnInit() {
    const sites = await this.supa.getCwSites();
    this.sites.set(sites);
  }

  async onSiteChange() {
    const site = this.sites().find(s => s.id === this.form.cw_site_id);
    this.form.cw_site_name = site?.name ?? '';
    this.form.equipment_id = '';
    if (this.form.cw_site_id) {
      const eq = await this.supa.getCwEquipment(this.form.cw_site_id);
      this.equipment.set(eq);
    }
  }

  onEquipmentChange() {
    const eq = this.equipment().find(e => e.id === this.form.equipment_id);
    this.form.equipment_type = eq?.equipment_type ?? '';
  }

  toggleFactor(f: string) {
    const idx = this.form.contributing_factors.indexOf(f);
    if (idx >= 0) this.form.contributing_factors.splice(idx, 1);
    else this.form.contributing_factors.push(f);
  }

  onDamageChanged(zones: Record<string, any>) {
    this.form.damage_assessment = zones;
  }

  canAdvance(): boolean {
    const s = this.step();
    if (s === 2) return !!(this.form.customer_name && this.form.vehicle_make && this.form.vehicle_model);
    if (s === 3) return !!(this.form.cw_site_id && this.form.occurred_at);
    if (s === 4) return !!this.form.narrative_employee_observations;
    return true;
  }

  next() {
    if (this.step() < this.totalSteps && this.canAdvance()) this.step.update(s => s + 1);
  }

  back() {
    if (this.step() > 1) this.step.update(s => s - 1);
  }

  async submit() {
    this.submitting.set(true);
    this.error.set('');
    try {
      const incident = await this.supa.createCarWashIncident({
        ...this.form,
        reporter_name: this.user?.name,
        reporter_email: this.user?.email,
        reporter_title: this.user?.role,
      });
      this.successId.set(incident.incident_id);
      // Fire notification (fire-and-forget)
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'car_wash', incident }),
      }).catch(() => {});
      setTimeout(() => this.router.navigate(['/car-wash', incident.id]), 1500);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.submitting.set(false);
    }
  }
}
