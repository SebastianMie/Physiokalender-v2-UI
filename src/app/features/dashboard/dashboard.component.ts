import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, User } from '../../core/auth/auth.service';
import { DailyListComponent } from '../calendar/daily-list.component';
import { AppointmentFinderComponent } from '../appointments/appointment-finder.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DailyListComponent, AppointmentFinderComponent],
  template: `
    <div class="dashboard">
      <div class="welcome-banner">
        <h2>Willkommen, {{ currentUser()?.username || 'Benutzer' }}</h2>
      </div>

      <div class="quick-links">
        <a routerLink="/dashboard/calendar" class="quick-link">
          <span class="ql-icon">📅</span>
          <span>Kalender (Vollansicht)</span>
        </a>
        <a routerLink="/dashboard/absences" class="quick-link">
          <span class="ql-icon">🏖️</span>
          <span>Abwesenheiten</span>
        </a>
        @if (isAdmin()) {
          <a routerLink="/dashboard/therapists" class="quick-link">
            <span class="ql-icon">👨‍⚕️</span>
            <span>Therapeuten</span>
          </a>
          <a routerLink="/dashboard/patients" class="quick-link">
            <span class="ql-icon">👥</span>
            <span>Patienten</span>
          </a>
          <a routerLink="/dashboard/admin/users" class="quick-link">
            <span class="ql-icon">🔐</span>
            <span>Benutzer</span>
          </a>
        }
        <button class="quick-link finder-toggle" (click)="toggleFinder()">
          <span class="ql-icon">🔍</span>
          <span>{{ showFinder() ? 'Terminfinder ausblenden' : 'Terminfinder' }}</span>
        </button>
      </div>

      <div class="main-content">
        <div class="calendar-wrapper" [class.with-finder]="showFinder()">
          <app-daily-list [embedded]="true"></app-daily-list>
        </div>

        @if (showFinder()) {
          <div class="finder-panel">
            <app-appointment-finder></app-appointment-finder>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .welcome-banner {
      text-align: center;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
      border-bottom: 1px solid #BFDBFE;
    }
    .welcome-banner h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #1D4ED8;
    }
    .quick-links {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: #F9FAFB;
      border-bottom: 1px solid #E5E7EB;
      flex-wrap: wrap;
    }
    .quick-link {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.75rem;
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      text-decoration: none;
      color: #374151;
      font-size: 0.8rem;
      transition: all 0.15s;
      cursor: pointer;
    }
    .quick-link:hover {
      border-color: #3B82F6;
      color: #3B82F6;
      background: #EFF6FF;
    }
    .finder-toggle {
      border-color: #3B82F6;
      color: #3B82F6;
    }
    .ql-icon { font-size: 1rem; }

    .main-content {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    .calendar-wrapper {
      flex: 1;
      overflow: hidden;
      transition: flex 0.2s ease;
    }

    .calendar-wrapper.with-finder {
      flex: 2;
    }

    .finder-panel {
      width: 380px;
      min-width: 320px;
      max-width: 420px;
      border-left: 1px solid #E5E7EB;
      background: #F9FAFB;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 0.75rem;
    }

    @media (max-width: 900px) {
      .main-content {
        flex-direction: column;
      }
      .finder-panel {
        width: 100%;
        max-width: 100%;
        min-width: 100%;
        border-left: none;
        border-top: 1px solid #E5E7EB;
        max-height: 50vh;
      }
      .calendar-wrapper.with-finder {
        flex: 1;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  currentUser = signal<User | null>(null);
  showFinder = signal(false);

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => this.currentUser.set(user));
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'ADMIN';
  }

  toggleFinder(): void {
    this.showFinder.update(v => !v);
  }
}
