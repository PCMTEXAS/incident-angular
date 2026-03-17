import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService, Incident } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TitleCasePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  incidents: Incident[] = [];
  filteredIncidents: Incident[] = [];
  loading = true;
  error = '';

  filterStatus = '';
  filterType = '';
  filterSite = '';
  filterFrom = '';
  filterTo = '';
  searchText = '';

  sortCol = 'submitted_at';
  sortDir: 'asc' | 'desc' = 'desc';

  stats = { total: 0, open: 0, recordable: 0, thisMonth: 0 };

  pageSize = 25;
  currentPage = 1;

  selectedIncident: Incident | null = null;
  updatingId = '';

  readonly STATUSES = ['', 'Open', 'In Progress', 'Pending Review', 'Closed'];
  readonly INCIDENT_TYPES = ['', 'injury', 'illness', 'nearmiss', 'vehicle', 'environmental', 'property', 'contractor', 'security', 'observation'];
  readonly SITES = ['', 'Deer Park', 'Baytown', 'Texas City', 'La Porte', 'Pasadena', 'Freeport', 'Port Arthur', 'Corporate HQ'];

  constructor(private supabase: SupabaseService, private auth: AuthService, private router: Router) {}

  ngOnInit() {
    if (!this.auth.isAuthenticated()) { this.router.navigate(['/login']); return; }
    this.loadData();
  }

  async loadData() {
    this.loading = true; this.error = '';
    const [{ data, error }, stats] = await Promise.all([
      this.supabase.getIncidents(),
      this.supabase.getStats()
    ]);
    this.loading = false;
    if (error) { this.error = error.message; return; }
    this.incidents = data || [];
    this.stats = stats;
    this.applyFilters();
  }

  applyFilters() {
    let rows = [...this.incidents];
    if (this.filterStatus) rows = rows.filter(r => r.status === this.filterStatus);
    if (this.filterType) rows = rows.filter(r => r.incident_type === this.filterType);
    if (this.filterSite) rows = rows.filter(r => r.incident_site === this.filterSite);
    if (this.filterFrom) rows = rows.filter(r => r.incident_date && r.incident_date >= this.filterFrom);
    if (this.filterTo) rows = rows.filter(r => r.incident_date && r.incident_date <= this.filterTo);
    if (this.searchText) {
      const q = this.searchText.toLowerCase();
      rows = rows.filter(r =>
        r.incident_id?.toLowerCase().includes(q) ||
        r.involved_first?.toLowerCase().includes(q) ||
        r.involved_last?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.incident_site?.toLowerCase().includes(q)
      );
    }
    rows.sort((a,b) => {
      const av = (a as any)[this.sortCol] ?? '';
      const bv = (b as any)[this.sortCol] ?? '';
      return this.sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    this.filteredIncidents = rows;
    this.currentPage = 1;
  }

  clearFilters() {
    this.filterStatus = this.filterType = this.filterSite = this.filterFrom = this.filterTo = this.searchText = '';
    this.applyFilters();
  }

  sort(col: string) {
    if (this.sortCol === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortCol = col; this.sortDir = 'asc'; }
    this.applyFilters();
  }

  sortIcon(col: string): string {
    if (this.sortCol !== col) return 'bi-arrow-down-up text-muted';
    return this.sortDir === 'asc' ? 'bi-sort-up' : 'bi-sort-down';
  }

  get pagedIncidents(): Incident[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredIncidents.slice(start, start + this.pageSize);
  }

  get totalPages(): number { return Math.ceil(this.filteredIncidents.length / this.pageSize); }
  get pages(): number[] { return Array.from({length: this.totalPages}, (_, i) => i + 1); }

  openDetail(inc: Incident) { this.selectedIncident = inc; }
  closeDetail() { this.selectedIncident = null; }

  async updateStatus(inc: Incident, status: string) {
    if (!inc.id) return;
    this.updatingId = inc.id;
    await this.supabase.updateIncidentStatus(inc.id, status);
    inc.status = status;
    this.updatingId = '';
    this.applyFilters();
    this.stats.open = this.incidents.filter(r => r.status === 'Open' || r.status === 'In Progress').length;
  }

  statusBadge(status?: string): string {
    const map: Record<string,string> = {
      'Open':'bg-danger','In Progress':'bg-warning text-dark',
      'Pending Review':'bg-info text-dark','Closed':'bg-success'
    };
    return map[status || ''] || 'bg-secondary';
  }

  urgencyBadge(u?: string): string {
    const map: Record<string,string> = {
      immediate:'bg-danger',high:'bg-warning text-dark',medium:'bg-info text-dark',low:'bg-success'
    };
    return map[u || ''] || 'bg-secondary';
  }

  typeLabel(t?: string): string {
    const map: Record<string,string> = {
      injury:'Injury',illness:'Illness',nearmiss:'Near Miss',vehicle:'Vehicle',
      environmental:'Environmental',property:'Property',contractor:'Contractor',
      security:'Security',observation:'Observation'
    };
    return map[t || ''] || t || '—';
  }

  exportOsha300() {
    const recordable = this.incidents.filter(r => r.osha_recordable);
    const header = ['Case#','Employee Name','Job Title','Date','Where','Describe Injury/Illness',
      'Classify: Death','Days Away','Job Transfer','Other Recordable','Days Away #',
      'Days Restricted #','Injury','Skin Disorder','Respiratory','Poisoning','Hearing Loss','All Other'].join(',');
    const rows = recordable.map(r => {
      const name = `"${r.involved_first||''} ${r.involved_last||''}"`;
      const desc = `"${(r.description||'').replace(/"/g,'""').substring(0,100)}"`;
      const daysAway = Number(r.days_away)||0;
      const daysRestr = Number(r.days_restricted)||0;
      const isInjury = r.incident_type !== 'illness' ? 'X' : '';
      const isIllness = r.incident_type === 'illness' ? 'X' : '';
      return [r.incident_id||'',name,`"${r.job_title||''}"`,r.incident_date||'',
        `"${r.incident_site||''} - ${r.incident_area||''}"`,desc,'',
        daysAway>0?'X':'',daysRestr>0?'X':'','',daysAway,daysRestr,isInjury,'',isIllness,'','',''].join(',');
    });
    const csv = [header,...rows].join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `OSHA_300_Log_${new Date().getFullYear()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  exportAll() {
    if (!this.filteredIncidents.length) return;
    const keys = ['incident_id','status','incident_type','urgency','incident_date','incident_site',
      'incident_area','involved_first','involved_last','job_title','department','injury_type',
      'days_away','days_restricted','osha_recordable','medical_treatment','description','submitted_at'];
    const header = keys.join(',');
    const rows = this.filteredIncidents.map(r =>
      keys.map(k => `"${String((r as any)[k]??'').replace(/"/g,'""')}"`).join(',')
    );
    const csv = [header,...rows].join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'incidents_export.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
