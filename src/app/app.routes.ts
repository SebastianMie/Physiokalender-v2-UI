import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';

// Main app routes (without environment prefix)
const mainRoutes: Routes = [
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
        path: '',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/daily-list.component').then(
            (m) => m.DailyListComponent
          ),
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./features/appointments/appointment-overview.component').then(
            (m) => m.AppointmentOverviewComponent
          ),
      },
      {
        path: 'absences',
        loadComponent: () =>
          import('./features/absences/absence-list.component').then(
            (m) => m.AbsenceListComponent
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
        path: 'therapists/:id',
        loadComponent: () =>
          import('./features/therapists/therapist-detail.component').then(
            (m) => m.TherapistDetailComponent
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
        path: 'patients/:id',
        loadComponent: () =>
          import('./features/patients/patient-detail.component').then(
            (m) => m.PatientDetailComponent
          ),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            redirectTo: 'users',
            pathMatch: 'full',
          },
          {
            path: 'users',
            loadComponent: () =>
              import('./features/admin/user-management.component').then(
                (m) => m.UserManagementComponent
              ),
          },
          {
            path: 'audit',
            loadComponent: () =>
              import('./features/admin/audit-events.component').then(
                (m) => m.AuditEventsComponent
              ),
          },
          {
            path: 'statistics',
            loadComponent: () =>
              import('./features/admin/statistics.component').then(
                (m) => m.StatisticsComponent
              ),
          },
          {
            path: 'settings',
            loadComponent: () =>
              import('./features/admin/settings.component').then(
                (m) => m.SettingsComponent
              ),
          },
          {
            path: 'backup',
            loadComponent: () =>
              import('./features/admin/backup.component').then(
                (m) => m.BackupComponent
              ),
          },
        ],
      },
    ],
  },
];

export const appRoutes: Routes = [
  // Root redirect
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },

  // Main routes (production - no prefix)
  ...mainRoutes,

  // DEV environment routes (/dev/...)
  {
    path: 'dev',
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      ...mainRoutes,
    ],
  },

  // TEST environment routes (/test/...)
  {
    path: 'test',
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      ...mainRoutes,
    ],
  },

  // Fallback
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
