import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/daily-list.component').then(
            (m) => m.DailyListComponent
          ),
      },
      {
        path: 'therapists',
        loadComponent: () =>
          import('./features/therapists/therapist-list.component').then(
            (m) => m.TherapistListComponent
          ),
      },
      {
        path: 'patients',
        loadComponent: () =>
          import('./features/patients/patient-list.component').then(
            (m) => m.PatientListComponent
          ),
      },
      {
        path: 'absences',
        loadComponent: () =>
          import('./features/absences/absence-list.component').then(
            (m) => m.AbsenceListComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
