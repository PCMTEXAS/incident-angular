import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  userId = '';
  password = '';
  loading = signal(false);
  error = signal('');

  async onSubmit() {
    if (!this.userId || !this.password) {
      this.error.set('Please enter your User ID and password.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      const { isTempPassword } = await this.auth.login(this.userId, this.password, environment.supabaseUrl);
      if (isTempPassword) {
        // TODO: redirect to password change
      }
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
      this.router.navigateByUrl(returnUrl);
    } catch (err: any) {
      this.error.set(err.message || 'Login failed. Please check your credentials.');
    } finally {
      this.loading.set(false);
    }
  }
}
