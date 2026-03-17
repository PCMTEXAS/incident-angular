import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService, AppUserRecord } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class AdminComponent implements OnInit {
  users: AppUserRecord[] = [];
  loading = true;
  saving = false;
  error = '';
  successMsg = '';
  copiedToken: string | null = null;
  showAddForm = false;

  newUser = { name: '', email: '', role: 'reporter' as 'admin' | 'manager' | 'reporter', user_id: '', temp_password: '' };
  generatedLink: string | null = null;

  constructor(
    private supabase: SupabaseService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.auth.isAdmin()) { this.router.navigate(['/dashboard']); return; }
    this.loadUsers();
  }

  async loadUsers() {
    this.loading = true;
    const { data, error } = await this.supabase.getAppUsers();
    if (error) this.error = 'Failed to load users.';
    else this.users = data ?? [];
    this.loading = false;
  }

  generateUserId(name: string): string {
    return name.trim().toUpperCase().replace(/\s+/g, '.').replace(/[^A-Z0-9.]/g, '').substring(0, 12);
  }

  generatePassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  onNameChange() {
    if (!this.newUser.user_id) {
      this.newUser.user_id = this.generateUserId(this.newUser.name);
    }
    if (!this.newUser.temp_password) {
      this.newUser.temp_password = this.generatePassword();
    }
  }

  async addUser() {
    this.error = '';
    this.successMsg = '';
    if (!this.newUser.name || !this.newUser.user_id || !this.newUser.temp_password) {
      this.error = 'Name, User ID, and password are required.'; return;
    }
    this.saving = true;

    const hash = await this.auth.hashPassword(this.newUser.temp_password);
    const inviteToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { data, error } = await this.supabase.createAppUser({
      user_id: this.newUser.user_id.toUpperCase(),
      name: this.newUser.name,
      email: this.newUser.email,
      role: this.newUser.role,
      password_hash: hash,
      invite_token: inviteToken,
      invite_expires_at: expires
    });

    this.saving = false;
    if (error) {
      this.error = error.message?.includes('unique') ? 'User ID already exists.' : 'Failed to create user.';
      return;
    }

    this.generatedLink = `${window.location.origin}/login?invite=${inviteToken}`;
    this.successMsg = `User "${data!.name}" created!`;
    this.showAddForm = false;
    this.newUser = { name: '', email: '', role: 'reporter', user_id: '', temp_password: '' };
    await this.loadUsers();
  }

  async resetPassword(user: AppUserRecord) {
    const tempPass = this.generatePassword();
    const hash = await this.auth.hashPassword(tempPass);
    const inviteToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await this.supabase.resetUserPassword(user.id, hash, inviteToken, expires);
    if (error) { this.error = 'Failed to reset password.'; return; }

    this.generatedLink = `${window.location.origin}/login?invite=${inviteToken}`;
    this.successMsg = `Password reset for "${user.name}". Share the link below.`;
    await this.loadUsers();
  }

  async toggleActive(user: AppUserRecord) {
    const { error } = await this.supabase.toggleUserActive(user.id, !user.is_active);
    if (error) { this.error = 'Failed to update user.'; return; }
    await this.loadUsers();
  }

  copyLink() {
    if (!this.generatedLink) return;
    navigator.clipboard.writeText(this.generatedLink);
    this.copiedToken = this.generatedLink;
    setTimeout(() => this.copiedToken = null, 2500);
  }

  openAddForm() {
    this.showAddForm = true;
    this.generatedLink = null;
    this.error = '';
    this.successMsg = '';
    this.newUser = { name: '', email: '', role: 'reporter', user_id: '', temp_password: this.generatePassword() };
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
