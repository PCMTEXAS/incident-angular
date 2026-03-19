import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { PdfService } from '../../services/pdf.service';
import { AuthService } from '../../services/auth.service';

interface PdfFile {
  name: string;
  publicUrl: string;
  created_at?: string;
  type: string;
  displayName: string;
}

@Component({
  selector: 'app-osha-reports',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './osha-reports.html',
  styleUrl: './osha-reports.scss'
})
export class OshaReportsComponent implements OnInit {
  private pdfSvc = inject(PdfService);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');
  files = signal<PdfFile[]>([]);
  deleting = signal<string>('');
  filterType = signal<string>('');

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadFiles();
  }

  async loadFiles(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const raw = await this.pdfSvc.listPdfs();
      const parsed: PdfFile[] = raw.map(f => ({
        name: f.name,
        publicUrl: f.publicUrl,
        created_at: f.created_at,
        type: f.name.includes('_300A_') ? '300A' : '301',
        displayName: this.formatDisplayName(f.name)
      }));
      this.files.set(parsed);
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to load reports');
    } finally {
      this.loading.set(false);
    }
  }

  formatDisplayName(filename: string): string {
    return filename
      .replace(/^OSHA_/, '')
      .replace(/\.pdf$/i, '')
      .replace(/_/g, ' ')
      .trim();
  }

  get filteredFiles(): PdfFile[] {
    const t = this.filterType();
    if (!t) return this.files();
    return this.files().filter(f => f.type === t);
  }

  async deleteFile(name: string): Promise<void> {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    this.deleting.set(name);
    try {
      await this.pdfSvc.deletePdf(name);
      this.files.update(fs => fs.filter(f => f.name !== name));
    } catch (e: any) {
      this.error.set(e.message ?? 'Delete failed');
    } finally {
      this.deleting.set('');
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
