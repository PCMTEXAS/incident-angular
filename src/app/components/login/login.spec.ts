import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { LoginComponent } from './login';
import { AuthService } from '../../services/auth.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authServiceMock: {
    login: ReturnType<typeof vi.fn>;
    loginWithInviteToken: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let activatedRouteMock: { snapshot: { queryParamMap: { get: ReturnType<typeof vi.fn> } } };

  beforeEach(async () => {
    authServiceMock = {
      login: vi.fn(),
      loginWithInviteToken: vi.fn(),
    };
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };
    activatedRouteMock = {
      snapshot: {
        queryParamMap: { get: vi.fn().mockReturnValue(null) },
      },
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with empty fields and no error', () => {
    expect(component.userId).toBe('');
    expect(component.password).toBe('');
    expect(component.errorMessage).toBe('');
    expect(component.loading).toBe(false);
  });

  it('should navigate to /dashboard on successful login', async () => {
    authServiceMock.login.mockResolvedValue({ success: true, message: 'Login successful', user: {} });
    component.userId = 'USER001';
    component.password = 'password';
    await component.onSubmit();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should display an error message on failed login', async () => {
    authServiceMock.login.mockResolvedValue({
      success: false,
      message: 'Invalid credentials. 4 attempt(s) remaining.',
    });
    component.userId = 'WRONG';
    component.password = 'bad';
    await component.onSubmit();
    expect(component.errorMessage).toBe('Invalid credentials. 4 attempt(s) remaining.');
  });

  it('should not navigate on failed login', async () => {
    authServiceMock.login.mockResolvedValue({ success: false, message: 'error' });
    await component.onSubmit();
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it('should set loading to true during login and false after', async () => {
    let loadingDuringCall = false;
    authServiceMock.login.mockImplementation(async () => {
      loadingDuringCall = component.loading;
      return { success: false, message: 'error' };
    });
    await component.onSubmit();
    expect(loadingDuringCall).toBe(true);
    expect(component.loading).toBe(false);
  });

  it('should clear errorMessage at the start of each submit', async () => {
    component.errorMessage = 'previous error';
    authServiceMock.login.mockResolvedValue({ success: true, message: 'ok', user: {} });
    await component.onSubmit();
    // errorMessage is cleared at the top of onSubmit; a successful login
    // navigates away so the message stays empty
    expect(component.errorMessage).toBe('');
  });

  describe('invite token flow', () => {
    beforeEach(async () => {
      activatedRouteMock.snapshot.queryParamMap.get.mockReturnValue('my-invite-token');
      authServiceMock.loginWithInviteToken.mockResolvedValue({
        user_id: 'INVITED01',
        temp_password: 'my-invite-token',
      });

      fixture = TestBed.createComponent(LoginComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should pre-fill userId and password from the invite token', () => {
      expect(component.userId).toBe('INVITED01');
      expect(component.password).toBe('my-invite-token');
      expect(component.inviteMode).toBe(true);
    });

    it('should show a welcome invite message', () => {
      expect(component.inviteMsg).toContain('Welcome');
    });
  });

  describe('invalid invite token', () => {
    beforeEach(async () => {
      activatedRouteMock.snapshot.queryParamMap.get.mockReturnValue('expired-token');
      authServiceMock.loginWithInviteToken.mockResolvedValue(null);

      fixture = TestBed.createComponent(LoginComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should show an error for an expired or invalid invite link', () => {
      expect(component.errorMessage).toContain('expired or is invalid');
    });
  });
});
