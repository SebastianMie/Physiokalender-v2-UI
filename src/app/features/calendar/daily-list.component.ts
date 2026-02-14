import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { AppointmentService, Appointment, MoveAppointmentRequest } from '../../data-access/api/appointment.service';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { ToastService } from '../../core/services/toast.service';

interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
}

interface TherapistColumn {
  therapist: Therapist;
  appointments: Appointment[];
}

@Component({
  selector: 'app-daily-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DragDropModule],
  template: `
    <div class="calendar-container">
      <!-- Header -->
      <div class="calendar-header">
        <div class="date-navigation">
          <button class="nav-btn" (click)="previousDay()">‹</button>
          <button class="today-btn" (click)="goToToday()">Heute</button>
          <button class="nav-btn" (click)="nextDay()">›</button>
          <input type="date" [value]="selectedDateStr()" (change)="onDateChange($event)" class="date-input" />
        </div>
        <h1>{{ formattedDate() }}</h1>
        <div class="view-options">
          <span class="appointments-count">{{ totalAppointments() }} Termine</span>
        </div>
      </div>

      @if (loading()) {
        <div class="loading">Laden...</div>
      } @else {
        <!-- Calendar Grid -->
        <div class="calendar-grid">
          <!-- Time Column -->
          <div class="time-column">
            <div class="time-header">Zeit</div>
            @for (slot of timeSlots; track slot.time) {
              <div class="time-slot" [style.height.px]="slotHeight">
                <span class="time-label">{{ slot.time }}</span>
              </div>
            }
          </div>

          <!-- Therapist Columns -->
          @for (col of therapistColumns(); track col.therapist.id) {
            <div class="therapist-column">
              <div class="therapist-header">
                <a [routerLink]="['/dashboard/therapists', col.therapist.id]" class="therapist-name">
                  {{ col.therapist.fullName }}
                </a>
                <span class="apt-count">{{ col.appointments.length }}</span>
              </div>
              <div
                class="appointments-container"
                cdkDropList
                [cdkDropListData]="col.appointments"
                [id]="'therapist-' + col.therapist.id"
                [cdkDropListConnectedTo]="connectedDropLists()"
                (cdkDropListDropped)="onDrop($event, col.therapist.id)">

                @for (apt of col.appointments; track apt.id) {
                  <div
                    class="appointment-card"
                    cdkDrag
                    [cdkDragData]="apt"
                    [style.top.px]="getAppointmentTop(apt)"
                    [style.height.px]="getAppointmentHeight(apt)"
                    [class.cancelled]="apt.status === 'CANCELLED'"
                    [class.completed]="apt.status === 'COMPLETED'"
                    [class.bwo]="apt.isBWO"
                    [class.home-visit]="apt.isHomeVisit">

                    <div class="apt-time">{{ formatTime(apt.startTime) }} - {{ formatTime(apt.endTime) }}</div>
                    <a [routerLink]="['/dashboard/patients', apt.patientId]" class="apt-patient" (click)="$event.stopPropagation()">
                      {{ apt.patientName }}
                    </a>
                    <div class="apt-treatment">{{ apt.treatmentTypeName }}</div>
                    @if (apt.isBWO) {
                      <span class="apt-tag bwo">BWO</span>
                    }
                    @if (apt.isHomeVisit) {
                      <span class="apt-tag home">HB</span>
                    }

                    <div class="drag-handle" cdkDragHandle>⋮⋮</div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Conflict Modal -->
      @if (showConflictModal()) {
        <div class="modal-overlay" (click)="closeConflictModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Konflikt erkannt</h2>
            <p>Der Termin kann nicht verschoben werden, da ein Konflikt besteht:</p>
            <ul>
              @for (conflict of conflictInfo()?.conflicts || []; track conflict.message) {
                <li>{{ conflict.message }}</li>
              }
            </ul>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="closeConflictModal()">Abbrechen</button>
              <button class="btn-primary" (click)="forceMove()">Trotzdem verschieben</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .calendar-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
    }

    .calendar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #E5E7EB;
      background: #F9FAFB;
    }

    .date-navigation {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nav-btn, .today-btn {
      padding: 0.5rem 0.75rem;
      border: 1px solid #E5E7EB;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .nav-btn:hover, .today-btn:hover {
      background: #F3F4F6;
    }

    .date-input {
      padding: 0.5rem;
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      font-size: 0.875rem;
    }

    h1 {
      margin: 0;
      font-size: 1.25rem;
      color: #111827;
    }

    .appointments-count {
      font-size: 0.875rem;
      color: #6B7280;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: #6B7280;
    }

    .calendar-grid {
      display: flex;
      flex: 1;
      overflow: auto;
    }

    .time-column {
      width: 60px;
      flex-shrink: 0;
      border-right: 1px solid #E5E7EB;
      background: #F9FAFB;
    }

    .time-header {
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      color: #6B7280;
      font-weight: 500;
      border-bottom: 1px solid #E5E7EB;
    }

    .time-slot {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 4px;
      border-bottom: 1px solid #F3F4F6;
    }

    .time-label {
      font-size: 0.625rem;
      color: #9CA3AF;
    }

    .therapist-column {
      flex: 1;
      min-width: 180px;
      border-right: 1px solid #E5E7EB;
    }

    .therapist-header {
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 0.75rem;
      border-bottom: 1px solid #E5E7EB;
      background: #F9FAFB;
    }

    .therapist-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: #3B82F6;
      text-decoration: none;
    }

    .therapist-name:hover {
      text-decoration: underline;
    }

    .apt-count {
      font-size: 0.75rem;
      color: #6B7280;
      background: #E5E7EB;
      padding: 0.125rem 0.5rem;
      border-radius: 10px;
    }

    .appointments-container {
      position: relative;
      min-height: calc(12 * 48px); /* 12 hours × slotHeight */
    }

    .appointment-card {
      position: absolute;
      left: 4px;
      right: 4px;
      background: #EFF6FF;
      border-left: 3px solid #3B82F6;
      border-radius: 4px;
      padding: 0.375rem 0.5rem;
      font-size: 0.75rem;
      cursor: grab;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      transition: box-shadow 0.15s;
    }

    .appointment-card:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .appointment-card.cdk-drag-dragging {
      cursor: grabbing;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .appointment-card.cancelled {
      background: #FEE2E2;
      border-left-color: #DC2626;
      opacity: 0.6;
    }

    .appointment-card.completed {
      background: #D1FAE5;
      border-left-color: #059669;
    }

    .appointment-card.bwo {
      background: #FEF3C7;
      border-left-color: #D97706;
    }

    .appointment-card.home-visit {
      background: #E0E7FF;
      border-left-color: #4F46E5;
    }

    .apt-time {
      font-weight: 500;
      color: #374151;
      margin-bottom: 2px;
    }

    .apt-patient {
      color: #3B82F6;
      text-decoration: none;
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .apt-patient:hover {
      text-decoration: underline;
    }

    .apt-treatment {
      color: #6B7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .apt-tag {
      display: inline-block;
      padding: 0 0.25rem;
      border-radius: 2px;
      font-size: 0.5rem;
      font-weight: 600;
      margin-top: 2px;
    }

    .apt-tag.bwo { background: #FBBF24; color: #713F12; }
    .apt-tag.home { background: #818CF8; color: white; }

    .drag-handle {
      position: absolute;
      top: 50%;
      right: 4px;
      transform: translateY(-50%);
      color: #9CA3AF;
      cursor: grab;
      font-size: 0.75rem;
      letter-spacing: -2px;
    }

    .cdk-drag-placeholder {
      background: #DBEAFE;
      border: 2px dashed #3B82F6;
      border-radius: 4px;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      max-width: 400px;
      width: 90%;
    }

    .modal h2 {
      margin: 0 0 1rem 0;
      color: #DC2626;
    }

    .modal ul {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1.5rem;
    }

    .btn-secondary {
      padding: 0.5rem 1rem;
      border: 1px solid #E5E7EB;
      background: white;
      border-radius: 6px;
      cursor: pointer;
    }

    .btn-primary {
      padding: 0.5rem 1rem;
      border: none;
      background: #3B82F6;
      color: white;
      border-radius: 6px;
      cursor: pointer;
    }
  `]
})
export class DailyListComponent implements OnInit {
  private appointmentService = inject(AppointmentService);
  private therapistService = inject(TherapistService);
  private toastService = inject(ToastService);

  // State
  selectedDate = signal(new Date());
  loading = signal(true);
  therapists = signal<Therapist[]>([]);
  appointments = signal<Appointment[]>([]);
  showConflictModal = signal(false);
  conflictInfo = signal<any>(null);
  pendingMove = signal<{ appointmentId: number; request: MoveAppointmentRequest } | null>(null);

  // Configuration
  slotHeight = 48; // pixels per 30 minutes
  startHour = 7;
  endHour = 19;

  // Time slots (7:00 - 19:00 in 30min increments)
  timeSlots: TimeSlot[] = [];

  // Computed
  selectedDateStr = computed(() => this.selectedDate().toISOString().split('T')[0]);

  formattedDate = computed(() => {
    const date = this.selectedDate();
    const weekday = date.toLocaleDateString('de-DE', { weekday: 'long' });
    const formatted = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${weekday}, ${formatted}`;
  });

  totalAppointments = computed(() => this.appointments().filter(a => a.status !== 'CANCELLED').length);

  therapistColumns = computed<TherapistColumn[]>(() => {
    const therapists = this.therapists();
    const appointments = this.appointments();

    return therapists.map(therapist => ({
      therapist,
      appointments: appointments
        .filter(a => a.therapistId === therapist.id)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    }));
  });

  connectedDropLists = computed(() => {
    return this.therapists().map(t => 'therapist-' + t.id);
  });

  constructor() {
    // Generate time slots
    for (let hour = this.startHour; hour < this.endHour; hour++) {
      this.timeSlots.push({ time: `${hour}:00`, hour, minute: 0 });
      this.timeSlots.push({ time: `${hour}:30`, hour, minute: 30 });
    }
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    // Load therapists first, then appointments
    this.therapistService.getAll().subscribe({
      next: (therapists) => {
        this.therapists.set(therapists.filter(t => t.isActive));
        this.loadAppointments();
      },
      error: () => {
        this.loading.set(false);
        this.toastService.show('Fehler beim Laden der Therapeuten', 'error');
      }
    });
  }

  loadAppointments(): void {
    const dateStr = this.selectedDateStr();
    this.appointmentService.getByDate(dateStr).subscribe({
      next: (appointments) => {
        this.appointments.set(appointments);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toastService.show('Fehler beim Laden der Termine', 'error');
      }
    });
  }

  previousDay(): void {
    const date = new Date(this.selectedDate());
    date.setDate(date.getDate() - 1);
    this.selectedDate.set(date);
    this.loadAppointments();
  }

  nextDay(): void {
    const date = new Date(this.selectedDate());
    date.setDate(date.getDate() + 1);
    this.selectedDate.set(date);
    this.loadAppointments();
  }

  goToToday(): void {
    this.selectedDate.set(new Date());
    this.loadAppointments();
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedDate.set(new Date(input.value));
    this.loadAppointments();
  }

  getAppointmentTop(apt: Appointment): number {
    const time = apt.startTime.split(':');
    const hour = parseInt(time[0], 10);
    const minute = parseInt(time[1], 10);
    const minutesFromStart = (hour - this.startHour) * 60 + minute;
    return (minutesFromStart / 30) * this.slotHeight;
  }

  getAppointmentHeight(apt: Appointment): number {
    const start = apt.startTime.split(':');
    const end = apt.endTime.split(':');
    const startMinutes = parseInt(start[0], 10) * 60 + parseInt(start[1], 10);
    const endMinutes = parseInt(end[0], 10) * 60 + parseInt(end[1], 10);
    const duration = endMinutes - startMinutes;
    return Math.max((duration / 30) * this.slotHeight - 4, 24); // Minimum height
  }

  formatTime(timeStr: string): string {
    return timeStr.substring(0, 5);
  }

  onDrop(event: CdkDragDrop<Appointment[]>, targetTherapistId: number): void {
    const appointment = event.item.data as Appointment;

    // If dropped in same list and same position, do nothing
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }

    // Calculate new time based on drop position (simplified - same time for now)
    const request: MoveAppointmentRequest = {
      newDate: this.selectedDateStr(),
      newStartTime: appointment.startTime,
      newEndTime: appointment.endTime,
      newTherapistId: targetTherapistId !== appointment.therapistId ? targetTherapistId : undefined,
      force: false
    };

    this.appointmentService.move(appointment.id, request).subscribe({
      next: (result) => {
        if (result.saved) {
          this.toastService.show('Termin verschoben', 'success');
          this.loadAppointments();
        } else if (result.conflictCheck?.hasConflicts) {
          this.conflictInfo.set(result.conflictCheck);
          this.pendingMove.set({ appointmentId: appointment.id, request });
          this.showConflictModal.set(true);
        }
      },
      error: (err) => {
        if (err.status === 409) {
          this.conflictInfo.set(err.error);
          this.pendingMove.set({ appointmentId: appointment.id, request });
          this.showConflictModal.set(true);
        } else {
          this.toastService.show('Fehler beim Verschieben', 'error');
        }
      }
    });
  }

  closeConflictModal(): void {
    this.showConflictModal.set(false);
    this.conflictInfo.set(null);
    this.pendingMove.set(null);
    this.loadAppointments(); // Reload to reset positions
  }

  forceMove(): void {
    const pending = this.pendingMove();
    if (!pending) return;

    const request = { ...pending.request, force: true };
    this.appointmentService.move(pending.appointmentId, request).subscribe({
      next: () => {
        this.toastService.show('Termin trotz Konflikt verschoben', 'success');
        this.closeConflictModal();
        this.loadAppointments();
      },
      error: () => {
        this.toastService.show('Fehler beim Verschieben', 'error');
        this.closeConflictModal();
      }
    });
  }
}
