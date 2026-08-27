import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { Incident, IncidentStatus } from '../../models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, CommonModule, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private supa = inject(SupabaseService);

  incidents = signal<Incident[]>([]);
  loading = signal(true);
  error = signal('');

  // Filters
  filterStatus = '';
  filterType = '';
  filterSite = '';
  searchText = '';

  // KPIs
  kpiTotal = signal(0);
  kpiOpen = signal(0);
  kpiOsha = signal(0);
  kpiMonth = signal(0);

  // Car wash KPIs
  cwTotal = signal(0);
  cwOpen = signal(0);
  cwClaims = signal(0);
  cwClosedMonth = signal(0);

  // Pagination
  page = 1;
  pageSize = 25;

  get user() { return this.auth.currentUser; }

  get filteredIncidents() {
    return this.incidents();
  }

  get pagedIncidents() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredIncidents.slice(start, start + this.pageSize);
  }

  get totalPages() {
    return Math.ceil(this.filteredIncidents.length / this.pageSize);
  }

  readonly sites = ['Deer Park', 'Baytown', 'Texas City', 'La Porte', 'Pasadena', 'Freeport', 'Port Arthur', 'Corporate HQ'];

  readonly incidentTypes = [
    { value: 'injury', label: 'Injury' }, { value: 'illness', label: 'Illness' },
    { value: 'nearmiss', label: 'Near Miss' }, { value: 'vehicle', label: 'Vehicle' },
    { value: 'environmental', label: 'Environmental' }, { value: 'property', label: 'Property Damage' },
    { value: 'slip_fall', label: 'Slip & Fall' }, { value: 'chemical_exposure', label: 'Chemical Exposure' },
    { value: 'customer_incident', label: 'Customer Incident' }, { value: 'vehicle_damage_car_wash', label: 'Car Wash Damage' },
  ];

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const [incidents, cwStats] = await Promise.all([
        this.supa.getIncidents({ status: this.filterStatus || undefined, type: this.filterType || undefined, site: this.filterSite || undefined, search: this.searchText || undefined }),
        this.supa.getCwStats(),
      ]);
      this.incidents.set(incidents);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      this.kpiTotal.set(incidents.length);
      this.kpiOpen.set(incidents.filter(i => i.status === 'Open' || i.status === 'In Progress').length);
      this.kpiOsha.set(incidents.filter(i => i.osha_recordable).length);
      this.kpiMonth.set(incidents.filter(i => i.submitted_at && i.submitted_at >= monthStart).length);
      this.cwTotal.set(cwStats.total);
      this.cwOpen.set(cwStats.open);
      this.cwClaims.set(cwStats.claimsOpen);
      this.cwClosedMonth.set(cwStats.closedThisMonth);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }

  async applyFilters() {
    this.page = 1;
    await this.loadData();
  }

  clearFilters() {
    this.filterStatus = '';
    this.filterType = '';
    this.filterSite = '';
    this.searchText = '';
    this.applyFilters();
  }

  async updateStatus(incident: Incident, status: IncidentStatus) {
    try {
      await this.supa.updateIncident(incident.id!, { status });
      await this.loadData();
    } catch (e: any) {
      this.error.set(e.message);
    }
  }

  urgencyColor(u: string) {
    return { immediate: 'danger', high: 'warning', medium: 'info', low: 'secondary' }[u] ?? 'secondary';
  }

  statusColor(s: string) {
    return { 'Open': 'danger', 'In Progress': 'warning', 'Pending Review': 'info', 'Closed': 'success' }[s] ?? 'secondary';
  }
}
