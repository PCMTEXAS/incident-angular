import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  userId = '';
  password = '';
  showPassword = false;
  errorMessage = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit() {
    this.errorMessage = '';
    this.loading = true;
    setTimeout(() => {
      const result = this.auth.login(this.userId, this.password);
      this.loading = false;
      if (result.success) {
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage = result.message;
      }
    }, 600);
  }
}
