import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService, User } from '../../core/auth/auth.service';
import { DailyListComponent } from '../calendar/daily-list.component';
import { AppointmentFinderComponent } from '../appointments/appointment-finder.component';
import { AppointmentFinderWizardComponent } from '../appointments/appointment-finder-wizard.component';
import { AppointmentModalComponent } from '../appointments/appointment-modal.standalone.component';
import { AppointmentService } from '../../data-access/api/appointment.service';
import { PatientService } from '../../data-access/api/patient.service';
import { TherapistService } from '../../data-access/api/therapist.service';
import { AbsenceService } from '../../data-access/api/absence.service';
import { UserService } from '../../data-access/api/user.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DailyListComponent, AppointmentFinderComponent, AppointmentFinderWizardComponent, AppointmentModalComponent],
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
        <a routerLink="/dashboard/appointments" class="quick-link">
          <span class="ql-icon">📋</span>
          <span>Termine</span>
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
          <span>{{ showFinderModal() ? 'Terminfinder schließen' : 'Terminfinder' }}</span>
        </button>
      </div>

      <div class="main-content">
        <div class="calendar-wrapper" [class.with-finder]="showFinder()">
          <app-daily-list [embedded]="true"></app-daily-list>
        </div>

        @if (showFinder()) {
          <div class="finder-panel">
            <app-appointment-finder [initialPatientId]="presetPatientId()" [initialTherapistId]="presetTherapistId()"></app-appointment-finder>
          </div>
        }

        <!-- Modal Finder (full-screen) -->
        @if (showFinderModal()) {
          <div class="modal-overlay" (click)="closeFinderModal()">
            <div class="modal modal-full" (click)="$event.stopPropagation()">
              <div style="flex:1; overflow:auto; padding:0.75rem 1rem;">
                <app-appointment-finder [initialPatientId]="presetPatientId()" [initialTherapistId]="presetTherapistId()" (reset)="closeFinderModal()"></app-appointment-finder>
              </div>
            </div>
          </div>
        }

        <!-- Appointment Modal (standalone component) -->
        @if (showAppointmentModal()) {
          <app-appointment-modal [presetPatientId]="presetPatientId()" [presetTherapistId]="presetTherapistId()" (close)="closeAppointmentModal()" (saved)="closeAppointmentModal(); loadCounts()"></app-appointment-modal>
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


    .oc-top { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; }
    .oc-title { font-weight:600; color:#374151; font-size:0.9rem; }
    .oc-count { font-size:1.25rem; color:#1F2937; font-weight:700; }
    .oc-actions { display:flex; gap:0.5rem; justify-content:flex-end; }
    .btn-link { background:none; border:none; color:#2563EB; cursor:pointer; font-size:0.85rem; padding:0; }

    .overview-cards {
      display: flex;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      margin: 0.75rem 1.5rem 1.25rem;
    }

    .overview-card {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding: 0.75rem 1rem;
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      min-width: 150px;
      text-decoration: none;
      color: #374151;
      transition: all 0.12s ease;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .overview-card:hover { border-color: #3B82F6; color: #3B82F6; background: #F8FAFF; transform: translateY(-2px); }

    @media (max-width:900px) {
      .overview-cards { justify-content:stretch; flex-wrap:wrap; }
      .overview-card { width: calc(50% - 0.75rem); }
    }

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

    /* Full-screen modal for Terminfinder */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1200; }
    .modal.modal-full { background: white; border-radius: 12px; padding: 0.5rem; width: 95vw; max-width: 1200px; height: 90vh; max-height: 90vh; box-shadow: 0 40px 60px rgba(0,0,0,0.2); overflow: hidden; display:flex; flex-direction:column; }
    .modal-header-bar { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid #EEF2FF; }
    .modal-header-bar h2 { margin:0; font-size:1.05rem; color:#111827; }
    .btn-close { background:none; border:none; font-size:1.5rem; line-height:1; cursor:pointer; color:#374151; }
  `]
})
export class DashboardComponent implements OnInit {
  currentUser = signal<User | null>(null);
  showFinder = signal(false);
  showFinderModal = signal(false);
  showAppointmentModal = signal(false);

  appointmentsCount = signal<number>(0);
  patientsCount = signal<number>(0);
  therapistsCount = signal<number>(0);
  absencesCount = signal<number>(0);
  usersCount = signal<number>(0);

  // Preset IDs forwarded into the embedded Terminfinder
  presetPatientId = signal<number | null>(null);
  presetTherapistId = signal<number | null>(null);

  constructor(
    private authService: AuthService,
    private patientService: PatientService,
    private therapistService: TherapistService,
    private appointmentService: AppointmentService,
    private absenceService: AbsenceService,
    private userService: UserService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => this.currentUser.set(user));
    this.loadCounts();
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'ADMIN';
  }

  toggleFinder(): void {
    // open/close the external modal (do NOT show the inline side panel)
    this.showFinderModal.update(v => !v);
    if (!this.showFinderModal()) {
      this.presetPatientId.set(null);
      this.presetTherapistId.set(null);
    }
    // ensure embedded sidebar stays closed
    this.showFinder.set(false);
  }

  openFinderForPatients(): void {
    // open modal finder (presets cleared)
    this.presetPatientId.set(null);
    this.presetTherapistId.set(null);
    this.showFinderModal.set(true);
  }

  openFinderForTherapists(): void {
    this.presetPatientId.set(null);
    this.presetTherapistId.set(null);
    this.showFinderModal.set(true);
  }

  openFinderWithPresetPatient(patientId: number): void {
    this.presetPatientId.set(patientId);
    this.presetTherapistId.set(null);
    this.showFinderModal.set(true);
  }

  openFinderWithPresetTherapist(therapistId: number): void {
    this.presetTherapistId.set(therapistId);
    this.presetPatientId.set(null);
    this.showFinderModal.set(true);
  }

  closeFinderModal(): void {
    this.showFinderModal.set(false);
    this.presetPatientId.set(null);
    this.presetTherapistId.set(null);
  }

  openAppointmentModal(): void {
    this.showAppointmentModal.set(true);
  }

  closeAppointmentModal(): void {
    this.showAppointmentModal.set(false);
  }

  goto(path: string): void {
    this.router.navigate([path]);
  }

  loadCounts(): void {
    this.patientService.getAll().subscribe({ next: p => this.patientsCount.set(p.length), error: () => this.patientsCount.set(0) });
    this.therapistService.getAll().subscribe({ next: t => this.therapistsCount.set((t || []).filter(x => x.isActive).length), error: () => this.therapistsCount.set(0) });
    this.absenceService.getAll().subscribe({ next: a => this.absencesCount.set(a.length), error: () => this.absencesCount.set(0) });
    this.userService.getAll().subscribe({ next: u => this.usersCount.set(u.length), error: () => this.usersCount.set(0) });

    const today = new Date().toISOString().slice(0,10);
    this.appointmentService.getPaginated({ dateFrom: today, size: 1 }).subscribe({
      next: resp => this.appointmentsCount.set(resp?.totalElements || 0),
      error: () => this.appointmentsCount.set(0)
    });
  }
}
