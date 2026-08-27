import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-osha-300a',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './osha-300a.html',
  styleUrl: './osha-300a.scss',
})
export class Osha300aComponent implements OnInit {
  private supa = inject(SupabaseService);

  loading = signal(true);
  error = signal('');

  year = new Date().getFullYear();
  site = '';
  incidents: any[] = [];

  readonly sites = ['All Sites', 'Deer Park', 'Baytown', 'Texas City', 'La Porte', 'Pasadena', 'Freeport', 'Port Arthur'];

  company = { name: 'PCM Texas', naics: '811192', address: '123 Main St', city: 'Houston', state: 'TX', zip: '77001' };
  certName = '';
  certTitle = '';
  certDate = new Date().toISOString().slice(0, 10);

  get recordables() { return this.incidents.filter(i => i.osha_recordable); }
  get deathCount() { return this.incidents.filter(i => i.injury_type === 'Fatality').length; }
  get daysAwayCount() { return this.incidents.filter(i => (i.days_away ?? 0) > 0).length; }
  get restrictedCount() { return this.incidents.filter(i => (i.days_restricted ?? 0) > 0 && !(i.days_away > 0)).length; }
  get otherCount() { return this.recordables.length - this.deathCount - this.daysAwayCount - this.restrictedCount; }
  get totalDaysAway() { return this.incidents.reduce((s, i) => s + (i.days_away ?? 0), 0); }
  get totalDaysRestricted() { return this.incidents.reduce((s, i) => s + (i.days_restricted ?? 0), 0); }
  get injuryCount() { return this.incidents.filter(i => i.osha_recordable && i.incident_type === 'injury').length; }
  get illnessCount() { return this.incidents.filter(i => i.osha_recordable && i.incident_type === 'illness').length; }
  get totalHoursWorked() { return this.incidents.length > 0 ? 250000 : 0; }
  get avgEmployees() { return 15; }
  get incidentRate() { return this.totalHoursWorked > 0 ? ((this.recordables.length * 200000) / this.totalHoursWorked).toFixed(1) : '0.0'; }

  async ngOnInit() { await this.loadData(); }

  async loadData() {
    this.loading.set(true);
    try {
      const filters: any = { year: this.year };
      if (this.site && this.site !== 'All Sites') filters.site = this.site;
      this.incidents = await this.supa.getIncidents(filters);
    } catch (e: any) { this.error.set(e.message); }
    finally { this.loading.set(false); }
  }

  print() { window.print(); }
}
