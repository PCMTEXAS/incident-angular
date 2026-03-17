import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

const AUTH_KEY = 'incidentApp_auth';
const AUTH_USER_KEY = 'incidentApp_user';
const LOCKOUT_KEY = 'incidentApp_lockout';
const ATTEMPTS_KEY = 'incidentApp_attempts';
const MAX_ATTEMPTS = 5;

export interface AppUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'reporter';
  is_temp_password: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private supabase: SupabaseService) {}

  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  isAuthenticated(): boolean {
    return sessionStorage.getItem(AUTH_KEY) === 'authenticated';
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  }

  getCurrentUser(): AppUser | null {
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  private setSession(user: AppUser): void {
    sessionStorage.setItem(AUTH_KEY, 'authenticated');
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
  }

  async login(id: string, password: string): Promise<{ success: boolean; message: string; user?: AppUser }> {
    const lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0');
    if (Date.now() < lockoutUntil) {
      const mins = Math.ceil((lockoutUntil - Date.now()) / 60000);
      return { success: false, message: `Account locked. Try again in ${mins} minute(s).` };
    }

    // Hard-coded admin bypass
    if (id.trim().toUpperCase() === 'VIPLS' && password === 'DC2026') {
      const adminUser: AppUser = {
        id: 'admin', user_id: 'VIPLS', name: 'System Admin',
        email: 'patrick@pcmtexas.com', role: 'admin', is_temp_password: false
      };
      this.setSession(adminUser);
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(LOCKOUT_KEY);
      return { success: true, message: 'Login successful', user: adminUser };
    }

    // Supabase user lookup
    const hash = await this.hashPassword(password);
    const result = await this.supabase.getUserByCredentials(id.trim().toUpperCase(), hash);

    if (result.data) {
      const u = result.data;
      const appUser: AppUser = {
        id: u.id, user_id: u.user_id, name: u.name,
        email: u.email, role: u.role, is_temp_password: u.is_temp_password
      };
      this.setSession(appUser);
      await this.supabase.updateLastLogin(u.id);
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(LOCKOUT_KEY);
      return { success: true, message: 'Login successful', user: appUser };
    }

    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0') + 1;
    localStorage.setItem(ATTEMPTS_KEY, String(attempts));
    if (attempts >= MAX_ATTEMPTS) {
      localStorage.setItem(LOCKOUT_KEY, String(Date.now() + 15 * 60 * 1000));
      localStorage.removeItem(ATTEMPTS_KEY);
      return { success: false, message: 'Too many failed attempts. Account locked for 15 minutes.' };
    }
    return { success: false, message: `Invalid credentials. ${MAX_ATTEMPTS - attempts} attempt(s) remaining.` };
  }

  async loginWithInviteToken(token: string): Promise<{ user_id: string; temp_password: string } | null> {
    return this.supabase.getUserByInviteToken(token);
  }
}
