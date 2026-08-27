import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'incident/new',
    loadComponent: () => import('./components/incident-form/incident-form').then(m => m.IncidentFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'incident/:id',
    loadComponent: () => import('./components/incident-detail/incident-detail').then(m => m.IncidentDetailComponent),
    canActivate: [authGuard],
  },
  {
    path: 'car-wash',
    loadComponent: () => import('./components/car-wash-incident/car-wash-incident').then(m => m.CarWashIncidentComponent),
    canActivate: [authGuard],
  },
  {
    path: 'car-wash/:id',
    loadComponent: () => import('./components/car-wash-detail/car-wash-detail').then(m => m.CarWashDetailComponent),
    canActivate: [authGuard],
  },
  {
    path: 'osha-300a',
    loadComponent: () => import('./components/osha-300a/osha-300a').then(m => m.Osha300aComponent),
    canActivate: [authGuard],
  },
  {
    path: 'osha-301',
    loadComponent: () => import('./components/osha-301/osha-301').then(m => m.Osha301Component),
    canActivate: [authGuard],
  },
  {
    path: 'osha-301/:id',
    loadComponent: () => import('./components/osha-301/osha-301').then(m => m.Osha301Component),
    canActivate: [authGuard],
  },
  {
    path: 'osha-reports',
    loadComponent: () => import('./components/osha-reports/osha-reports').then(m => m.OshaReportsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin').then(m => m.AdminComponent),
    canActivate: [adminGuard],
  },
  { path: '**', redirectTo: 'dashboard' },
];
