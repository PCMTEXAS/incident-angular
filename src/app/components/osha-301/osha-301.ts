import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { SupabaseService, Incident } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { PdfService } from '../../services/pdf.service';

@Component({
  selector: 'app-osha-301',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './osha-301.html',
  styleUrl: './osha-301.scss'
})
export class Osha301Component implements OnInit {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pdfSvc = inject(PdfService);

  loading = signal(false);
  error = signal('');
  incidents = signal<Incident[]>([]);
  selectedIncident = signal<Incident | null>(null);
  selectedId = signal<string>('');

  pdfSaving = signal(false);
  pdfStage = signal<'generating' | 'uploading' | 'done' | ''>('');
  pdfUrl = signal<string>('');
  pdfFilename = signal<string>('');

  // Additional 301-specific fields (not stored in DB, user fills for printing)
  employeeDOB = '';
  employeeGender = '';
  employeeAddress = '';
  physicianName = '';
  physicianFacility = '';
  physicianStreet = '';
  physicianCity = '';
  physicianState = '';
  physicianZip = '';
  treatedEmergencyRoom = false;
  hospitalizedOvernight = false;
  caseNumber = '';
  preparedBy = '';
  preparedTitle = '';
  preparedPhone = '';
  preparedDate = '';

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadIncidents().then(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        const found = this.incidents().find(i => i.id === id);
        if (found) { this.selectedId.set(id); this.selectedIncident.set(found); }
      }
    });
  }

  async loadIncidents(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const { data, error } = await this.supabase.getIncidents();
    this.loading.set(false);
    if (error) { this.error.set(error.message); return; }
    this.incidents.set(data ?? []);
  }

  onSelectIncident(id: string): void {
    this.selectedId.set(id);
    const found = this.incidents().find(i => i.id === id) ?? null;
    this.selectedIncident.set(found);
    this.pdfUrl.set('');
    this.pdfFilename.set('');
    this.physicianName = '';
    this.physicianFacility = '';
    this.treatedEmergencyRoom = false;
    this.hospitalizedOvernight = false;
  }

  get inc(): Incident | null { return this.selectedIncident(); }

  typeLabel(t?: string): string {
    const map: Record<string, string> = {
      injury: 'Injury', illness: 'Illness', nearmiss: 'Near Miss', vehicle: 'Vehicle',
      environmental: 'Environmental', property: 'Property Damage',
      contractor: 'Contractor', security: 'Security', observation: 'Observation'
    };
    return map[t ?? ''] ?? t ?? '—';
  }

  print(): void { window.print(); }

  async savePdf(): Promise<void> {
    const i = this.inc;
    if (!i) return;
    this.pdfSaving.set(true);
    this.pdfUrl.set('');
    this.error.set('');

    const site = i.incident_site ?? 'Unknown_Site';
    const date = i.incident_date ?? 'Unknown_Date';
    const name = `${i.involved_first ?? ''}_${i.involved_last ?? ''}`.trim() || 'Unknown';
    const filename = this.pdfSvc.buildFilename('301', site, date, name);
    this.pdfFilename.set(filename);

    try {
      const url = await this.pdfSvc.generateAndUpload('osha-301-printable', filename, stage => {
        this.pdfStage.set(stage);
      });
      this.pdfUrl.set(url);
    } catch (e: any) {
      this.error.set(e.message ?? 'PDF generation failed');
    } finally {
      this.pdfSaving.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
