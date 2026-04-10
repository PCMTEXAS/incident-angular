import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
export class App {
  private auth = inject(AuthService);

  /** Reset the 30-minute idle timer on any user activity. */
  @HostListener('document:mousemove')
  @HostListener('document:keydown')
  @HostListener('document:click')
  onUserActivity(): void {
    this.auth.resetIdleTimer();
  }
}
