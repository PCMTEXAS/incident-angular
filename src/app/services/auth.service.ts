import { Injectable } from '@angular/core';

const AUTH_KEY = 'incidentApp_auth';
const LOCKOUT_KEY = 'incidentApp_lockout';
const ATTEMPTS_KEY = 'incidentApp_attempts';
const MAX_ATTEMPTS = 5;

@Injectable({ providedIn: 'root' })
export class AuthService {

  isAuthenticated(): boolean {
    return sessionStorage.getItem(AUTH_KEY) === 'authenticated';
  }

  login(id: string, password: string): { success: boolean; message: string } {
    const lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0');
    if (Date.now() < lockoutUntil) {
      const mins = Math.ceil((lockoutUntil - Date.now()) / 60000);
      return { success: false, message: `Account locked. Try again in ${mins} minute(s).` };
    }

    const validId = 'VIPLS';
    const validPass = 'DC2026';

    if (id.trim().toUpperCase() === validId && password === validPass) {
      sessionStorage.setItem(AUTH_KEY, 'authenticated');
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(LOCKOUT_KEY);
      return { success: true, message: 'Login successful' };
    }

    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0') + 1;
    localStorage.setItem(ATTEMPTS_KEY, String(attempts));

    if (attempts >= MAX_ATTEMPTS) {
      localStorage.setItem(LOCKOUT_KEY, String(Date.now() + 15 * 60 * 1000));
      localStorage.removeItem(ATTEMPTS_KEY);
      return { success: false, message: 'Too many failed attempts. Account locked for 15 minutes.' };
    }

    const remaining = MAX_ATTEMPTS - attempts;
    return { success: false, message: `Invalid credentials. ${remaining} attempt(s) remaining.` };
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_KEY);
  }
}
