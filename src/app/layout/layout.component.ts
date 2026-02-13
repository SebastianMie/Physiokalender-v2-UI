import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { ToastService } from '../core/services/toast.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="layout-container">
      <!-- Header -->
      <header class="header">
        <div class="header-content">
          <div class="logo">
            <h1>Physiokalender</h1>
          </div>
          <nav class="main-nav">
            <a routerLink="/dashboard/calendar" routerLinkActive="active" class="nav-link">
              Kalender
            </a>
            <a routerLink="/dashboard/therapists" routerLinkActive="active" class="nav-link">
              Therapeuten
            </a>
            <a routerLink="/dashboard/patients" routerLinkActive="active" class="nav-link">
              Patienten
            </a>
            <a routerLink="/dashboard/absences" routerLinkActive="active" class="nav-link">
              Abwesenheiten
            </a>
          </nav>
          <div class="user-section">
            <span class="user-name">{{ currentUser?.email }}</span>
            <button class="btn-logout" (click)="onLogout()">Abmelden</button>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .layout-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background-color: #F9FAFB;
    }

    .header {
      background-color: white;
      border-bottom: 1px solid #E5E7EB;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 4rem;
    }

    .logo {
      flex-shrink: 0;

      h1 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: #0066CC;
      }
    }

    .main-nav {
      display: flex;
      gap: 0.5rem;
      margin: 0 auto 0 2rem;
    }

    .nav-link {
      padding: 0.5rem 1rem;
      color: #6B7280;
      text-decoration: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s ease;

      &:hover {
        background-color: #F3F4F6;
        color: #0066CC;
      }

      &.active {
        color: #0066CC;
        background-color: #E6F0FF;
      }
    }

    .user-section {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-shrink: 0;
    }

    .user-name {
      font-size: 0.875rem;
      color: #6B7280;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-logout {
      padding: 0.5rem 1rem;
      background-color: #EF4444;
      color: white;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background-color: #DC2626;
      }

      &:active {
        transform: translateY(1px);
      }
    }

    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 2rem 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        gap: 1rem;
        height: auto;
        padding: 1rem;
      }

      .main-nav {
        margin: 0;
        flex-wrap: wrap;
        width: 100%;
      }

      .user-section {
        width: 100%;
      }

      .main-content {
        padding: 1rem;
      }
    }
  `]
})
export class LayoutComponent implements OnInit, OnDestroy {
  currentUser: any;
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.authService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user: any) => {
        this.currentUser = user;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onLogout(): void {
    this.authService.logout();
    this.toastService.success('Erfolgreich abgemeldet.');
    this.router.navigate(['/login']);
  }
}
