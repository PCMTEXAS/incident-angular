import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type View = 'front' | 'rear' | 'driver' | 'passenger';

interface Zone {
  id: string;
  label: string;
  selected: boolean;
  damageType: string;
  severity: 'minor' | 'moderate' | 'severe' | '';
  notes: string;
}

@Component({
  selector: 'app-car-wash-damage-diagram',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './car-wash-damage-diagram.html',
  styleUrl: './car-wash-damage-diagram.scss',
})
export class CarWashDamageDiagramComponent {
  @Input() readonly = false;
  @Output() zonesChanged = new EventEmitter<Record<string, any>>();

  activeView = signal<View>('front');
  selectedZone = signal<Zone | null>(null);

  readonly views: View[] = ['front', 'rear', 'driver', 'passenger'];

  readonly damageTypes = [
    'Scratch', 'Dent', 'Paint damage', 'Mirror damage', 'Antenna damage',
    'Trim damage', 'Window damage', 'Wiper damage', 'Bumper damage', 'Other',
  ];

  zones: Record<View, Zone[]> = {
    front: [
      { id: 'f-hood', label: 'Hood', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'f-bumper', label: 'Front Bumper', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'f-grill', label: 'Grille', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'f-headlight-l', label: 'Left Headlight', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'f-headlight-r', label: 'Right Headlight', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'f-windshield', label: 'Windshield', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'f-wiper', label: 'Wipers', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'f-antenna', label: 'Antenna', selected: false, damageType: '', severity: '', notes: '' },
    ],
    rear: [
      { id: 'r-trunk', label: 'Trunk/Hatch', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'r-bumper', label: 'Rear Bumper', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'r-taillight-l', label: 'Left Taillight', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'r-taillight-r', label: 'Right Taillight', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'r-window', label: 'Rear Window', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'r-wiper', label: 'Rear Wiper', selected: false, damageType: '', severity: '', notes: '' },
    ],
    driver: [
      { id: 'd-door-f', label: 'Front Door', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'd-door-r', label: 'Rear Door', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'd-mirror', label: 'Mirror', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'd-fender-f', label: 'Front Fender', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'd-fender-r', label: 'Rear Fender', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'd-rocker', label: 'Rocker Panel', selected: false, damageType: '', severity: '', notes: '' },
    ],
    passenger: [
      { id: 'p-door-f', label: 'Front Door', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'p-door-r', label: 'Rear Door', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'p-mirror', label: 'Mirror', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'p-fender-f', label: 'Front Fender', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'p-fender-r', label: 'Rear Fender', selected: false, damageType: '', severity: '', notes: '' },
      { id: 'p-rocker', label: 'Rocker Panel', selected: false, damageType: '', severity: '', notes: '' },
    ],
  };

  get currentZones(): Zone[] {
    return this.zones[this.activeView()];
  }

  get selectedCount(): number {
    return Object.values(this.zones).flat().filter(z => z.selected).length;
  }

  setView(v: View) { this.activeView.set(v); this.selectedZone.set(null); }

  toggleZone(zone: Zone) {
    if (this.readonly) return;
    zone.selected = !zone.selected;
    if (zone.selected) this.selectedZone.set(zone);
    else if (this.selectedZone()?.id === zone.id) this.selectedZone.set(null);
    this.emit();
  }

  selectZone(zone: Zone) {
    if (zone.selected) this.selectedZone.set(zone);
  }

  emit() {
    const result: Record<string, any> = {};
    Object.values(this.zones).flat().filter(z => z.selected).forEach(z => {
      result[z.id] = { label: z.label, damageType: z.damageType, severity: z.severity, notes: z.notes };
    });
    this.zonesChanged.emit(result);
  }
}
