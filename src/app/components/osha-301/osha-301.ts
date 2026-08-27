import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { Incident } from '../../models';

@Component({
  selector: 'app-osha-301',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './osha-301.html',
  styleUrl: './osha-301.scss',
})
export class Osha301Component implements OnInit {
  private supa = inject(SupabaseService);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  error = signal('');
  inc: Incident | null = null;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    try {
      this.inc = await this.supa.getIncident(id);
    } catch (e: any) { this.error.set(e.message); }
    finally { this.loading.set(false); }
  }

  print() { window.print(); }
}
