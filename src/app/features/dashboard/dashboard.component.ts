import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, User } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard">
      <h1>Willkommen im PhysioKalendar</h1>
      <p class="subtitle">Wählen Sie einen Bereich aus</p>

      <div class="cards">
        <section class="card-section">
          <h2>Therapeuten-Bereich</h2>
          <div class="card-grid">
            <a routerLink="/dashboard/calendar" class="card card-primary">
              <div class="card-icon">📅</div>
              <div class="card-content">
                <h3>Kalender</h3>
                <p>Tagesübersicht & Terminverwaltung</p>
              </div>
            </a>
            <a routerLink="/dashboard/absences" class="card">
              <div class="card-icon">🏖️</div>
              <div class="card-content">
                <h3>Abwesenheiten</h3>
                <p>Urlaub & Abwesenheiten verwalten</p>
              </div>
            </a>
          </div>
        </section>

        @if (isAdmin()) {
          <section class="card-section">
            <h2>Admin-Bereich</h2>
            <div class="card-grid">
              <a routerLink="/dashboard/admin/therapists" class="card card-admin">
                <div class="card-icon">👨‍⚕️</div>
                <div class="card-content">
                  <h3>Therapeuten</h3>
                  <p>Therapeuten verwalten</p>
                </div>
              </a>
              <a routerLink="/dashboard/admin/patients" class="card card-admin">
                <div class="card-icon">👥</div>
                <div class="card-content">
                  <h3>Patienten</h3>
                  <p>Patientenstammdaten verwalten</p>
                </div>
              </a>
              <a routerLink="/dashboard/admin/users" class="card card-admin">
                <div class="card-icon">🔐</div>
                <div class="card-content">
                  <h3>Benutzer</h3>
                  <p>Benutzerkonten & Rechte</p>
                </div>
              </a>
            </div>
          </section>
        }

        <section class="card-section stats-section">
          <h2>Übersicht</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">-</div>
              <div class="stat-label">Termine heute</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">-</div>
              <div class="stat-label">Therapeuten aktiv</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">-</div>
              <div class="stat-label">Patienten gesamt</div>
            </div>
          </div>
          <p class="stats-note">Statistiken & Analysen werden demnächst verfügbar sein</p>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      margin: 0;
      color: #1F2937;
      font-size: 1.75rem;
    }

    .subtitle {
      color: #6B7280;
      margin: 0.5rem 0 2rem 0;
    }

    .card-section {
      margin-bottom: 2rem;
    }

    .card-section h2 {
      font-size: 1rem;
      color: #6B7280;
      margin: 0 0 1rem 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .card {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border: 2px solid transparent;
      transition: all 0.2s;
    }

    .card:hover {
      border-color: #2563EB;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
      transform: translateY(-2px);
    }

    .card-primary {
      background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
      color: white;
    }

    .card-primary:hover {
      border-color: #1E40AF;
    }

    .card-admin {
      border-left: 4px solid #8B5CF6;
    }

    .card-icon {
      font-size: 2rem;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
    }

    .card:not(.card-primary) .card-icon {
      background: #F3F4F6;
    }

    .card-content h3 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .card-content p {
      margin: 0.25rem 0 0 0;
      font-size: 0.875rem;
      opacity: 0.8;
    }

    .stats-section {
      margin-top: 2rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1rem;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #1F2937;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #6B7280;
      margin-top: 0.25rem;
    }

    .stats-note {
      text-align: center;
      color: #9CA3AF;
      font-size: 0.875rem;
      margin-top: 1rem;
      font-style: italic;
    }
  `]
})
export class DashboardComponent implements OnInit {
  currentUser = signal<User | null>(null);

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => this.currentUser.set(user));
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'ADMIN';
  }
}
