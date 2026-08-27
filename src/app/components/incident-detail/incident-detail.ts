import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, DatePipe, TitleCasePipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { Incident } from '../../models';

@Component({
  selector: 'app-incident-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DatePipe, TitleCasePipe],
  templateUrl: './incident-detail.html',
  styleUrl: './incident-detail.scss',
})
export class IncidentDetailComponent implements OnInit {
  auth = inject(AuthService);
  private supa = inject(SupabaseService);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  error = signal('');
  saving = signal(false);
  activeTab = signal<'overview' | 'injury' | 'investigation' | 'osha' | 'notes'>('overview');

  inc: Incident | null = null;
  editStatus = '';
  newNote = '';
  notes = signal<any[]>([]);

  readonly statuses = ['Open', 'Under Review', 'Action Required', 'Pending Closure', 'Closed'];

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      this.inc = await this.supa.getIncident(id);
      this.editStatus = this.inc?.status ?? 'Open';
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }

  async saveStatus() {
    if (!this.inc) return;
    this.saving.set(true);
    try {
      await this.supa.updateIncident(this.inc.id!, { status: this.editStatus as any });
      this.inc.status = this.editStatus as any;
    } catch (e: any) { this.error.set(e.message); }
    finally { this.saving.set(false); }
  }

  async addNote() {
    if (!this.newNote.trim() || !this.inc) return;
    const user = this.auth.currentUser;
    this.notes.update(ns => [...ns, { id: Date.now(), note: this.newNote, created_by: user?.name ?? 'User', created_at: new Date().toISOString() }]);
    this.newNote = '';
  }

  urgencyClass(u?: string) {
    return { immediate: 'danger', high: 'warning', medium: 'info', low: 'secondary' }[u ?? 'medium'] ?? 'secondary';
  }

  statusClass(s?: string) {
    return { Open: 'danger', 'Under Review': 'warning', 'Action Required': 'orange', 'Pending Closure': 'info', Closed: 'success' }[s ?? 'Open'] ?? 'secondary';
  }
}
