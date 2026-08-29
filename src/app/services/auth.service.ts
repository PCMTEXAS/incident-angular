import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppUser } from '../models';
import { environment } from '../../environments/environment';

const SESSION_KEY = 'pcmhub_user';
const AUTH_KEY = 'pcmhub_auth';
const IDLE_MS = 30 * 60 * 1000;

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

  async login(userId: string): Promise<AppUser> {
    const uid = userId.trim().toUpperCase();
    const url = `${environment.supabaseUrl}/rest/v1/app_users?user_id=eq.${encodeURIComponent(uid)}&is_active=eq.true&select=id,user_id,name,email,role,is_temp_password`;

    const res = await fetch(url, {
      headers: {
        'apikey': environment.supabaseAnonKey,
        'Authorization': `Bearer ${environment.supabaseAnonKey}`,
      },
    });

    if (!res.ok) throw new Error('Unable to reach server. Check your connection.');

    const rows: AppUser[] = await res.json();
    if (!rows.length) throw new Error('User ID not found. Contact your administrator.');

    const user = rows[0];
    sessionStorage.setItem(AUTH_KEY, 'true');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    this.resetIdleTimer();
    return user;
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
