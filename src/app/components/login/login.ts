import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent implements OnInit {
  userId = '';
  password = '';
  showPassword = false;
  errorMessage = '';
  loading = false;
  inviteMode = false;
  inviteMsg = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('invite');
    if (token) {
      this.loading = true;
      const result = await this.auth.loginWithInviteToken(token);
      this.loading = false;
      if (result) {
        this.userId = result.user_id;
        this.password = result.temp_password;
        this.inviteMode = true;
        this.inviteMsg = `Welcome! Your User ID has been pre-filled. Enter your temporary password to sign in.`;
      } else {
        this.errorMessage = 'This invite link has expired or is invalid. Please contact your administrator.';
      }
      this.cdr.detectChanges();
    }
  }

  async onSubmit() {
    this.errorMessage = '';
    this.loading = true;
    const result = await this.auth.login(this.userId, this.password);
    this.loading = false;
    if (result.success) {
      this.router.navigate([result.user?.role === 'admin' ? '/admin' : '/dashboard']);
    } else {
      this.errorMessage = result.message;
      this.cdr.detectChanges();
    }
  }
}
