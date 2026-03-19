import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'form',
    loadComponent: () => import('./components/incident-form/incident-form').then(m => m.IncidentFormComponent),
    canActivate: [authGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin').then(m => m.AdminComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'osha-300a',
    loadComponent: () => import('./components/osha-300a/osha-300a').then(m => m.Osha300aComponent),
    canActivate: [authGuard]
  },
  {
    path: 'osha-301',
    loadComponent: () => import('./components/osha-301/osha-301').then(m => m.Osha301Component),
    canActivate: [authGuard]
  },
  {
    path: 'osha-301/:id',
    loadComponent: () => import('./components/osha-301/osha-301').then(m => m.Osha301Component),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'login' }
];
