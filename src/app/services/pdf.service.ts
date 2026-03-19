import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

declare const html2pdf: any;

export interface OshaPdfMeta {
  filename: string;
  type: '301' | '300A';
  site: string;
  date: string;
  name: string;
  uploadedAt: string;
  path: string;
  publicUrl: string;
}

@Injectable({ providedIn: 'root' })
export class PdfService {
  private supabase = inject(SupabaseService);

  /** Build a clean filename from site, date, and person/year name */
  buildFilename(type: '301' | '300A', site: string, date: string, name: string): string {
    const clean = (s: string) => (s ?? 'Unknown').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return `OSHA_${type}_${clean(site)}_${clean(date)}_${clean(name)}.pdf`;
  }

  /**
   * Generate a PDF from a DOM element and upload to Supabase Storage.
   * Returns the public URL on success, or throws on error.
   */
  async generateAndUpload(
    elementId: string,
    filename: string,
    onProgress?: (stage: 'generating' | 'uploading' | 'done') => void
  ): Promise<string> {
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`Element #${elementId} not found`);

    onProgress?.('generating');

    const opt = {
      margin: [8, 8, 8, 8],
      filename,
      image: { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css'] }
    };

    const blob: Blob = await html2pdf().set(opt).from(element).outputPdf('blob');
    onProgress?.('uploading');

    const { url, error } = await this.supabase.uploadOshaPdf(filename, blob);
    if (error) throw new Error(error.message ?? 'Upload failed');

    onProgress?.('done');
    return url!;
  }

  /** List all stored OSHA PDFs */
  async listPdfs(): Promise<{ name: string; publicUrl: string; created_at?: string }[]> {
    return this.supabase.listOshaPdfs();
  }

  /** Delete a stored OSHA PDF */
  async deletePdf(filename: string): Promise<void> {
    await this.supabase.deleteOshaPdf(filename);
  }
}
