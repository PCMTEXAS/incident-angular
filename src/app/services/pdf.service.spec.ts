import { TestBed } from '@angular/core/testing';
import { PdfService } from './pdf.service';
import { SupabaseService } from './supabase.service';

describe('PdfService', () => {
  let service: PdfService;
  let supabaseMock: {
    uploadOshaPdf: ReturnType<typeof vi.fn>;
    listOshaPdfs: ReturnType<typeof vi.fn>;
    deleteOshaPdf: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    supabaseMock = {
      uploadOshaPdf: vi.fn(),
      listOshaPdfs: vi.fn(),
      deleteOshaPdf: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        PdfService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    });

    service = TestBed.inject(PdfService);
  });

  describe('buildFilename', () => {
    it('should build a correctly structured filename', () => {
      const name = service.buildFilename('301', 'Main Site', '2024-01-15', 'John Doe');
      expect(name).toBe('OSHA_301_Main_Site_2024_01_15_John_Doe.pdf');
    });

    it('should build a 300A filename', () => {
      const name = service.buildFilename('300A', 'Plant B', '2024', '2024');
      expect(name).toBe('OSHA_300A_Plant_B_2024_2024.pdf');
    });

    it('should replace special characters with single underscores', () => {
      const name = service.buildFilename('301', 'Site/A', '2024', 'Jane & Co');
      expect(name).not.toMatch(/[/&]/);
      expect(name).toContain('Site_A');
      expect(name).toContain('Jane_Co');
    });

    it('should collapse consecutive underscores into one', () => {
      const name = service.buildFilename('301', 'A  B', '2024', 'Name');
      expect(name).not.toContain('__');
    });

    it('should use Unknown for null segments', () => {
      const name = service.buildFilename('301', null as any, '2024', null as any);
      expect(name).toContain('Unknown');
    });
  });

  describe('listPdfs', () => {
    it('should delegate to supabase.listOshaPdfs and return results', async () => {
      const pdfs = [{ name: 'a.pdf', publicUrl: 'https://example.com/a.pdf', created_at: '2024-01-01' }];
      supabaseMock.listOshaPdfs.mockResolvedValue(pdfs);
      const result = await service.listPdfs();
      expect(result).toEqual(pdfs);
      expect(supabaseMock.listOshaPdfs).toHaveBeenCalledOnce();
    });

    it('should return an empty array when there are no PDFs', async () => {
      supabaseMock.listOshaPdfs.mockResolvedValue([]);
      const result = await service.listPdfs();
      expect(result).toEqual([]);
    });
  });

  describe('deletePdf', () => {
    it('should call supabase.deleteOshaPdf with the correct filename', async () => {
      supabaseMock.deleteOshaPdf.mockResolvedValue({ error: null });
      await service.deletePdf('OSHA_301_Test.pdf');
      expect(supabaseMock.deleteOshaPdf).toHaveBeenCalledWith('OSHA_301_Test.pdf');
    });
  });

  describe('generateAndUpload', () => {
    it('should throw an error when the target element does not exist', async () => {
      await expect(service.generateAndUpload('nonexistent-element-id', 'test.pdf'))
        .rejects.toThrow('Element #nonexistent-element-id not found');
    });

    it('should call onProgress with generating/uploading/done stages on success', async () => {
      const div = document.createElement('div');
      div.id = 'test-pdf-element';
      document.body.appendChild(div);

      const blobOutput = new Blob(['%PDF'], { type: 'application/pdf' });
      const html2pdfMock = {
        set: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        outputPdf: vi.fn().mockResolvedValue(blobOutput),
      };
      (globalThis as any).html2pdf = vi.fn().mockReturnValue(html2pdfMock);

      supabaseMock.uploadOshaPdf.mockResolvedValue({ url: 'https://example.com/test.pdf', error: null });

      const stages: string[] = [];
      const url = await service.generateAndUpload('test-pdf-element', 'test.pdf', (s) => stages.push(s));

      expect(stages).toEqual(['generating', 'uploading', 'done']);
      expect(url).toBe('https://example.com/test.pdf');

      document.body.removeChild(div);
      delete (globalThis as any).html2pdf;
    });

    it('should throw when the upload fails', async () => {
      const div = document.createElement('div');
      div.id = 'test-pdf-upload-fail';
      document.body.appendChild(div);

      const blobOutput = new Blob(['%PDF'], { type: 'application/pdf' });
      const html2pdfMock = {
        set: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        outputPdf: vi.fn().mockResolvedValue(blobOutput),
      };
      (globalThis as any).html2pdf = vi.fn().mockReturnValue(html2pdfMock);

      supabaseMock.uploadOshaPdf.mockResolvedValue({ url: null, error: { message: 'Storage error' } });

      await expect(service.generateAndUpload('test-pdf-upload-fail', 'fail.pdf'))
        .rejects.toThrow('Storage error');

      document.body.removeChild(div);
      delete (globalThis as any).html2pdf;
    });
  });
});
