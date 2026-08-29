import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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
  loading = signal(false);
  error = signal('');

  async onSubmit() {
    if (!this.userId.trim()) {
      this.error.set('Please enter your User ID.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.userId);
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
      this.router.navigateByUrl(returnUrl);
    } catch (err: any) {
      this.error.set(err.message || 'Login failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
