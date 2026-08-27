import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppUser } from '../models';

const SESSION_KEY = 'pcmhub_user';
const AUTH_KEY = 'pcmhub_auth';
const IDLE_MS = 30 * 60 * 1000; // 30 minutes

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private zone = inject(NgZone);
  private idleTimer: any;

  constructor() {
    if (this.isAuthenticated()) this.resetIdleTimer();
    this.listenForActivity();
  }

  get currentUser(): AppUser | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return sessionStorage.getItem(AUTH_KEY) === 'true' && !!this.currentUser;
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  isManager(): boolean {
    const r = this.currentUser?.role;
    return r === 'admin' || r === 'manager';
  }

  async login(userId: string, password: string, supabaseUrl: string): Promise<{ user: AppUser; isTempPassword: boolean }> {
    const res = await fetch(`${supabaseUrl}/functions/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    const user: AppUser = data.user;

    sessionStorage.setItem(AUTH_KEY, 'true');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    this.resetIdleTimer();
    return { user, isTempPassword: !!data.is_temp_password };
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    clearTimeout(this.idleTimer);
    this.router.navigate(['/login']);
  }

  private resetIdleTimer(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.zone.run(() => this.logout()), IDLE_MS);
  }

  private listenForActivity(): void {
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt =>
      document.addEventListener(evt, () => { if (this.isAuthenticated()) this.resetIdleTimer(); }, { passive: true })
    );
  }
}
