import { Injectable, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

const SESSION_AUTH_KEY = 'incidentApp_auth';
const SESSION_USER_KEY = 'incidentApp_user';
const IDLE_TIMEOUT_MS  = 30 * 60 * 1000; // 30 minutes

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
  private router = inject(Router);
  private zone   = inject(NgZone);

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly loginUrl = `${environment.supabaseUrl}/functions/v1/login`;

  // ── Authentication state ────────────────────────────────────────────────────

  isAuthenticated(): boolean {
    return sessionStorage.getItem(SESSION_AUTH_KEY) === 'authenticated';
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'admin';
  }

  isManager(): boolean {
    const role = this.getCurrentUser()?.role;
    return role === 'manager' || role === 'admin';
  }

  getCurrentUser(): AppUser | null {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  }

  // ── Login / Logout ──────────────────────────────────────────────────────────

  async login(userId: string, password: string): Promise<{ success: boolean; message: string; user?: AppUser }> {
    try {
      const res = await fetch(this.loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, password }),
      });

      const data = await res.json() as { success: boolean; message: string; user?: AppUser };

      if (data.success && data.user) {
        this.setSession(data.user);
        this.startIdleTimer();
      }

      return data;
    } catch {
      return { success: false, message: 'Unable to reach authentication server. Check your connection.' };
    }
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    this.stopIdleTimer();
    this.router.navigate(['/login']);
  }

  async loginWithInviteToken(token: string): Promise<{ user_id: string; temp_password: string } | null> {
    // Import lazily to avoid circular dep with supabase service
    const { SupabaseService } = await import('./supabase.service');
    const svc = new SupabaseService();
    return svc.getUserByInviteToken(token);
  }

  // ── Idle session timeout ────────────────────────────────────────────────────

  /**
   * Call once after login to begin tracking user activity.
   * Bind activity events in the root App component.
   */
  startIdleTimer(): void {
    this.stopIdleTimer();
    this.zone.runOutsideAngular(() => {
      this.idleTimer = setTimeout(() => {
        this.zone.run(() => this.logout());
      }, IDLE_TIMEOUT_MS);
    });
  }

  /** Reset the idle timer on any user activity. */
  resetIdleTimer(): void {
    if (this.isAuthenticated()) {
      this.startIdleTimer();
    }
  }

  private stopIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private setSession(user: AppUser): void {
    sessionStorage.setItem(SESSION_AUTH_KEY, 'authenticated');
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  }

  /**
   * @deprecated Only kept for admin password-hash operations (user creation).
   * Login authentication is now handled server-side by the Edge Function.
   */
  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
