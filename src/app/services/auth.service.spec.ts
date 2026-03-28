import { TestBed } from '@angular/core/testing';
import { AuthService, AppUser } from './auth.service';
import { SupabaseService } from './supabase.service';
import type { AppUserRecord } from './supabase.service';

const mockUser: AppUser = {
  id: '1',
  user_id: 'USER001',
  name: 'Test User',
  email: 'test@example.com',
  role: 'reporter',
  is_temp_password: false,
};

const mockUserRecord: AppUserRecord = {
  id: '1',
  user_id: 'USER001',
  name: 'Test User',
  email: 'test@example.com',
  role: 'reporter',
  password_hash: 'abc123',
  is_temp_password: false,
  invite_token: null,
  invite_expires_at: null,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  last_login: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let supabaseMock: {
    getUserByCredentials: ReturnType<typeof vi.fn>;
    updateLastLogin: ReturnType<typeof vi.fn>;
    getUserByInviteToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    supabaseMock = {
      getUserByCredentials: vi.fn(),
      updateLastLogin: vi.fn().mockResolvedValue(undefined),
      getUserByInviteToken: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    });

    service = TestBed.inject(AuthService);
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('hashPassword', () => {
    it('should return a 64-char hex string', async () => {
      const hash = await service.hashPassword('hello');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should be deterministic for the same input', async () => {
      const h1 = await service.hashPassword('password');
      const h2 = await service.hashPassword('password');
      expect(h1).toBe(h2);
    });

    it('should produce different hashes for different inputs', async () => {
      const h1 = await service.hashPassword('abc');
      const h2 = await service.hashPassword('xyz');
      expect(h1).not.toBe(h2);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when not authenticated', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return true when session is set', () => {
      sessionStorage.setItem('incidentApp_auth', 'authenticated');
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false for an incorrect session value', () => {
      sessionStorage.setItem('incidentApp_auth', 'something-else');
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return false when no user in session', () => {
      expect(service.isAdmin()).toBe(false);
    });

    it('should return true for admin role', () => {
      const admin: AppUser = { ...mockUser, role: 'admin' };
      sessionStorage.setItem('incidentApp_user', JSON.stringify(admin));
      expect(service.isAdmin()).toBe(true);
    });

    it('should return false for manager role', () => {
      const manager: AppUser = { ...mockUser, role: 'manager' };
      sessionStorage.setItem('incidentApp_user', JSON.stringify(manager));
      expect(service.isAdmin()).toBe(false);
    });

    it('should return false for reporter role', () => {
      sessionStorage.setItem('incidentApp_user', JSON.stringify(mockUser));
      expect(service.isAdmin()).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when no session', () => {
      expect(service.getCurrentUser()).toBeNull();
    });

    it('should return the parsed user from session storage', () => {
      sessionStorage.setItem('incidentApp_user', JSON.stringify(mockUser));
      expect(service.getCurrentUser()).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('should clear auth and user from session storage', () => {
      sessionStorage.setItem('incidentApp_auth', 'authenticated');
      sessionStorage.setItem('incidentApp_user', JSON.stringify(mockUser));
      service.logout();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.getCurrentUser()).toBeNull();
    });
  });

  describe('login', () => {
    it('should return success and set session on valid credentials', async () => {
      supabaseMock.getUserByCredentials.mockResolvedValue({ data: mockUserRecord });
      const result = await service.login('USER001', 'password');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Login successful');
      expect(result.user).toBeDefined();
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should call updateLastLogin on successful login', async () => {
      supabaseMock.getUserByCredentials.mockResolvedValue({ data: mockUserRecord });
      await service.login('USER001', 'password');
      expect(supabaseMock.updateLastLogin).toHaveBeenCalledWith('1');
    });

    it('should normalise user id to uppercase before lookup', async () => {
      supabaseMock.getUserByCredentials.mockResolvedValue({ data: mockUserRecord });
      await service.login('user001', 'password');
      expect(supabaseMock.getUserByCredentials).toHaveBeenCalledWith('USER001', expect.any(String));
    });

    it('should return failure with remaining attempts on invalid credentials', async () => {
      supabaseMock.getUserByCredentials.mockResolvedValue({ data: null });
      const result = await service.login('WRONG', 'bad');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid credentials');
      expect(result.message).toContain('4 attempt(s) remaining');
    });

    it('should lock account and return lockout message on the 5th failed attempt', async () => {
      supabaseMock.getUserByCredentials.mockResolvedValue({ data: null });
      for (let i = 0; i < 4; i++) {
        await service.login('USER001', 'wrong');
      }
      const result = await service.login('USER001', 'wrong');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Too many failed attempts');
    });

    it('should return locked message immediately when lockout is active', async () => {
      localStorage.setItem('incidentApp_lockout', String(Date.now() + 60 * 60 * 1000));
      const result = await service.login('USER001', 'any');
      expect(result.success).toBe(false);
      expect(result.message).toContain('locked');
      expect(supabaseMock.getUserByCredentials).not.toHaveBeenCalled();
    });

    it('should clear failed-attempt counters on successful login', async () => {
      localStorage.setItem('incidentApp_attempts', '3');
      supabaseMock.getUserByCredentials.mockResolvedValue({ data: mockUserRecord });
      await service.login('USER001', 'password');
      expect(localStorage.getItem('incidentApp_attempts')).toBeNull();
    });
  });

  describe('loginWithInviteToken', () => {
    it('should return user info for a valid token', async () => {
      supabaseMock.getUserByInviteToken.mockResolvedValue({ user_id: 'U1', temp_password: 'tok123' });
      const result = await service.loginWithInviteToken('sometoken');
      expect(result).toEqual({ user_id: 'U1', temp_password: 'tok123' });
    });

    it('should return null for an invalid or expired token', async () => {
      supabaseMock.getUserByInviteToken.mockResolvedValue(null);
      const result = await service.loginWithInviteToken('badtoken');
      expect(result).toBeNull();
    });
  });
});
