import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TitleCasePipe, DatePipe],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class AdminComponent implements OnInit {
  auth = inject(AuthService);
  private supa = inject(SupabaseService);

  loading = signal(true);
  saving = signal(false);
  error = signal('');
  success = signal('');

  users = signal<any[]>([]);
  activeTab = signal<'users' | 'invite'>('users');

  inviteForm = { user_id: '', name: '', email: '', role: 'reporter' as 'reporter' | 'manager' | 'admin', site: '' };

  readonly roles: Array<'reporter' | 'manager' | 'admin'> = ['reporter', 'manager', 'admin'];
  readonly sites = ['Deer Park', 'Baytown', 'Texas City', 'La Porte', 'Pasadena', 'Freeport', 'Port Arthur', 'Corporate HQ'];

  async ngOnInit() {
    try {
      const { data } = await this.supa.client.from('app_users').select('*').order('created_at', { ascending: false });
      this.users.set(data ?? []);
    } catch (e: any) { this.error.set(e.message); }
    finally { this.loading.set(false); }
  }

  async updateRole(userId: string, role: string) {
    const { error } = await this.supa.client.from('app_users').update({ role }).eq('id', userId);
    if (error) { this.error.set(error.message); return; }
    this.users.update(us => us.map(u => u.id === userId ? { ...u, role } : u));
  }

  async toggleLock(user: any) {
    const locked = !user.locked;
    const { error } = await this.supa.client.from('app_users').update({ locked, failed_attempts: locked ? user.failed_attempts : 0 }).eq('id', user.id);
    if (error) { this.error.set(error.message); return; }
    this.users.update(us => us.map(u => u.id === user.id ? { ...u, locked } : u));
  }

  async createUser() {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    const { user_id, name, email, role, site } = this.inviteForm;
    if (!user_id || !name) { this.error.set('User ID and Name are required.'); this.saving.set(false); return; }
    const tempPass = Math.random().toString(36).slice(2, 10) + 'A1!';
    try {
      const resp = await fetch(`${environment.supabaseUrl}/functions/v1/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', user_id, password: tempPass, name, email, role, site }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      this.success.set(`User created. Temporary password: ${tempPass}`);
      this.inviteForm = { user_id: '', name: '', email: '', role: 'reporter', site: '' };
      await this.ngOnInit();
      this.activeTab.set('users');
    } catch (e: any) { this.error.set(e.message); }
    finally { this.saving.set(false); }
  }

  roleClass(role: string) {
    return { admin: 'danger', manager: 'warning', reporter: 'secondary' }[role] ?? 'secondary';
  }
}
