import { Component, OnInit, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService, Incident } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

declare const Chart: any;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TitleCasePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('typeChart') typeChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthChart') monthChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('siteChart') siteChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusChart') statusChartRef!: ElementRef<HTMLCanvasElement>;

  private typeChartInst: any;
  private monthChartInst: any;
  private siteChartInst: any;
  private statusChartInst: any;

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

  activeTab: 'list' | 'charts' = 'list';

  readonly STATUSES = ['', 'Open', 'In Progress', 'Pending Review', 'Closed'];
  readonly INCIDENT_TYPES = ['', 'injury', 'illness', 'nearmiss', 'vehicle', 'environmental', 'property', 'contractor', 'security', 'observation'];
  readonly SITES = ['', 'Deer Park', 'Baytown', 'Texas City', 'La Porte', 'Pasadena', 'Freeport', 'Port Arthur', 'Corporate HQ'];

  // Chart data arrays
  typeChartData: { label: string; count: number; pct: number }[] = [];
  siteChartData: { label: string; count: number; pct: number }[] = [];
  monthChartData: { month: string; count: number; recordable: number }[] = [];
  statusChartData: { label: string; count: number; pct: number; color: string }[] = [];
  recordablePct = 0;
  avgDaysToClose = 0;

  constructor(private supabase: SupabaseService, private auth: AuthService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    if (!this.auth.isAuthenticated()) { this.router.navigate(['/login']); return; }
    this.loadData();
  }

  ngAfterViewInit(): void {
    // Charts render after data loads; handled in loadData()
  }

  async loadData() {
    this.loading = true; this.error = '';
    const [{ data, error }, stats] = await Promise.all([
      this.supabase.getIncidents(),
      this.supabase.getStats()
    ]);
    this.loading = false;
    if (error) { this.error = error.message; this.cdr.detectChanges(); return; }
    this.incidents = data || [];
    this.stats = stats;
    this.applyFilters();
    this.computeChartData();
    this.cdr.detectChanges();
    setTimeout(() => this.renderCharts(), 80);
  }

  // ── Chart data computation ─────────────────────────────────────

  computeChartData(): void {
    const all = this.incidents;
    const total = all.length || 1;

    // By type
    const typeCounts: Record<string, number> = {};
    for (const inc of all) {
      const t = inc.incident_type || 'unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    this.typeChartData = Object.entries(typeCounts)
      .map(([k, v]) => ({ label: this.typeLabel(k), count: v, pct: Math.round((v / total) * 100) }))
      .sort((a, b) => b.count - a.count);

    // By site
    const siteCounts: Record<string, number> = {};
    for (const inc of all) {
      const s = inc.incident_site || 'Unknown';
      siteCounts[s] = (siteCounts[s] || 0) + 1;
    }
    this.siteChartData = Object.entries(siteCounts)
      .map(([k, v]) => ({ label: k, count: v, pct: Math.round((v / total) * 100) }))
      .sort((a, b) => b.count - a.count);

    // Monthly trend — last 12 months
    const now = new Date();
    this.monthChartData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const bucket = all.filter(r => r.incident_date?.startsWith(key));
      this.monthChartData.push({ month: label, count: bucket.length, recordable: bucket.filter(r => r.osha_recordable).length });
    }

    // By status
    const statusColors: Record<string, string> = {
      'Open': '#dc3545', 'In Progress': '#ffc107',
      'Pending Review': '#0dcaf0', 'Closed': '#198754'
    };
    const statusCounts: Record<string, number> = {};
    for (const inc of all) {
      const s = inc.status || 'Open';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    this.statusChartData = Object.entries(statusCounts)
      .map(([k, v]) => ({ label: k, count: v, pct: Math.round((v / total) * 100), color: statusColors[k] || '#6c757d' }));

    // KPI metrics
    this.recordablePct = Math.round((all.filter(r => r.osha_recordable).length / total) * 100);
    const closed = all.filter(r => r.status === 'Closed' && r.submitted_at && r.updated_at);
    if (closed.length) {
      const sumDays = closed.reduce((s, r) => {
        const ms = new Date(r.updated_at!).getTime() - new Date(r.submitted_at!).getTime();
        return s + Math.max(0, Math.floor(ms / 86400000));
      }, 0);
      this.avgDaysToClose = Math.round(sumDays / closed.length);
    }
  }

  renderCharts(): void {
    if (typeof Chart === 'undefined') return;

    const DC_BLUE = '#0057A8';
    const CHART_COLORS = ['#0057A8','#e74c3c','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#3498db','#e91e63'];

    // Type doughnut
    if (this.typeChartRef?.nativeElement) {
      if (this.typeChartInst) this.typeChartInst.destroy();
      this.typeChartInst = new Chart(this.typeChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: this.typeChartData.map(d => d.label),
          datasets: [{ data: this.typeChartData.map(d => d.count), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#fff' }]
        },
        options: {
          responsive: true, maintainAspectRatio: true, cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { padding: 8, font: { size: 11 } } },
            tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed}` } }
          }
        }
      });
    }

    // Monthly bar
    if (this.monthChartRef?.nativeElement) {
      if (this.monthChartInst) this.monthChartInst.destroy();
      this.monthChartInst = new Chart(this.monthChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: this.monthChartData.map(d => d.month),
          datasets: [
            { label: 'All Incidents', data: this.monthChartData.map(d => d.count), backgroundColor: DC_BLUE + 'BB', borderColor: DC_BLUE, borderWidth: 1, borderRadius: 3 },
            { label: 'OSHA Recordable', data: this.monthChartData.map(d => d.recordable), backgroundColor: '#dc3545BB', borderColor: '#dc3545', borderWidth: 1, borderRadius: 3 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

    // Site horizontal bar
    if (this.siteChartRef?.nativeElement) {
      if (this.siteChartInst) this.siteChartInst.destroy();
      this.siteChartInst = new Chart(this.siteChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: this.siteChartData.map(d => d.label),
          datasets: [{ label: 'Incidents', data: this.siteChartData.map(d => d.count), backgroundColor: CHART_COLORS, borderWidth: 0, borderRadius: 3 }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

    // Status pie
    if (this.statusChartRef?.nativeElement) {
      if (this.statusChartInst) this.statusChartInst.destroy();
      this.statusChartInst = new Chart(this.statusChartRef.nativeElement, {
        type: 'pie',
        data: {
          labels: this.statusChartData.map(d => d.label),
          datasets: [{ data: this.statusChartData.map(d => d.count), backgroundColor: this.statusChartData.map(d => d.color), borderWidth: 2, borderColor: '#fff' }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { position: 'bottom', labels: { padding: 8, font: { size: 11 } } } }
        }
      });
    }
  }

  showTab(tab: 'list' | 'charts'): void {
    this.activeTab = tab;
    if (tab === 'charts') setTimeout(() => this.renderCharts(), 80);
  }

  // ── Filtering / Sorting ────────────────────────────────────────

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
    this.cdr.detectChanges();
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
