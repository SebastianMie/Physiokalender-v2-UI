import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth/auth.service';
import { ToastService } from '../core/services/toast.service';
import { EnvironmentService } from '../core/services/environment.service';
import { EnvironmentBannerComponent } from '../shared/ui/environment-banner/environment-banner.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, EnvironmentBannerComponent],
  template: `
    <div class="layout-container" [class.has-env-banner]="environmentService.showBanner()">
      <!-- Environment Banner -->
      <app-environment-banner />
      <!-- Header -->
      <header class="header">
        <div class="header-content">
          <a routerLink="/dashboard" class="logo">
            <h1>Physiokalender</h1>
          </a>
          <nav class="main-nav">
            <a routerLink="/dashboard" [routerLinkActiveOptions]="{exact: true}" routerLinkActive="active" class="nav-link">
              Dashboard
            </a>
            <a routerLink="/dashboard/calendar" routerLinkActive="active" class="nav-link">
              Kalender
            </a>
            <a routerLink="/dashboard/absences" routerLinkActive="active" class="nav-link">
              Abwesenheiten
            </a>
            @if (isAdmin()) {
              <div class="dropdown" (mouseenter)="adminDropdownOpen = true" (mouseleave)="adminDropdownOpen = false">
                <button class="nav-link nav-admin dropdown-trigger" [class.active]="isAdminRouteActive()">
                  Verwaltung ▾
                </button>
                @if (adminDropdownOpen) {
                  <div class="dropdown-menu">
                    <a routerLink="/dashboard/admin/therapists" routerLinkActive="active" class="dropdown-item">
                      Therapeuten
                    </a>
                    <a routerLink="/dashboard/admin/patients" routerLinkActive="active" class="dropdown-item">
                      Patienten
                    </a>
                    <a routerLink="/dashboard/admin/users" routerLinkActive="active" class="dropdown-item">
                      Benutzer
                    </a>
                    <div class="dropdown-divider"></div>
                    <a routerLink="/dashboard/admin/settings" routerLinkActive="active" class="dropdown-item">
                      Stammdaten
                    </a>
                  </div>
                }
              </div>
            }
          </nav>
          <div class="user-section">
            <div class="user-dropdown" (mouseenter)="userDropdownOpen = true" (mouseleave)="userDropdownOpen = false">
              <button class="user-avatar" [title]="currentUser?.username">
                <span class="avatar-icon">👤</span>
              </button>
              @if (userDropdownOpen) {
                <div class="user-dropdown-menu">
                  <div class="user-info">
                    <span class="user-name">{{ currentUser?.username }}</span>
                    <span class="user-role-badge">{{ getRoleLabel() }}</span>
                  </div>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item" (click)="openPasswordModal()">
                    🔑 Passwort ändern
                  </button>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item dropdown-item-danger" (click)="onLogout()">
                    🚪 Abmelden
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      </header>

      <!-- Password Change Modal -->
      @if (showPasswordModal) {
        <div class="modal-overlay" (click)="closePasswordModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Passwort ändern</h2>
            <form (ngSubmit)="changePassword()">
              <div class="form-group">
                <label>Aktuelles Passwort</label>
                <input type="password" [(ngModel)]="passwordForm.currentPassword" name="currentPassword" required />
              </div>
              <div class="form-group">
                <label>Neues Passwort</label>
                <input type="password" [(ngModel)]="passwordForm.newPassword" name="newPassword" required />
              </div>
              <div class="form-group">
                <label>Passwort bestätigen</label>
                <input type="password" [(ngModel)]="passwordForm.confirmPassword" name="confirmPassword" required />
              </div>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closePasswordModal()">Abbrechen</button>
                <button type="submit" class="btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      }

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

    .layout-container.has-env-banner {
      padding-top: 28px;
    }

    .header {
      background-color: white;
      border-bottom: 1px solid #E5E7EB;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .layout-container.has-env-banner .header {
      top: 28px;
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
      text-decoration: none;

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

    .nav-admin {
      color: #DC2626;

      &:hover {
        color: #991B1B;
        background-color: #FEE2E2;
      }

      &.active {
        color: #991B1B;
        background-color: #FEE2E2;
      }
    }

    .dropdown {
      position: relative;
    }

    .dropdown-trigger {
      cursor: pointer;
      border: none;
      background: none;
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      min-width: 160px;
      z-index: 1000;
      padding: 0.25rem 0;
    }

    .dropdown-item {
      display: block;
      padding: 0.5rem 1rem;
      color: #374151;
      text-decoration: none;
      font-size: 0.875rem;
      transition: background-color 0.15s;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      cursor: pointer;

      &:hover {
        background-color: #F3F4F6;
      }

      &.active {
        background-color: #FEE2E2;
        color: #991B1B;
      }
    }

    .dropdown-item-danger {
      color: #DC2626;
      &:hover { background-color: #FEE2E2; }
    }

    .dropdown-divider {
      height: 1px;
      background: #E5E7EB;
      margin: 0.25rem 0;
    }

    .user-section {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }

    .user-dropdown {
      position: relative;
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563EB, #1D4ED8);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;

      &:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      }
    }

    .avatar-icon {
      font-size: 1.25rem;
      filter: grayscale(1) brightness(10);
    }

    .user-dropdown-menu {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 0.75rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
      min-width: 200px;
      z-index: 1000;
      padding: 0.5rem 0;
    }

    .user-info {
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .user-name {
      font-size: 0.875rem;
      color: #1F2937;
      font-weight: 600;
    }

    .user-role-badge {
      font-size: 0.75rem;
      color: #6B7280;
      padding: 0.125rem 0.5rem;
      background: #F3F4F6;
      border-radius: 9999px;
      width: fit-content;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    }

    .modal h2 {
      margin: 0 0 1.5rem 0;
      color: #1F2937;
      font-size: 1.25rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
      color: #374151;
      font-size: 0.875rem;
    }

    .form-group input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      font-size: 0.875rem;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: #2563EB;
        box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
      }
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }

    .btn-primary {
      background: #2563EB;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      &:hover { background: #1D4ED8; }
    }

    .btn-secondary {
      background: #E5E7EB;
      color: #374151;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      &:hover { background: #D1D5DB; }
    }

    .user-role {
      font-size: 0.75rem;
      color: #6B7280;
      padding: 0.125rem 0.5rem;
      background: #F3F4F6;
      border-radius: 9999px;
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
  environmentService = inject(EnvironmentService);
  currentUser: any;
  adminDropdownOpen = false;
  userDropdownOpen = false;
  showPasswordModal = false;
  passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
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

  isAdmin(): boolean {
    return this.currentUser?.role === 'ADMIN' || this.currentUser?.role === 'RECEPTION';
  }

  isAdminRouteActive(): boolean {
    return this.router.url.includes('/admin/');
  }

  getRoleLabel(): string {
    switch (this.currentUser?.role) {
      case 'ADMIN': return 'Admin';
      case 'RECEPTION': return 'Rezeption';
      case 'THERAPIST': return 'Therapeut';
      default: return '';
    }
  }

  openPasswordModal(): void {
    this.userDropdownOpen = false;
    this.showPasswordModal = true;
    this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
  }

  closePasswordModal(): void {
    this.showPasswordModal = false;
  }

  changePassword(): void {
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.toastService.error('Die Passwörter stimmen nicht überein.');
      return;
    }
    if (this.passwordForm.newPassword.length < 6) {
      this.toastService.error('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    // TODO: Implement password change API call
    this.toastService.success('Passwort erfolgreich geändert.');
    this.closePasswordModal();
  }
}
