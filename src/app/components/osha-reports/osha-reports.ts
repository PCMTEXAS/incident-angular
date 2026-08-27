import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-osha-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DatePipe],
  templateUrl: './osha-reports.html',
  styleUrl: './osha-reports.scss',
})
export class OshaReportsComponent implements OnInit {
  private supa = inject(SupabaseService);

  loading = signal(true);
  error = signal('');

  year = new Date().getFullYear();
  site = '';
  incidents: any[] = [];
  pdfs = signal<any[]>([]);

  readonly sites = ['All Sites', 'Deer Park', 'Baytown', 'Texas City', 'La Porte', 'Pasadena', 'Freeport', 'Port Arthur'];

  get recordables() { return this.incidents.filter(i => i.osha_recordable); }

  async ngOnInit() {
    await Promise.all([this.loadIncidents(), this.loadPdfs()]);
  }

  async loadIncidents() {
    this.loading.set(true);
    try {
      const filters: any = { year: this.year };
      if (this.site && this.site !== 'All Sites') filters.site = this.site;
      this.incidents = await this.supa.getIncidents(filters);
    } catch (e: any) { this.error.set(e.message); }
    finally { this.loading.set(false); }
  }

  async loadPdfs() {
    try {
      const list = await this.supa.listOshaPdfs();
      this.pdfs.set(list ?? []);
    } catch {}
  }

  async getPdfUrl(path: string) {
    const url = await this.supa.getOshaPdfUrl(path);
    if (url) window.open(url, '_blank');
  }

  async deletePdf(path: string) {
    if (!confirm('Delete this PDF?')) return;
    await this.supa.deleteOshaPdf(path);
    await this.loadPdfs();
  }
}
