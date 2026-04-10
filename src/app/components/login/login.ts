import { Component, OnInit, inject } from '@angular/core';
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
  private auth  = inject(AuthService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  userId       = '';
  password     = '';
  showPassword = false;
  errorMessage = '';
  loading      = false;
  inviteMsg    = '';

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('invite');
    if (!token) return;

    this.loading = true;
    const result = await this.auth.loginWithInviteToken(token);
    this.loading = false;

    if (result) {
      this.userId   = result.user_id;
      this.password = result.temp_password;
      this.inviteMsg = 'Welcome! Your User ID has been pre-filled. Enter your temporary password to sign in.';
    } else {
      this.errorMessage = 'This invite link has expired or is invalid. Please contact your administrator.';
    }
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = '';
    this.loading = true;
    const result = await this.auth.login(this.userId, this.password);
    this.loading = false;

    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage = result.message;
    }
  }
}
