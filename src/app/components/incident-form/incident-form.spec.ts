import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { IncidentFormComponent } from './incident-form';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeSupabaseMock() {
  return {
    searchEmployees: vi.fn().mockResolvedValue({ data: [], error: null }),
    createIncident: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
    uploadFile: vi.fn().mockResolvedValue({ url: 'http://example.com/file', error: null }),
  };
}

function makeAuthMock(authenticated = true) {
  return {
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
    getCurrentUser: vi.fn().mockReturnValue({ id: '1', role: 'admin' }),
    logout: vi.fn(),
  };
}

function makeRouterMock() {
  return { navigate: vi.fn() };
}

async function createComponent(authenticated = true) {
  const supabaseMock = makeSupabaseMock();
  const authMock = makeAuthMock(authenticated);
  const routerMock = makeRouterMock();

  await TestBed.configureTestingModule({
    imports: [IncidentFormComponent],
    providers: [
      { provide: SupabaseService, useValue: supabaseMock },
      { provide: AuthService,    useValue: authMock },
      { provide: Router,         useValue: routerMock },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<IncidentFormComponent> = TestBed.createComponent(IncidentFormComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  await fixture.whenStable();

  return { fixture, component, supabaseMock, authMock, routerMock };
}

// Directly call the private generateAnalysis method
function runAnalysis(component: IncidentFormComponent): string {
  return (component as any).generateAnalysis();
}

// ─── suite ────────────────────────────────────────────────────────────────────

describe('IncidentFormComponent — car wash incident types', () => {

  // ── 1. INCIDENT_TYPES catalogue ─────────────────────────────────────────────

  describe('INCIDENT_TYPES catalogue', () => {
    it('should contain all 5 car wash–specific types', async () => {
      const { component } = await createComponent();
      const values = component.INCIDENT_TYPES.map(t => t.value);
      expect(values).toContain('chemical_exposure');
      expect(values).toContain('slip_fall');
      expect(values).toContain('equipment_contact');
      expect(values).toContain('vehicle_damage');
      expect(values).toContain('customer_incident');
    });

    it('should retain all 9 original generic types alongside the new 5', async () => {
      const { component } = await createComponent();
      const values = component.INCIDENT_TYPES.map(t => t.value);
      ['injury','illness','nearmiss','vehicle','environmental','property','contractor','security','observation']
        .forEach(v => expect(values).toContain(v));
    });

    it('should give each car wash type a distinct Bootstrap icon', async () => {
      const { component } = await createComponent();
      const carWashTypes = component.INCIDENT_TYPES.filter(t =>
        ['chemical_exposure','slip_fall','equipment_contact','vehicle_damage','customer_incident'].includes(t.value)
      );
      const icons = carWashTypes.map(t => t.icon);
      expect(new Set(icons).size).toBe(5); // all icons are unique
      icons.forEach(icon => expect(icon).toMatch(/^bi-/));
    });

    it('should have a human-readable label for each car wash type', async () => {
      const { component } = await createComponent();
      const labelMap: Record<string, string> = {
        chemical_exposure: 'Chemical Exposure',
        slip_fall:         'Slip & Fall',
        equipment_contact: 'Equipment Contact',
        vehicle_damage:    'Vehicle Damage',
        customer_incident: 'Customer Incident',
      };
      Object.entries(labelMap).forEach(([value, expectedLabel]) => {
        const type = component.INCIDENT_TYPES.find(t => t.value === value);
        expect(type).toBeDefined();
        expect(type!.label).toBe(expectedLabel);
      });
    });
  });

  // ── 2. computeOsha — customer_incident ──────────────────────────────────────

  describe('computeOsha — customer_incident', () => {
    it('should always set osha_recordable=false regardless of medical treatment', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'customer_incident';
      component.form.medical_treatment = 'emergency room visit';
      component.form.work_related = 'yes';
      component.form.days_away = 5;
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(false);
    });

    it('should set the correct non-recordable reason for customer_incident', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'customer_incident';
      component.computeOsha();
      expect(component.form.osha_result).toContain('Customer');
      expect(component.form.osha_result).toContain('non-employee');
    });

    it('should NOT be recordable even with days_away > 0', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'customer_incident';
      component.form.days_away = 10;
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(false);
    });
  });

  // ── 3. computeOsha — vehicle_damage ─────────────────────────────────────────

  describe('computeOsha — vehicle_damage', () => {
    it('should always set osha_recordable=false', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'vehicle_damage';
      component.form.medical_treatment = 'surgery';
      component.form.work_related = 'yes';
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(false);
    });

    it('should set the correct non-recordable reason for vehicle_damage', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'vehicle_damage';
      component.computeOsha();
      expect(component.form.osha_result).toContain('Property');
      expect(component.form.osha_result).toContain('no personal injury');
    });
  });

  // ── 4. computeOsha — chemical_exposure (follows standard OSHA criteria) ─────

  describe('computeOsha — chemical_exposure', () => {
    it('should be recordable when work_related=yes and emergency treatment', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'chemical_exposure';
      component.form.work_related = 'yes';
      component.form.medical_treatment = 'emergency room';
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(true);
    });

    it('should be recordable when days_away > 0', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'chemical_exposure';
      component.form.work_related = 'yes';
      component.form.days_away = 2;
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(true);
      expect(component.form.osha_result).toContain('Days Away From Work');
    });

    it('should NOT be recordable when first aid only', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'chemical_exposure';
      component.form.work_related = 'yes';
      component.form.medical_treatment = 'first aid only';
      component.form.days_away = 0;
      component.form.days_restricted = 0;
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(false);
      expect(component.form.osha_result).toContain('First aid only');
    });

    it('should NOT be recordable when work_related=no', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'chemical_exposure';
      component.form.work_related = 'no';
      component.form.medical_treatment = 'physician';
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(false);
      expect(component.form.osha_result).toContain('Not work-related');
    });
  });

  // ── 5. computeOsha — slip_fall ───────────────────────────────────────────────

  describe('computeOsha — slip_fall', () => {
    it('should be recordable with physician treatment', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'slip_fall';
      component.form.work_related = 'yes';
      component.form.medical_treatment = 'physician visit';
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(true);
    });

    it('should be recordable with days_restricted > 0', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'slip_fall';
      component.form.work_related = 'yes';
      component.form.days_restricted = 3;
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(true);
      expect(component.form.osha_result).toContain('Job Transfer / Restricted Duty');
    });

    it('should NOT be recordable for first aid only', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'slip_fall';
      component.form.work_related = 'yes';
      component.form.medical_treatment = 'first aid only';
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(false);
    });
  });

  // ── 6. computeOsha — equipment_contact ──────────────────────────────────────

  describe('computeOsha — equipment_contact', () => {
    it('should be recordable when surgery is required', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'equipment_contact';
      component.form.work_related = 'yes';
      component.form.medical_treatment = 'surgery required';
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(true);
    });

    it('should be recordable with days_away > 0', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'equipment_contact';
      component.form.work_related = 'yes';
      component.form.days_away = 1;
      component.computeOsha();
      expect(component.form.osha_recordable).toBe(true);
    });
  });

  // ── 7. generateAnalysis — chemical_exposure ──────────────────────────────────

  describe('generateAnalysis — chemical_exposure', () => {
    it('should classify correctly as Chemical Exposure', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'chemical_exposure';
      const result = runAnalysis(component);
      expect(result).toContain('Chemical Exposure');
    });

    it('should recommend pulling the SDS', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'chemical_exposure';
      const result = runAnalysis(component);
      expect(result).toContain('SDS');
    });

    it('should recommend 15-minute decontamination flush', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'chemical_exposure';
      const result = runAnalysis(component);
      expect(result).toContain('15+');
    });

    it('should recommend verifying PPE (gloves, goggles, apron)', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'chemical_exposure';
      const result = runAnalysis(component);
      expect(result).toContain('gloves');
      expect(result).toContain('goggles');
      expect(result).toContain('apron');
    });

    it('should recommend reviewing dispensing equipment', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'chemical_exposure';
      const result = runAnalysis(component);
      expect(result).toContain('dispensing equipment');
    });
  });

  // ── 8. generateAnalysis — slip_fall ─────────────────────────────────────────

  describe('generateAnalysis — slip_fall', () => {
    it('should classify correctly as Slip & Fall', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'slip_fall';
      const result = runAnalysis(component);
      expect(result).toContain('Slip & Fall');
    });

    it('should recommend inspecting drainage and anti-slip mats', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'slip_fall';
      const result = runAnalysis(component);
      expect(result).toContain('drainage');
      expect(result).toContain('anti-slip');
    });

    it('should recommend footwear policy verification', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'slip_fall';
      const result = runAnalysis(component);
      expect(result).toContain('footwear');
    });

    it('should recommend wet floor signage', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'slip_fall';
      const result = runAnalysis(component);
      expect(result).toContain('wet floor signage');
    });
  });

  // ── 9. generateAnalysis — equipment_contact ──────────────────────────────────

  describe('generateAnalysis — equipment_contact', () => {
    it('should classify correctly as Equipment Contact / Entanglement', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'equipment_contact';
      const result = runAnalysis(component);
      expect(result).toContain('Equipment Contact');
    });

    it('should recommend immediate LOTO', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'equipment_contact';
      const result = runAnalysis(component);
      expect(result).toContain('LOTO');
    });

    it('should recommend inspecting conveyor, brushes, and rollers', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'equipment_contact';
      const result = runAnalysis(component);
      expect(result).toContain('conveyor');
      expect(result).toContain('brushes');
      expect(result).toContain('rollers');
    });

    it('should recommend reviewing guarding deficiencies', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'equipment_contact';
      const result = runAnalysis(component);
      expect(result).toContain('guarding');
    });
  });

  // ── 10. generateAnalysis — vehicle_damage ────────────────────────────────────

  describe('generateAnalysis — vehicle_damage', () => {
    it('should classify correctly as Customer Vehicle Damage', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'vehicle_damage';
      const result = runAnalysis(component);
      expect(result).toContain('Vehicle Damage');
    });

    it('should recommend photographic documentation', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'vehicle_damage';
      const result = runAnalysis(component);
      expect(result).toContain('photo');
    });

    it('should recommend collecting customer contact and insurance details', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'vehicle_damage';
      const result = runAnalysis(component);
      expect(result).toContain('contact information');
      expect(result).toContain('insurance');
    });

    it('should recommend inspecting conveyor tracking and guide rails', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'vehicle_damage';
      const result = runAnalysis(component);
      expect(result).toContain('guide rails');
    });
  });

  // ── 11. generateAnalysis — customer_incident ─────────────────────────────────

  describe('generateAnalysis — customer_incident', () => {
    it('should classify correctly as Customer Incident', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'customer_incident';
      const result = runAnalysis(component);
      expect(result).toContain('Customer Incident');
    });

    it('should recommend offering to call EMS', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'customer_incident';
      const result = runAnalysis(component);
      expect(result).toContain('EMS');
    });

    it('should recommend collecting customer statement', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'customer_incident';
      const result = runAnalysis(component);
      expect(result).toContain('customer statement');
    });

    it('should recommend notifying management for liability', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'customer_incident';
      const result = runAnalysis(component);
      expect(result).toContain('liability');
    });
  });

  // ── 12. generateAnalysis — OSHA flags for car wash recordable types ───────────

  describe('generateAnalysis — OSHA flag suppression for non-recordable car wash types', () => {
    it('should not show OSHA Recordable flag when customer_incident osha_recordable=false', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'customer_incident';
      component.form.osha_recordable = false;
      const result = runAnalysis(component);
      expect(result).not.toContain('⚠️ **OSHA Recordable**');
    });

    it('should not show OSHA Recordable flag when vehicle_damage osha_recordable=false', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'vehicle_damage';
      component.form.osha_recordable = false;
      const result = runAnalysis(component);
      expect(result).not.toContain('⚠️ **OSHA Recordable**');
    });

    it('should show OSHA Recordable flag when chemical_exposure is recordable', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'chemical_exposure';
      component.form.osha_recordable = true;
      component.form.osha_result = 'Recordable — Days Away From Work (2 days)';
      const result = runAnalysis(component);
      expect(result).toContain('⚠️ **OSHA Recordable**');
    });
  });

  // ── 13. generateAnalysis — severity escalation ───────────────────────────────

  describe('generateAnalysis — severity escalation for car wash types', () => {
    it('should show HIGH severity for equipment_contact with urgency=immediate', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'equipment_contact';
      component.form.urgency = 'immediate';
      const result = runAnalysis(component);
      expect(result).toContain('HIGH');
      expect(result).toContain('Suspend operations');
    });

    it('should show MEDIUM severity for slip_fall with urgency=high', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'slip_fall';
      component.form.urgency = 'high';
      const result = runAnalysis(component);
      expect(result).toContain('MEDIUM');
    });

    it('should show LOW severity for vehicle_damage with urgency=low', async () => {
      const { component } = await createComponent();
      component.form.incident_type = 'vehicle_damage';
      component.form.urgency = 'low';
      const result = runAnalysis(component);
      expect(result).toContain('LOW');
    });
  });

  // ── 14. auth redirect ────────────────────────────────────────────────────────

  describe('auth guard', () => {
    it('should redirect unauthenticated users to /login', async () => {
      const { routerMock } = await createComponent(false);
      expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  // ── 15. stepLabels ───────────────────────────────────────────────────────────

  describe('step structure', () => {
    it('should have 6 steps with correct labels', async () => {
      const { component } = await createComponent();
      expect(component.totalSteps).toBe(6);
      expect(component.stepLabels).toEqual(['Reporter','Incident','Involved','Injury','Investigation','Review']);
    });
  });
});

// ─── DashboardComponent typeLabel & INCIDENT_TYPES ───────────────────────────

import { DashboardComponent } from '../dashboard/dashboard';
import { ChangeDetectorRef } from '@angular/core';

describe('DashboardComponent — car wash type integration', () => {
  let component: DashboardComponent;

  beforeEach(async () => {
    const supabaseMock = {
      getIncidents: vi.fn().mockResolvedValue({ data: [], error: null }),
      getStats: vi.fn().mockResolvedValue({ total: 0, open: 0, recordable: 0, thisMonth: 0 }),
    };
    const authMock = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      getCurrentUser: vi.fn().mockReturnValue({ id: '1', role: 'admin' }),
    };
    const routerMock = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthService,    useValue: authMock },
        { provide: Router,         useValue: routerMock },
        ChangeDetectorRef,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  describe('INCIDENT_TYPES filter array', () => {
    it('should include all 5 car wash types', () => {
      expect(component.INCIDENT_TYPES).toContain('chemical_exposure');
      expect(component.INCIDENT_TYPES).toContain('slip_fall');
      expect(component.INCIDENT_TYPES).toContain('equipment_contact');
      expect(component.INCIDENT_TYPES).toContain('vehicle_damage');
      expect(component.INCIDENT_TYPES).toContain('customer_incident');
    });

    it('should include the empty-string sentinel for "All Types"', () => {
      expect(component.INCIDENT_TYPES[0]).toBe('');
    });
  });

  describe('typeLabel()', () => {
    it('should return "Chemical Exposure" for chemical_exposure', () => {
      expect(component.typeLabel('chemical_exposure')).toBe('Chemical Exposure');
    });

    it('should return "Slip & Fall" for slip_fall', () => {
      expect(component.typeLabel('slip_fall')).toBe('Slip & Fall');
    });

    it('should return "Equipment Contact" for equipment_contact', () => {
      expect(component.typeLabel('equipment_contact')).toBe('Equipment Contact');
    });

    it('should return "Vehicle Damage" for vehicle_damage', () => {
      expect(component.typeLabel('vehicle_damage')).toBe('Vehicle Damage');
    });

    it('should return "Customer Incident" for customer_incident', () => {
      expect(component.typeLabel('customer_incident')).toBe('Customer Incident');
    });

    it('should return "—" for undefined input', () => {
      expect(component.typeLabel(undefined)).toBe('—');
    });

    it('should return "—" for empty string input', () => {
      expect(component.typeLabel('')).toBe('—');
    });

    it('should return the raw value for an unknown type', () => {
      expect(component.typeLabel('some_new_type')).toBe('some_new_type');
    });
  });
});
