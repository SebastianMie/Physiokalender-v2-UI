import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { AppointmentService, Appointment } from '../../data-access/api/appointment.service';

@Component({
  selector: 'app-therapist-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="detail-container">
      <div class="header-section">
        <button class="back-btn" (click)="goBack()">← Zurück</button>
        <h1>{{ therapist()?.fullName || 'Therapeut' }}</h1>
      </div>

      @if (loading()) {
        <div class="loading">Laden...</div>
      } @else if (therapist()) {
        <div class="content-grid">
          <!-- Therapist Info Card -->
          <div class="card info-card">
            <h2>Stammdaten</h2>
            <div class="info-grid">
              <div class="info-row">
                <span class="label">Name:</span>
                <span class="value">{{ therapist()?.fullName }}</span>
              </div>
              <div class="info-row">
                <span class="label">E-Mail:</span>
                <span class="value">{{ therapist()?.email || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="label">Telefon:</span>
                <span class="value">{{ therapist()?.telefon || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="label">Status:</span>
                <span class="value" [class.active]="therapist()?.isActive" [class.inactive]="!therapist()?.isActive">
                  {{ therapist()?.isActive ? 'Aktiv' : 'Inaktiv' }}
                </span>
              </div>
              <div class="info-row">
                <span class="label">Aktiv seit:</span>
                <span class="value">{{ therapist()?.activeSince || '-' }}</span>
              </div>
            </div>
          </div>

          <!-- Appointments Card -->
          <div class="card appointments-card">
            <div class="card-header">
              <h2>Termine</h2>
              <div class="filter-tabs">
                <button 
                  [class.active]="appointmentFilter() === 'upcoming'" 
                  (click)="setAppointmentFilter('upcoming')">
                  Kommende
                </button>
                <button 
                  [class.active]="appointmentFilter() === 'past'" 
                  (click)="setAppointmentFilter('past')">
                  Vergangene
                </button>
                <button 
                  [class.active]="appointmentFilter() === 'all'" 
                  (click)="setAppointmentFilter('all')">
                  Alle
                </button>
              </div>
            </div>

            @if (loadingAppointments()) {
              <div class="loading-inline">Termine werden geladen...</div>
            } @else if (filteredAppointments().length === 0) {
              <div class="empty-state">Keine Termine gefunden</div>
            } @else {
              <div class="appointments-list">
                @for (apt of filteredAppointments(); track apt.id) {
                  <div class="appointment-item" [class.cancelled]="apt.status === 'CANCELLED'">
                    <div class="apt-date">
                      <span class="date">{{ formatDate(apt.date) }}</span>
                      <span class="time">{{ apt.startTime }} - {{ apt.endTime }}</span>
                    </div>
                    <div class="apt-details">
                      <a [routerLink]="['/dashboard/patients', apt.patientId]" class="patient-link">
                        {{ apt.patientName }}
                      </a>
                      <span class="treatment">{{ apt.treatmentTypeName }}</span>
                    </div>
                    <div class="apt-status">
                      <span class="status-badge" [class]="apt.status.toLowerCase()">
                        {{ getStatusLabel(apt.status) }}
                      </span>
                      @if (apt.isBWO) {
                        <span class="tag bwo">BWO</span>
                      }
                      @if (apt.isHomeVisit) {
                        <span class="tag home">Hausbesuch</span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="error">Therapeut nicht gefunden</div>
      }
    </div>
  `,
  styles: [`
    .detail-container {
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header-section {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .back-btn {
      background: none;
      border: 1px solid #E5E7EB;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      color: #6B7280;
      font-size: 0.875rem;
    }

    .back-btn:hover {
      background: #F3F4F6;
      color: #374151;
    }

    h1 {
      margin: 0;
      font-size: 1.5rem;
      color: #111827;
    }

    .loading, .error {
      text-align: center;
      padding: 3rem;
      color: #6B7280;
    }

    .error {
      color: #DC2626;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 1.5rem;
    }

    @media (max-width: 900px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 1.25rem;
    }

    .card h2 {
      margin: 0 0 1rem 0;
      font-size: 1.125rem;
      color: #374151;
    }

    .info-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
    }

    .label {
      color: #6B7280;
      font-size: 0.875rem;
    }

    .value {
      color: #111827;
      font-weight: 500;
    }

    .value.active {
      color: #059669;
    }

    .value.inactive {
      color: #DC2626;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .filter-tabs {
      display: flex;
      gap: 0.25rem;
    }

    .filter-tabs button {
      padding: 0.375rem 0.75rem;
      border: 1px solid #E5E7EB;
      background: white;
      color: #6B7280;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .filter-tabs button:first-child {
      border-radius: 4px 0 0 4px;
    }

    .filter-tabs button:last-child {
      border-radius: 0 4px 4px 0;
    }

    .filter-tabs button.active {
      background: #3B82F6;
      border-color: #3B82F6;
      color: white;
    }

    .loading-inline, .empty-state {
      text-align: center;
      padding: 2rem;
      color: #6B7280;
    }

    .appointments-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .appointment-item {
      display: grid;
      grid-template-columns: 140px 1fr auto;
      gap: 1rem;
      padding: 0.75rem;
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      align-items: center;
    }

    .appointment-item.cancelled {
      opacity: 0.6;
      background: #F9FAFB;
    }

    .apt-date {
      display: flex;
      flex-direction: column;
    }

    .apt-date .date {
      font-weight: 500;
      color: #111827;
    }

    .apt-date .time {
      font-size: 0.75rem;
      color: #6B7280;
    }

    .apt-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .patient-link {
      color: #3B82F6;
      text-decoration: none;
      font-weight: 500;
    }

    .patient-link:hover {
      text-decoration: underline;
    }

    .treatment {
      font-size: 0.75rem;
      color: #6B7280;
    }

    .apt-status {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .status-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 500;
      text-transform: uppercase;
    }

    .status-badge.scheduled { background: #DBEAFE; color: #1D4ED8; }
    .status-badge.confirmed { background: #D1FAE5; color: #065F46; }
    .status-badge.completed { background: #E0E7FF; color: #3730A3; }
    .status-badge.cancelled { background: #FEE2E2; color: #991B1B; }
    .status-badge.no_show { background: #FEF3C7; color: #92400E; }

    .tag {
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-size: 0.625rem;
      font-weight: 600;
    }

    .tag.bwo { background: #FEF3C7; color: #92400E; }
    .tag.home { background: #E0E7FF; color: #3730A3; }
  `]
})
export class TherapistDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private therapistService = inject(TherapistService);
  private appointmentService = inject(AppointmentService);

  therapist = signal<Therapist | null>(null);
  appointments = signal<Appointment[]>([]);
  loading = signal(true);
  loadingAppointments = signal(true);
  appointmentFilter = signal<'upcoming' | 'past' | 'all'>('upcoming');

  filteredAppointments = computed(() => {
    const apts = this.appointments();
    const filter = this.appointmentFilter();
    const today = new Date().toISOString().split('T')[0];

    switch (filter) {
      case 'upcoming':
        return apts.filter(a => a.date >= today && a.status !== 'CANCELLED');
      case 'past':
        return apts.filter(a => a.date < today);
      case 'all':
      default:
        return apts;
    }
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadTherapist(id);
      this.loadAppointments(id);
    }
  }

  loadTherapist(id: number): void {
    this.therapistService.getById(id).subscribe({
      next: (therapist) => {
        this.therapist.set(therapist);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadAppointments(therapistId: number): void {
    this.appointmentService.getByTherapist(therapistId).subscribe({
      next: (appointments) => {
        // Sort by date descending
        appointments.sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
        this.appointments.set(appointments);
        this.loadingAppointments.set(false);
      },
      error: () => {
        this.loadingAppointments.set(false);
      }
    });
  }

  setAppointmentFilter(filter: 'upcoming' | 'past' | 'all'): void {
    this.appointmentFilter.set(filter);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/therapists']);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'SCHEDULED': 'Geplant',
      'CONFIRMED': 'Bestätigt',
      'COMPLETED': 'Abgeschlossen',
      'CANCELLED': 'Abgesagt',
      'NO_SHOW': 'Nicht erschienen'
    };
    return labels[status] || status;
  }
}
