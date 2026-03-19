import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService, Incident } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { PdfService } from '../../services/pdf.service';

interface Osha300ASummary {
  totalDeaths: number;
  totalDaysAwayCase: number;
  totalTransferCase: number;
  totalOtherRecordable: number;
  totalDaysAwayCount: number;
  totalDaysRestrictedCount: number;
  totalInjuries: number;
  totalSkinDisorders: number;
  totalRespiratory: number;
  totalPoisonings: number;
  totalHearingLoss: number;
  totalOtherIllness: number;
  totalRecordable: number;
}

@Component({
  selector: 'app-osha-300a',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './osha-300a.html',
  styleUrl: './osha-300a.scss'
})
export class Osha300aComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private pdfSvc = inject(PdfService);

  selectedYear = signal(new Date().getFullYear());
  loading = signal(false);
  error = signal('');
  incidents = signal<Incident[]>([]);

  pdfSaving = signal(false);
  pdfStage = signal<'generating' | 'uploading' | 'done' | ''>('');
  pdfUrl = signal<string>('');
  pdfFilename = signal<string>('');

  availableYears = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  companyName = '';
  street = '';
  city = '';
  state = 'TX';
  zip = '';
  naicsCode = '';
  annualAvgEmployees: number | null = null;
  totalHoursWorked: number | null = null;
  certifiedBy = '';
  certifiedTitle = '';

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const { data, error } = await this.supabase.getIncidents();
    this.loading.set(false);
    if (error) { this.error.set(error.message); return; }
    this.incidents.set(data ?? []);
  }

  yearRecords = computed<Incident[]>(() => {
    const year = this.selectedYear().toString();
    return this.incidents().filter(i => i.osha_recordable && i.incident_date?.startsWith(year));
  });

  summary = computed<Osha300ASummary>(() => {
    const records = this.yearRecords();
    const isInjury = (i: Incident) => i.incident_type !== 'illness';
    const isSkinDisorder = (i: Incident) =>
      (i.injury_type ?? '').toLowerCase().includes('skin') ||
      (i.injury_type ?? '').toLowerCase().includes('dermatitis') ||
      (i.injury_type ?? '').toLowerCase().includes('rash');
    const isRespiratory = (i: Incident) =>
      (i.injury_type ?? '').toLowerCase().includes('respir') ||
      (i.injury_type ?? '').toLowerCase().includes('lung') ||
      (i.injury_type ?? '').toLowerCase().includes('asthma');
    const isPoisoning = (i: Incident) =>
      (i.injury_type ?? '').toLowerCase().includes('poison') ||
      (i.injury_type ?? '').toLowerCase().includes('toxic');
    const isHearingLoss = (i: Incident) =>
      (i.injury_type ?? '').toLowerCase().includes('hearing');

    const daysAway = (i: Incident) => (i.days_away ?? 0) > 0;
    const restricted = (i: Incident) => (i.days_restricted ?? 0) > 0 && !(daysAway(i));

    const deaths = 0;
    const daysAwayCase = records.filter(i => daysAway(i)).length;
    const transferCase = records.filter(i => restricted(i)).length;
    const otherRecordable = records.length - deaths - daysAwayCase - transferCase;

    return {
      totalDeaths: deaths,
      totalDaysAwayCase: daysAwayCase,
      totalTransferCase: transferCase,
      totalOtherRecordable: Math.max(0, otherRecordable),
      totalDaysAwayCount: records.reduce((s, i) => s + (i.days_away ?? 0), 0),
      totalDaysRestrictedCount: records.reduce((s, i) => s + (i.days_restricted ?? 0), 0),
      totalInjuries: records.filter(i => isInjury(i)).length,
      totalSkinDisorders: records.filter(i => isSkinDisorder(i)).length,
      totalRespiratory: records.filter(i => isRespiratory(i)).length,
      totalPoisonings: records.filter(i => isPoisoning(i)).length,
      totalHearingLoss: records.filter(i => isHearingLoss(i)).length,
      totalOtherIllness: records.filter(i =>
        !isInjury(i) && !isSkinDisorder(i) && !isRespiratory(i) && !isPoisoning(i) && !isHearingLoss(i)
      ).length,
      totalRecordable: records.length
    };
  });

  onYearChange(year: string): void {
    this.selectedYear.set(Number(year));
    this.pdfUrl.set('');
    this.pdfFilename.set('');
  }

  print(): void { window.print(); }

  async savePdf(): Promise<void> {
    this.pdfSaving.set(true);
    this.pdfUrl.set('');
    this.error.set('');

    const year = this.selectedYear().toString();
    const site = this.city || this.companyName || 'Establishment';
    const filename = this.pdfSvc.buildFilename('300A', site, year, `Annual_Summary`);
    this.pdfFilename.set(filename);

    try {
      const url = await this.pdfSvc.generateAndUpload('osha-300a-printable', filename, stage => {
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
