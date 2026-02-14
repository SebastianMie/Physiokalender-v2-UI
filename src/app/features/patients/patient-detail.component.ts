import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PatientService, Patient } from '../../data-access/api/patient.service';
import { AppointmentService, Appointment } from '../../data-access/api/appointment.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="detail-container">
      <div class="header-section">
        <button class="back-btn" (click)="goBack()">← Zurück</button>
        <h1>{{ patient()?.fullName || 'Patient' }}</h1>
        @if (patient()?.isBWO) { <span class="header-tag bwo">BWO</span> }
        @if (patient()?.isActive === false) { <span class="header-tag inactive">Inaktiv</span> }
      </div>

      @if (loading()) {
        <div class="loading">Laden...</div>
      } @else if (patient()) {
        <div class="content-grid">
          <!-- Stammdaten Form (1/3) -->
          <div class="card form-card">
            <div class="card-title-row">
              <h2>Stammdaten</h2>
              <label class="status-toggle">
                <input type="checkbox" [(ngModel)]="editForm.isActive" />
                <span class="toggle-label">{{ editForm.isActive ? 'Aktiv' : 'Inaktiv' }}</span>
              </label>
            </div>

            <div class="form-section">
              <div class="form-group">
                <label>Vorname</label>
                <input type="text" [(ngModel)]="editForm.firstName" />
              </div>
              <div class="form-group">
                <label>Nachname</label>
                <input type="text" [(ngModel)]="editForm.lastName" />
              </div>
              <div class="form-group">
                <label>Geburtsdatum</label>
                <input type="date" [(ngModel)]="editForm.dateOfBirth" />
              </div>
              <div class="form-group">
                <label>E-Mail</label>
                <input type="email" [(ngModel)]="editForm.email" />
              </div>
              <div class="form-group">
                <label>Telefon</label>
                <input type="tel" [(ngModel)]="editForm.telefon" />
              </div>
              <div class="form-group">
                <label>Versicherung</label>
                <input type="text" [(ngModel)]="editForm.insuranceType" />
              </div>

              <div class="form-divider"></div>
              <h3>Adresse</h3>

              <div class="form-row-2">
                <div class="form-group flex-3">
                  <label>Straße</label>
                  <input type="text" [(ngModel)]="editForm.street" />
                </div>
                <div class="form-group flex-1">
                  <label>Hausnr.</label>
                  <input type="text" [(ngModel)]="editForm.houseNumber" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group flex-1">
                  <label>PLZ</label>
                  <input type="text" [(ngModel)]="editForm.postalCode" />
                </div>
                <div class="form-group flex-3">
                  <label>Ort</label>
                  <input type="text" [(ngModel)]="editForm.city" />
                </div>
              </div>

              <div class="form-divider"></div>

              <div class="form-group">
                <label>Notizen</label>
                <textarea [(ngModel)]="editForm.notes" rows="3" placeholder="Optionale Notizen..."></textarea>
              </div>

              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="editForm.isBWO" />
                BWO (Behandlung ohne Verordnung)
              </label>

              <div class="form-actions">
                <button class="btn-save" (click)="savePatient()" [disabled]="saving()">
                  {{ saving() ? 'Speichern...' : 'Speichern' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Appointments Table (2/3) -->
          <div class="card appointments-card">
            <div class="card-header">
              <h2>Termine</h2>
              <span class="result-count">{{ filteredAppointments().length }}</span>
            </div>

            <!-- Filter Row -->
            <div class="apt-filters">
              <div class="filter-tabs">
                <button [class.active]="appointmentFilter() === 'upcoming'" (click)="setAppointmentFilter('upcoming')">Kommende</button>
                <button [class.active]="appointmentFilter() === 'past'" (click)="setAppointmentFilter('past')">Vergangene</button>
                <button [class.active]="appointmentFilter() === 'all'" (click)="setAppointmentFilter('all')">Alle</button>
              </div>
              <div class="status-filter">
                @for (s of allStatuses; track s.value) {
                  <button class="status-chip" [class.active]="filterStatus === s.value"
                    (click)="toggleStatusFilter(s.value)">{{ s.label }}</button>
                }
              </div>
            </div>

            @if (loadingAppointments()) {
              <div class="loading-inline">Termine werden geladen...</div>
            } @else if (filteredAppointments().length === 0) {
              <div class="empty-state">Keine Termine gefunden</div>
            } @else {
              <div class="table-wrapper">
                <table class="apt-table">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Zeit</th>
                      <th>Therapeut</th>
                      <th>Behandlung</th>
                      <th>Status</th>
                      <th>Kommentar</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (apt of filteredAppointments(); track apt.id) {
                      <tr [class.cancelled]="apt.status === 'CANCELLED'"
                          [class.completed]="apt.status === 'COMPLETED'"
                          (click)="navigateToDay(apt.date)">
                        <td class="col-date">{{ formatDateDE(apt.date) }}</td>
                        <td class="col-time">{{ formatTime(apt.startTime) }}–{{ formatTime(apt.endTime) }} Uhr</td>
                        <td>
                          <a [routerLink]="['/dashboard/therapists', apt.therapistId]" (click)="$event.stopPropagation()">{{ apt.therapistName }}</a>
                        </td>
                        <td>
                          <div class="treatment-tags">
                            @if (apt.isHotair) { <span class="tag hotair">HL</span> }
                            @if (apt.isUltrasonic) { <span class="tag ultra">US</span> }
                            @if (apt.isElectric) { <span class="tag electro">ET</span> }
                            @if (!apt.isHotair && !apt.isUltrasonic && !apt.isElectric) { <span class="tag default">KG</span> }
                          </div>
                        </td>
                        <td>
                          <span class="status-badge" [class]="'status-' + apt.status.toLowerCase()">{{ getStatusLabel(apt.status) }}</span>
                        </td>
                        <td class="col-comment">{{ apt.comment || '–' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="error">Patient nicht gefunden</div>
      }
    </div>
  `,
  styles: [`
    .detail-container { padding: 1.5rem; max-width: 1400px; margin: 0 auto; height: 100%; display: flex; flex-direction: column; }
    .header-section { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; }
    .back-btn { background: none; border: 1px solid #E5E7EB; padding: 0.4rem 0.75rem; border-radius: 6px; cursor: pointer; color: #6B7280; font-size: 0.8rem; }
    .back-btn:hover { background: #F3F4F6; color: #374151; }
    h1 { margin: 0; font-size: 1.35rem; color: #111827; }
    .header-tag { padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: 600; }
    .header-tag.bwo { background: #FEF3C7; color: #92400E; }
    .header-tag.inactive { background: #FEE2E2; color: #991B1B; }
    .loading, .error { text-align: center; padding: 3rem; color: #6B7280; }
    .error { color: #DC2626; }

    .content-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 1.25rem; flex: 1; overflow: hidden; }
    @media (max-width: 1000px) { .content-grid { grid-template-columns: 1fr; overflow: auto; } }

    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden; display: flex; flex-direction: column; }
    .card h2 { margin: 0; font-size: 1rem; color: #2563EB; }

    /* Stammdaten Form */
    .form-card { overflow-y: auto; }
    .card-title-row { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid #F3F4F6; }
    .status-toggle { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.75rem; color: #6B7280; }
    .status-toggle input { accent-color: #3B82F6; }
    .toggle-label { font-weight: 500; }
    .form-section { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
    h3 { margin: 0; font-size: 0.7rem; color: #6B7280; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
    .form-divider { height: 1px; background: #F3F4F6; margin: 0.25rem 0; }
    .form-group { display: flex; flex-direction: column; gap: 0.2rem; }
    .form-group label { font-size: 0.7rem; color: #6B7280; font-weight: 500; }
    .form-group input, .form-group textarea, .form-group select { padding: 0.4rem 0.5rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.8rem; outline: none; color: #111827; background: white; font-family: inherit; }
    .form-group input:focus, .form-group textarea:focus { border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.12); }
    .form-row-2 { display: flex; gap: 0.5rem; }
    .flex-1 { flex: 1; }
    .flex-3 { flex: 3; }
    .checkbox-label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: #374151; cursor: pointer; }
    .checkbox-label input { accent-color: #3B82F6; }
    .form-actions { padding-top: 0.5rem; display: flex; justify-content: flex-end; }
    .btn-save { padding: 0.45rem 1.25rem; background: #2563EB; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500; }
    .btn-save:hover { background: #1D4ED8; }
    .btn-save:disabled { opacity: 0.6; cursor: default; }

    /* Appointments Section */
    .appointments-card { display: flex; flex-direction: column; overflow: hidden; }
    .card-header { display: flex; align-items: center; gap: 0.6rem; padding: 1rem 1.25rem; border-bottom: 1px solid #F3F4F6; }
    .result-count { font-size: 0.7rem; color: #6B7280; background: #E5E7EB; padding: 0.1rem 0.4rem; border-radius: 10px; }
    .apt-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; border-bottom: 1px solid #F3F4F6; }
    .filter-tabs { display: flex; gap: 0; }
    .filter-tabs button { padding: 0.3rem 0.6rem; border: 1px solid #E5E7EB; background: white; color: #6B7280; font-size: 0.7rem; cursor: pointer; }
    .filter-tabs button:first-child { border-radius: 4px 0 0 4px; }
    .filter-tabs button:last-child { border-radius: 0 4px 4px 0; }
    .filter-tabs button.active { background: #3B82F6; border-color: #3B82F6; color: white; }
    .status-filter { display: flex; gap: 0.25rem; margin-left: auto; flex-wrap: wrap; }
    .status-chip { padding: 0.15rem 0.4rem; border: 1px solid #E5E7EB; background: white; border-radius: 4px; font-size: 0.6rem; cursor: pointer; color: #6B7280; }
    .status-chip.active { background: #EFF6FF; border-color: #3B82F6; color: #2563EB; }
    .loading-inline, .empty-state { text-align: center; padding: 2rem; color: #6B7280; font-size: 0.85rem; }
    .table-wrapper { flex: 1; overflow: auto; }
    .apt-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .apt-table thead { position: sticky; top: 0; z-index: 1; }
    .apt-table th { background: #F9FAFB; padding: 0.5rem 0.6rem; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #E5E7EB; white-space: nowrap; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .apt-table td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #F3F4F6; color: #374151; vertical-align: middle; }
    .apt-table tbody tr { cursor: pointer; transition: background 0.1s; }
    .apt-table tbody tr:hover { background: #F0F7FF; }
    .apt-table tbody tr.cancelled { opacity: 0.5; }
    .apt-table tbody tr.completed td { color: #6B7280; }
    .col-date { white-space: nowrap; }
    .col-time { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .col-comment { max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #9CA3AF; font-size: 0.7rem; }
    .apt-table a { color: #3B82F6; text-decoration: none; font-weight: 500; }
    .apt-table a:hover { text-decoration: underline; }
    .treatment-tags { display: flex; gap: 2px; }
    .tag { display: inline-block; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.6rem; font-weight: 600; }
    .tag.hotair { background: #FEE2E2; color: #991B1B; }
    .tag.ultra { background: #EDE9FE; color: #5B21B6; }
    .tag.electro { background: #D1FAE5; color: #065F46; }
    .tag.default { background: #E5E7EB; color: #6B7280; }
    .status-badge { font-size: 0.6rem; padding: 0.1rem 0.35rem; border-radius: 3px; font-weight: 500; white-space: nowrap; }
    .status-scheduled { background: #DBEAFE; color: #1E40AF; }
    .status-confirmed { background: #D1FAE5; color: #065F46; }
    .status-cancelled { background: #FEE2E2; color: #991B1B; }
    .status-completed { background: #E5E7EB; color: #374151; }
    .status-no_show { background: #FEF3C7; color: #92400E; }
  `]
})
export class PatientDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private patientService = inject(PatientService);
  private appointmentService = inject(AppointmentService);
  private toastService = inject(ToastService);

  patient = signal<Patient | null>(null);
  appointments = signal<Appointment[]>([]);
  loading = signal(true);
  loadingAppointments = signal(true);
  saving = signal(false);
  appointmentFilter = signal<'upcoming' | 'past' | 'all'>('upcoming');
  filterStatus = '';

  editForm = {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    telefon: '',
    insuranceType: '',
    street: '',
    houseNumber: '',
    postalCode: '',
    city: '',
    notes: '',
    isBWO: false,
    isActive: true
  };

  allStatuses = [
    { value: 'SCHEDULED', label: 'Geplant' },
    { value: 'CONFIRMED', label: 'Bestätigt' },
    { value: 'COMPLETED', label: 'Fertig' },
    { value: 'CANCELLED', label: 'Abgesagt' },
    { value: 'NO_SHOW', label: 'N/A' }
  ];

  filteredAppointments = computed(() => {
    let apts = this.appointments();
    const filter = this.appointmentFilter();
    const today = new Date().toISOString().split('T')[0];

    switch (filter) {
      case 'upcoming':
        apts = apts.filter(a => a.date >= today && a.status !== 'CANCELLED');
        break;
      case 'past':
        apts = apts.filter(a => a.date < today);
        break;
    }

    if (this.filterStatus) {
      apts = apts.filter(a => a.status === this.filterStatus);
    }

    return apts;
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadPatient(id);
      this.loadAppointments(id);
    }
  }

  loadPatient(id: number): void {
    this.patientService.getById(id).subscribe({
      next: (patient) => {
        this.patient.set(patient);
        this.populateForm(patient);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  populateForm(p: Patient): void {
    this.editForm.firstName = p.firstName || '';
    this.editForm.lastName = p.lastName || '';
    this.editForm.dateOfBirth = p.dateOfBirth || '';
    this.editForm.email = p.email || '';
    this.editForm.telefon = p.telefon || '';
    this.editForm.insuranceType = p.insuranceType || '';
    this.editForm.street = p.street || '';
    this.editForm.houseNumber = p.houseNumber || '';
    this.editForm.postalCode = p.postalCode || '';
    this.editForm.city = p.city || '';
    this.editForm.notes = p.notes || '';
    this.editForm.isBWO = p.isBWO;
    this.editForm.isActive = p.isActive;
  }

  savePatient(): void {
    const p = this.patient();
    if (!p) return;
    this.saving.set(true);
    this.patientService.update(p.id, this.editForm).subscribe({
      next: (updated) => {
        this.patient.set(updated);
        this.populateForm(updated);
        this.saving.set(false);
        this.toastService.show('Patient gespeichert', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.toastService.show('Fehler beim Speichern', 'error');
      }
    });
  }

  loadAppointments(patientId: number): void {
    this.appointmentService.getByPatient(patientId).subscribe({
      next: (appointments) => {
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

  toggleStatusFilter(status: string): void {
    this.filterStatus = this.filterStatus === status ? '' : status;
  }

  goBack(): void {
    this.router.navigate(['/dashboard/patients']);
  }

  formatDateDE(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.substring(0, 10);
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return d;
  }

  formatTime(timeStr: string): string {
    if (!timeStr) return '';
    if (timeStr.includes('T')) return timeStr.split('T')[1].substring(0, 5);
    return timeStr.substring(0, 5);
  }

  navigateToDay(dateStr: string): void {
    const date = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.substring(0, 10);
    this.router.navigate(['/dashboard/calendar'], { queryParams: { date } });
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
