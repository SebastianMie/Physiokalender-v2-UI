import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AbsenceService, Absence, CreateAbsenceRequest } from '../../data-access/api/absence.service';
import { AuthService } from '../../core/auth/auth.service';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-absence-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="header">
        <h1>Abwesenheiten</h1>
        <button class="btn btn-primary" (click)="openAddModal()">+ Neue Abwesenheit</button>
      </div>

      <!-- Filters -->
      <div class="filters">
        <div class="filter-group">
          <label>Therapeut:</label>
          <select [ngModel]="selectedTherapistId()" (ngModelChange)="selectedTherapistId.set($event)">
            <option [value]="null">Alle Therapeuten</option>
            @for (t of therapists(); track t.id) {
              <option [value]="t.id">{{ t.fullName }}</option>
            }
          </select>
        </div>
        <div class="filter-tabs">
          <button [class.active]="absenceFilter() === 'all'" (click)="setFilter('all')">Alle</button>
          <button [class.active]="absenceFilter() === 'recurring'" (click)="setFilter('recurring')">Regelmäßig</button>
          <button [class.active]="absenceFilter() === 'special'" (click)="setFilter('special')">Einmalig</button>
        </div>
        @if (absenceFilter() === 'special' || absenceFilter() === 'all') {
          <div class="filter-tabs time-filter">
            <button [class.active]="timeFilter() === 'future'" (click)="setTimeFilter('future')">Zukünftig</button>
            <button [class.active]="timeFilter() === 'past'" (click)="setTimeFilter('past')">Vergangen</button>
            <button [class.active]="timeFilter() === 'all'" (click)="setTimeFilter('all')">Alle</button>
          </div>

          <div class="filter-group date-range" style="display:flex; gap:0.5rem; align-items:center; margin-left:0.75rem;">
            <label style="font-size:0.8rem; color:#6B7280;">Zeitraum</label>
            <input class="date-input" type="date" [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event)" />
            <span style="color:#9CA3AF;">bis</span>
            <input class="date-input" type="date" [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event)" />
            <button class="btn-secondary" style="margin-left:0.25rem;" (click)="dateFrom.set(null); dateTo.set(null)">Zurücksetzen</button>
          </div>
        }
        @if (absenceFilter() === 'recurring' || absenceFilter() === 'all') {
          <div class="filter-group weekday-filter">
            <label>Wochentag:</label>
            <select [ngModel]="selectedWeekday()" (ngModelChange)="selectedWeekday.set($event)">
              <option [value]="null">Alle Wochentage</option>
              @for (weekday of weekdayOrder; track weekday) {
                <option [value]="weekday">{{ weekdayLabels[weekday] }}</option>
              }
            </select>
          </div>
        }
      </div>

      @if (loading()) {
        <div class="loading">Laden...</div>
      } @else if (filteredAbsences().length === 0) {
        <div class="empty-state">
          <p>Keine Abwesenheiten gefunden</p>
        </div>
      } @else {
        <!-- Recurring Absences Section -->
        @if (recurringAbsences().length > 0 && (absenceFilter() === 'all' || absenceFilter() === 'recurring')) {
          <div class="section">
            <div class="section-header">
              <h2>🔄 Regelmäßige Abwesenheiten</h2>
              <span class="section-count">{{ recurringAbsences().length }}</span>
            </div>
            @for (weekdayGroup of recurringByWeekday(); track weekdayGroup.weekday) {
              <div class="weekday-group">
                <div class="weekday-header" (click)="toggleWeekdayCollapse(weekdayGroup.weekday)">
                  <button class="collapse-btn" [class.collapsed]="collapsedWeekdays().has(weekdayGroup.weekday)">
                    {{ collapsedWeekdays().has(weekdayGroup.weekday) ? '▶' : '▼' }}
                  </button>
                  <span class="weekday-name">{{ weekdayGroup.label }}</span>
                  <span class="weekday-count">{{ weekdayGroup.absences.length }}</span>
                </div>
                @if (!collapsedWeekdays().has(weekdayGroup.weekday)) {
                  @for (absence of weekdayGroup.absences; track absence.id) {
                  <div class="absence-item recurring">
                    <div class="absence-info">
                      <span class="absence-therapist">{{ getTherapistName(absence.therapistId) }}</span>
                      <span class="absence-time">
                        <!-- For recurring absences, only show time, never a date -->
                        <span *ngIf="absence.startTime && absence.endTime">{{ formatTime(absence.startTime) }} - {{ formatTime(absence.endTime) }}</span>
                        <span *ngIf="!(absence.startTime && absence.endTime)">Ganztags</span>
                      </span>
                    </div>
                    <div class="absence-details">
                      <span class="absence-reason">{{ absence.reason || 'Kein Grund angegeben' }}</span>
                    </div>
                    <div class="absence-actions">
                      <button class="btn-icon-edit" (click)="openEditModal(absence)" title="Bearbeiten">✏️</button>
                      <button class="btn-icon-trash" (click)="confirmDelete(absence)" title="Löschen">🗑️</button>
                    </div>
                  </div>
                }
                }
              </div>
            }
          </div>
        }
        <!-- Special Absences Section (tabular) -->
        @if (specialAbsences().length > 0 && (absenceFilter() === 'all' || absenceFilter() === 'special')) {
          <div class="section">
            <div class="section-header">
              <h2>📅 Einmalige Abwesenheiten</h2>
              <span class="section-count">{{ specialAbsences().length }}</span>
            </div>

            <div class="table-wrapper special-absences-table">
              <table class="abs-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Therapeut</th>
                    <th>Zeit</th>
                    <th>Grund</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (absence of specialAbsences(); track absence.id) {
                    <tr [class.past]="isInPast(absence)">
                      <td class="col-date">
                        {{ formatDate(absence.date!) }}
                        <ng-container *ngIf="absence.endDate && absence.endDate !== absence.date"> - {{ formatDate(absence.endDate) }}</ng-container>
                      </td>
                      <td class="col-therapist">{{ getTherapistName(absence.therapistId) }}</td>
                      <td class="col-time">
                        <span *ngIf="absence.startTime && absence.endTime">{{ formatTime(absence.startTime) }} - {{ formatTime(absence.endTime) }}</span>
                        <span *ngIf="!(absence.startTime && absence.endTime)">Ganztags</span>
                      </td>
                      <td class="col-reason">{{ absence.reason || '–' }}</td>
                      <td class="col-actions">
                        <button class="btn-icon-edit" (click)="openEditModal(absence)" title="Bearbeiten">✏️</button>
                        <button class="btn-icon-trash" (click)="confirmDelete(absence)" title="Löschen">🗑️</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }

      <!-- Add/Edit Modal -->
      @if (showModal) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>{{ editingAbsence ? 'Abwesenheit bearbeiten' : 'Neue Abwesenheit' }}</h2>
            <form (ngSubmit)="saveAbsence()">
              @if (!editingAbsence) {
                <div class="form-group">
                  <label>Therapeut *</label>
                  <select [(ngModel)]="absenceForm.therapistId" name="therapistId" required>
                    <option [value]="null" disabled>Therapeut wählen...</option>
                    @for (t of therapists(); track t.id) {
                      <option [value]="t.id">{{ t.fullName }}</option>
                    }
                  </select>
                </div>
              }
              <div class="form-group">
                <label>Typ *</label>
                <select [(ngModel)]="absenceForm.absenceType" name="absenceType" required>
                  <option value="SPECIAL">Einmalig (Datum)</option>
                  <option value="RECURRING">Regelmäßig (Wochentag)</option>
                </select>
              </div>
              @if (absenceForm.absenceType === 'RECURRING') {
                <div class="form-group">
                  <label>Wochentag *</label>
                  <select [(ngModel)]="absenceForm.weekday" name="weekday" required>
                    <option value="MONDAY">Montag</option>
                    <option value="TUESDAY">Dienstag</option>
                    <option value="WEDNESDAY">Mittwoch</option>
                    <option value="THURSDAY">Donnerstag</option>
                    <option value="FRIDAY">Freitag</option>
                    <option value="SATURDAY">Samstag</option>
                    <option value="SUNDAY">Sonntag</option>
                  </select>
                </div>
              } @else {
                <div class="form-row">
                  <div class="form-group">
                    <label>Von Datum *</label>
                    <input type="date" [(ngModel)]="absenceForm.date" name="date" required />
                  </div>
                  <div class="form-group">
                    <label>Bis Datum</label>
                    <input type="date" [(ngModel)]="absenceForm.endDate" name="endDate" />
                  </div>
                </div>
              }
              <div class="form-row time-row-centered">
                <div class="form-group time-group">
                  <label>Von Uhrzeit</label>
                  <div class="time-hpicker">
                    <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'start', 'hour')" title="Scrollen zum Ändern">{{ getHourFromTime(absenceForm.startTime) }}</span>
                    <span class="tp-colon">:</span>
                    <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'start', 'minute')" title="Scrollen zum Ändern">{{ getMinuteFromTime(absenceForm.startTime) }}</span>
                    <span class="tp-label">Uhr</span>
                  </div>
                </div>
                <div class="form-group time-group">
                  <label>Bis Uhrzeit</label>
                  <div class="time-hpicker">
                    <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'end', 'hour')" title="Scrollen zum Ändern">{{ getHourFromTime(absenceForm.endTime) }}</span>
                    <span class="tp-colon">:</span>
                    <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'end', 'minute')" title="Scrollen zum Ändern">{{ getMinuteFromTime(absenceForm.endTime) }}</span>
                    <span class="tp-label">Uhr</span>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label>Grund</label>
                <input type="text" [(ngModel)]="absenceForm.reason" name="reason" placeholder="z.B. Urlaub, Fortbildung..." />
              </div>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closeModal()">Abbrechen</button>
                <button type="submit" class="btn btn-primary" [disabled]="saving()">
                  {{ saving() ? 'Speichern...' : 'Speichern' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Delete Confirmation Modal -->
      @if (showDeleteModal) {
        <div class="modal-overlay" (click)="closeDeleteModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Abwesenheit löschen?</h2>
            <p>Möchten Sie diese Abwesenheit wirklich löschen?</p>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="closeDeleteModal()">Abbrechen</button>
              <button type="button" class="btn-danger" (click)="deleteAbsence()" [disabled]="deleting()">
                {{ deleting() ? 'Löschen...' : 'Löschen' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { padding: 1.5rem; max-width: 1200px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    h1 { margin: 0; color: #1F2937; font-size: 1.5rem; }

    .filters { display: flex; align-items: center; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
    .filter-group { display: flex; align-items: center; gap: 0.5rem; }
    .filter-group label { font-size: 0.875rem; color: #6B7280; }
    .filter-group select { padding: 0.375rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; }
    .filter-tabs { display: flex; border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; }
    .filter-tabs button { padding: 0.375rem 0.75rem; border: none; background: white; cursor: pointer; font-size: 0.8rem; color: #6B7280; transition: all 0.15s; }
    .filter-tabs button:not(:last-child) { border-right: 1px solid #E5E7EB; }
    .filter-tabs button.active { background: #3B82F6; color: white; }
    .filter-tabs button:hover:not(.active) { background: #F3F4F6; }
    .time-filter { margin-left: auto; }
    input[type="text"], input[type="date"], input[type="time"], select { padding:0.45rem; border:1px solid #E5E7EB; border-radius:6px; }
    .loading { text-align: center; padding: 3rem; color: #6B7280; }
    .empty-state { text-align: center; padding: 3rem; color: #9CA3AF; background: #F9FAFB; border-radius: 8px; }

    /* Section Styles */
    .section { margin-bottom: 2rem; }
    .section-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #E5E7EB; }
    .section-header h2 { margin: 0; font-size: 1.1rem; color: #374151; font-weight: 600; }
    .section-count { background: #3B82F6; color: white; padding: 0.125rem 0.5rem; border-radius: 10px; font-size: 0.75rem; font-weight: 600; }

    /* Weekday Groups for Recurring */
    .weekday-group { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 0.75rem; overflow: hidden; }
    .weekday-header { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 1rem; background: linear-gradient(to right, #DBEAFE, #EFF6FF); border-bottom: 1px solid #BFDBFE; cursor: pointer; }
    .weekday-header:hover { background: linear-gradient(to right, #BFDBFE, #DBEAFE); }
    .weekday-name { font-weight: 700; color: #1E40AF; font-size: 0.9rem; }
    .weekday-count { background: #1E40AF; color: white; padding: 0.125rem 0.4rem; border-radius: 8px; font-size: 0.7rem; font-weight: 600; }
    .collapse-btn { background: none; border: none; font-size: 0.8rem; color: #1E40AF; cursor: pointer; padding: 0.125rem; margin-right: 0.5rem; transition: transform 0.2s; }
    .collapse-btn.collapsed { transform: rotate(0deg); }
    .collapse-btn:not(.collapsed) { transform: rotate(0deg); }

    .therapist-group { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem; overflow: hidden; }
    .group-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
    .therapist-link { color: #3B82F6; font-weight: 600; text-decoration: none; font-size: 0.95rem; }
    .therapist-link:hover { text-decoration: underline; }
    .count-badge { background: #E5E7EB; color: #374151; padding: 0.125rem 0.5rem; border-radius: 10px; font-size: 0.75rem; font-weight: 500; }

    .absence-list { padding: 0.5rem; max-height: 450px; overflow-y: auto; }
    .absence-item { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 1rem; border-bottom: 1px solid #F3F4F6; gap: 1rem; }
    .absence-item:last-child { border-bottom: none; }
    .absence-item.recurring { background: #F8FAFC; }
    .absence-item.special.past { opacity: 0.6; background: #F9FAFB; }

    /* Table for special absences */
    .table-wrapper.special-absences-table { max-height: 420px; overflow-y: auto; border: 1px solid #E5E7EB; border-radius: 8px; }
    .abs-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .abs-table thead th { background: #F9FAFB; padding: 0.6rem 0.75rem; text-align: left; font-weight: 600; border-bottom: 1px solid #E5E7EB; font-size: 0.75rem; }
    .abs-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #F3F4F6; color: #374151; }
    .abs-table tr.past td { opacity: 0.6; }
    .col-therapist { width: 220px; }
    .col-time { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .col-actions { width: 96px; text-align: right; }
    .col-reason { color: #6B7280; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .absence-info { display: flex; flex-direction: column; gap: 0.125rem; min-width: 150px; }
    .absence-therapist { font-weight: 600; color: #1F2937; font-size: 0.8rem; }
    .absence-day { font-weight: 600; color: #1F2937; font-size: 0.8rem; }
    .absence-time { font-size: 0.7rem; color: #6B7280; }

    .absence-details { flex: 1; display: flex; align-items: center; gap: 0.5rem; }
    .absence-reason { font-size: 0.75rem; color: #6B7280; }
    .past-badge { background: #9CA3AF; color: white; padding: 0.125rem 0.4rem; border-radius: 4px; font-size: 0.65rem; font-weight: 500; }

    .absence-actions { display: flex; align-items: center; gap: 0.25rem; }
    .btn-icon { background: none; border: none; cursor: pointer; font-size: 0.9rem; opacity: 0.5; transition: opacity 0.2s; padding: 0.25rem; }
    .btn-icon:hover { opacity: 1; }

    .btn-primary { background: #3B82F6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 0.875rem; }
    .btn-primary:hover { background: #2563EB; }
    .btn-primary:disabled { background: #93C5FD; cursor: not-allowed; }
    .btn-secondary { background: #E5E7EB; color: #374151; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-secondary:hover { background: #D1D5DB; }
    .btn-danger { background: #EF4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-danger:hover { background: #DC2626; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 450px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .modal h2 { margin: 0 0 1.5rem 0; color: #1F2937; font-size: 1.25rem; }
    .modal p { color: #6B7280; margin-bottom: 1.5rem; }

    .form-group { margin-bottom: 1rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .time-row-centered { justify-content: center; }
    .time-group { display: flex; flex-direction: column; align-items: center; }
    .time-hpicker { display: flex; align-items: center; gap: 0.15rem; background: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 8px; padding: 0.4rem 0.5rem; }
    .tp-value { font-size: 1.15rem; font-weight: 600; color: #111827; min-width: 32px; text-align: center; font-variant-numeric: tabular-nums; }
    .tp-scrollable { cursor: pointer; user-select: none; }
    .tp-scrollable:hover { background: #E5E7EB; border-radius: 4px; }
    .tp-colon { font-size: 1.1rem; font-weight: 700; color: #9CA3AF; margin: 0 0.1rem; }
    .tp-label { font-size: 0.75rem; color: #9CA3AF; font-weight: 500; margin-left: 0.2rem; }
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; color: #374151; font-size: 0.875rem; }
    .form-group input, .form-group select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; box-sizing: border-box; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .modal-actions { display: flex; justify-content: space-between; gap: 0.75rem; margin-top: 1.5rem; }
  `]
})
export class AbsenceListComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);
  deleting = signal(false);
  absences = signal<Absence[]>([]);
  therapists = signal<Therapist[]>([]);
  absenceFilter = signal<'all' | 'recurring' | 'special'>('all');
  timeFilter = signal<'future' | 'past' | 'all'>('future');
  selectedTherapistId = signal<number | null>(null);
  selectedWeekday = signal<string | null>(null);
  collapsedWeekdays = signal<Set<string>>(new Set());

  // optional date range filter for one-time absences
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  readonly weekdayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  readonly weekdayLabels: { [key: string]: string } = {
    'MONDAY': 'Montag',
    'TUESDAY': 'Dienstag',
    'WEDNESDAY': 'Mittwoch',
    'THURSDAY': 'Donnerstag',
    'FRIDAY': 'Freitag',
    'SATURDAY': 'Samstag',
    'SUNDAY': 'Sonntag'
  };

  // Time picker constants
  startHour = 6;
  endHour = 20;
  slotMinutes = 10;

  showModal = false;
  showDeleteModal = false;
  editingAbsence: Absence | null = null;
  absenceToDelete: Absence | null = null;

  absenceForm = {
    therapistId: null as number | null,
    absenceType: 'SPECIAL' as 'SPECIAL' | 'RECURRING',
    date: '',
    endDate: '',
    weekday: 'MONDAY',
    startTime: '',
    endTime: '',
    reason: ''
  };

  constructor(
    private absenceService: AbsenceService,
    private therapistService: TherapistService,
    private toast: ToastService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // collapse all weekdays by default
    this.collapsedWeekdays.set(new Set(this.weekdayOrder));

    this.loadData();

    // Debug: Show current user info
    this.authService.user$.subscribe(user => {
      console.log('AbsenceListComponent - Current user:', user);
    });
  }

  loadData(): void {
    this.loading.set(true);

    // Load therapists first
    this.therapistService.getAll().subscribe({
      next: (therapists) => {
        this.therapists.set(therapists.filter(t => t.isActive));
        this.loadAbsences();
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Fehler beim Laden der Therapeuten');
      }
    });
  }

  loadAbsences(): void {
    this.absenceService.getAll().subscribe({
      next: (absences: Absence[]) => {
        this.absences.set(absences || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Fehler beim Laden der Abwesenheiten');
      }
    });
  }

  filteredAbsences = computed(() => {
    let abs = this.absences();
    const filter = this.absenceFilter();
    const therapistId = this.selectedTherapistId();

    // Filter by type first
    switch (filter) {
      case 'recurring':
        abs = abs.filter(a => a.absenceType === 'RECURRING');
        break;
      case 'special':
        abs = abs.filter(a => a.absenceType === 'SPECIAL');
        break;
      default:
        // all
        break;
    }
    // Filter by therapist (after type filter)
    if (therapistId) {
      abs = abs.filter(a => a.therapistId === Number(therapistId));
    }
    return abs;
  });

  /** Recurring absences only */
  recurringAbsences = computed(() => {
    let abs = this.absences().filter(a => a.absenceType === 'RECURRING');
    const therapistId = this.selectedTherapistId();
    if (therapistId) {
      abs = abs.filter(a => a.therapistId === Number(therapistId));
    }
    return abs;
  });

  /** Special absences filtered by time */
  specialAbsences = computed(() => {
    let abs = this.absences().filter(a => a.absenceType === 'SPECIAL');
    const therapistId = this.selectedTherapistId();
    const tf = this.timeFilter();
    const today = new Date().toISOString().split('T')[0];

    if (therapistId) {
      abs = abs.filter(a => a.therapistId === Number(therapistId));
    }

    // Apply time filter
    if (tf === 'future') {
      abs = abs.filter(a => {
        const endDate = a.endDate || a.date;
        return endDate && endDate >= today;
      });
    } else if (tf === 'past') {
      abs = abs.filter(a => {
        const endDate = a.endDate || a.date;
        return endDate && endDate < today;
      });
    }

    // Apply optional custom date range filter (dateFrom / dateTo)
    const from = this.dateFrom();
    const to = this.dateTo();
    if (from || to) {
      abs = abs.filter(a => {
        const absStart = a.date || '';
        const absEnd = a.endDate || a.date || '';

        // If only 'from' is set, check if absence ends on or after 'from'
        if (from && !to) {
          return absEnd >= from;
        }

        // If only 'to' is set, check if absence starts on or before 'to'
        if (to && !from) {
          return absStart <= to;
        }

        // If both are set, check for overlap: absence range [absStart, absEnd]
        // overlaps with filter range [from, to]
        if (from && to) {
          return absStart <= to && absEnd >= from;
        }

        return true;
      });
    }

    // Sort by date (ascending for future/all, descending for past)
    return abs.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return tf === 'past' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    });
  });

  /** Recurring absences grouped by weekday */
  recurringByWeekday = computed(() => {
    const abs = this.recurringAbsences();
    const groups: { weekday: string; label: string; absences: Absence[] }[] = [];
    const selectedWeekday = this.selectedWeekday();
    const weekdaysToShow: string[] = selectedWeekday ? [selectedWeekday] : this.weekdayOrder;

    for (const weekday of weekdaysToShow) {
      const weekdayAbsences = abs.filter(a => a.weekday === weekday);
      if (weekdayAbsences.length > 0) {
        groups.push({
          weekday,
          label: this.weekdayLabels[weekday],
          absences: weekdayAbsences.sort((a, b) => {
            const timeA = a.startTime || '00:00';
            const timeB = b.startTime || '00:00';
            return timeA.localeCompare(timeB);
          })
        });
      }
    }

    return groups;
  });

  /** Special absences grouped by therapist */
  groupedSpecialAbsences = computed(() => {
    const filtered = this.specialAbsences();
    const therapists = this.therapists();
    const groups: { therapist: Therapist; absences: Absence[] }[] = [];

    for (const therapist of therapists) {
      const therapistAbsences = filtered.filter(a => a.therapistId === therapist.id);
      if (therapistAbsences.length > 0) {
        groups.push({ therapist, absences: therapistAbsences });
      }
    }

    return groups;
  });

  groupedAbsences = computed(() => {
    const filtered = this.filteredAbsences();
    const therapists = this.therapists();
    const groups: { therapist: Therapist; absences: Absence[] }[] = [];

    for (const therapist of therapists) {
      const therapistAbsences = filtered.filter(a => a.therapistId === therapist.id);
      if (therapistAbsences.length > 0) {
        groups.push({ therapist, absences: therapistAbsences });
      }
    }

    return groups;
  });

  setFilter(filter: 'all' | 'recurring' | 'special'): void {
    this.absenceFilter.set(filter);
  }

  setTimeFilter(filter: 'future' | 'past' | 'all'): void {
    this.timeFilter.set(filter);
  }

  toggleWeekdayCollapse(weekday: string): void {
    const current = this.collapsedWeekdays();
    const newSet = new Set(current);
    if (newSet.has(weekday)) {
      newSet.delete(weekday);
    } else {
      newSet.add(weekday);
    }
    this.collapsedWeekdays.set(newSet);
  }

  openAddModal(): void {
    this.editingAbsence = null;
    this.absenceForm = {
      therapistId: null,
      absenceType: 'SPECIAL',
      date: '',
      endDate: '',
      weekday: 'MONDAY',
      startTime: '',
      endTime: '',
      reason: ''
    };
    this.showModal = true;
  }

  openEditModal(absence: Absence): void {
    this.editingAbsence = absence;
    // Extract date part only (YYYY-MM-DD) to avoid timezone conversion issues
    const extractDateString = (dateValue: string | null): string => {
      if (!dateValue) return '';
      const dateOnly = dateValue.split('T')[0];
      return dateOnly || '';
    };

    this.absenceForm = {
      therapistId: absence.therapistId,
      absenceType: absence.absenceType,
      date: extractDateString(absence.date),
      endDate: extractDateString(absence.endDate),
      weekday: absence.weekday || 'MONDAY',
      startTime: this.formatTime(absence.startTime || ''),
      endTime: this.formatTime(absence.endTime || ''),
      reason: absence.reason || ''
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingAbsence = null;
  }

  saveAbsence(): void {
    // Temporarily disabled permission check for debugging
    /*
    // Check permissions for editing
    if (this.editingAbsence) {
      // Get current user synchronously
      let currentUser: any = null;
      this.authService.user$.subscribe(user => currentUser = user).unsubscribe();

      console.log('Current user for editing:', currentUser);
      const allowedRoles = ['ADMIN', 'RECEPTION'];
      if (!currentUser || !allowedRoles.includes(currentUser.role)) {
        this.toast.error('Sie haben keine Berechtigung, Abwesenheiten zu bearbeiten. Rolle: ' + (currentUser?.role || 'unbekannt'));
        return;
      }
    }
    */

    this.performSave();
  }

  private performSave(): void {
    if (!this.editingAbsence && !this.absenceForm.therapistId) {
      this.toast.error('Bitte wählen Sie einen Therapeuten');
      return;
    }

    if (this.absenceForm.absenceType === 'SPECIAL' && !this.absenceForm.date) {
      this.toast.error('Bitte geben Sie ein Datum ein');
      return;
    }

    this.saving.set(true);

    const request: CreateAbsenceRequest = {
      id: this.editingAbsence ? this.editingAbsence.id : undefined,
      therapistId: this.editingAbsence ? this.editingAbsence.therapistId : this.absenceForm.therapistId!,
      absenceType: this.absenceForm.absenceType,
      date: this.absenceForm.absenceType === 'SPECIAL' && this.absenceForm.date && this.absenceForm.date !== '' ? this.absenceForm.date : undefined,
      endDate: this.absenceForm.absenceType === 'SPECIAL' && this.absenceForm.endDate && this.absenceForm.endDate !== '' ? this.absenceForm.endDate : undefined,
      weekday: this.absenceForm.absenceType === 'RECURRING' ? this.absenceForm.weekday : undefined,
      startTime: this.absenceForm.startTime
        ? this.absenceForm.absenceType === 'SPECIAL'
          ? this.combineDateAndTime(this.absenceForm.date, this.absenceForm.startTime)
          : this.combineDateAndTime('1970-01-01', this.absenceForm.startTime) // Feste Basis für RECURRING
        : undefined,
      endTime: this.absenceForm.endTime
        ? this.absenceForm.absenceType === 'SPECIAL'
          ? this.combineDateAndTime(this.absenceForm.endDate || this.absenceForm.date, this.absenceForm.endTime)
          : this.combineDateAndTime('1970-01-01', this.absenceForm.endTime) // Feste Basis für RECURRING
        : undefined,
      reason: this.absenceForm.reason && this.absenceForm.reason !== '' ? this.absenceForm.reason : undefined
    };

    console.log('Saving absence request:', JSON.stringify(request, null, 2)); // Debug log

    const operation = this.editingAbsence
      ? this.absenceService.update(this.editingAbsence.id, request)
      : this.absenceService.create(request);

    operation.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editingAbsence ? 'Abwesenheit aktualisiert' : 'Abwesenheit erstellt');
        this.closeModal();
        this.loadAbsences();
      },
      error: (error: any) => {
        this.saving.set(false);
        console.error('Absence save error:', error);
        this.toast.error('Fehler beim Speichern: ' + (error.error?.message || error.message || 'Unbekannter Fehler'));
      }
    });
  }

  confirmDelete(absence: Absence): void {
    this.absenceToDelete = absence;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.absenceToDelete = null;
  }

  deleteAbsence(): void {
    if (!this.absenceToDelete) return;

    // Temporarily disabled permission check for debugging
    /*
    // Check permissions for deleting
    let currentUser: any = null;
    this.authService.user$.subscribe(user => currentUser = user).unsubscribe();

    console.log('Current user for deleting:', currentUser);
    const allowedRoles = ['ADMIN', 'RECEPTION'];
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      this.toast.error('Sie haben keine Berechtigung, Abwesenheiten zu löschen. Rolle: ' + (currentUser?.role || 'unbekannt'));
      return;
    }
    */

    this.performDelete();
  }

  private performDelete(): void {
    if (!this.absenceToDelete) return;

    this.deleting.set(true);
    this.absenceService.delete(this.absenceToDelete.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toast.success('Abwesenheit gelöscht');
        this.closeDeleteModal();
        this.loadAbsences();
      },
      error: (error: any) => {
        this.deleting.set(false);
        console.error('Absence delete error:', error);
        this.toast.error('Fehler beim Löschen: ' + (error.error?.message || error.message || 'Unbekannter Fehler'));
      }
    });
  }

  getWeekdayLabel(weekday: string | null): string {
    const labels: { [key: string]: string } = {
      'MONDAY': 'Montag',
      'TUESDAY': 'Dienstag',
      'WEDNESDAY': 'Mittwoch',
      'THURSDAY': 'Donnerstag',
      'FRIDAY': 'Freitag',
      'SATURDAY': 'Samstag',
      'SUNDAY': 'Sonntag'
    };
    return weekday ? labels[weekday] || weekday : '';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    // Extract date part (YYYY-MM-DD) to avoid timezone issues
    const dateOnly = dateStr.split('T')[0];
    if (!dateOnly || !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateStr;

    // Parse as local date without timezone conversion
    const [year, month, day] = dateOnly.split('-');
    return `${day}.${month}.${year}`;
  }

  formatTime(timeStr: string): string {
    // Accepts ISO string, LocalTime string, or HH:mm, always returns HH:mm
    if (!timeStr) return '';

    // Clean up input
    timeStr = timeStr.trim();

    // If ISO with time (e.g., 2026-02-15T05:00 or 1970-01-01T06:00:00)
    if (timeStr.includes('T')) {
      const parts = timeStr.split('T');
      timeStr = parts[1] || '';
    }

    // If still empty, return empty
    if (!timeStr) return '';

    // Now extract HH:mm from something like "06:00" or "06:00:00"
    const timeParts = timeStr.split(':');
    if (timeParts.length >= 2) {
      const h = timeParts[0];
      const m = timeParts[1];
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }

    return ''; // Fallback to empty if can't parse
  }

  getTherapistName(therapistId: number): string {
    const therapist = this.therapists().find(t => t.id === therapistId);
    return therapist ? therapist.fullName : 'Unbekannt';
  }

  isInPast(absence: Absence): boolean {
    if (!absence.date) return false;
    const today = new Date().toISOString().split('T')[0];
    const endDate = absence.endDate || absence.date;
    return endDate < today;
  }

  private combineDateAndTime(date: string, time: string): string {
    if (!date || !time) return '';
    // Kombiniere Datum (YYYY-MM-DD) mit Zeit (HH:mm) zu LocalDateTime (YYYY-MM-DDTHH:mm:00)
    return `${date}T${time}:00`;
  }

  // Time picker methods
  onTimeScroll(event: WheelEvent, which: 'start' | 'end', part: 'hour' | 'minute'): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1 : -1;
    if (part === 'hour') {
      this.adjustHour(which, delta);
    } else {
      this.adjustMinute(which, delta * this.slotMinutes);
    }
  }

  getHourFromTime(time: string): string {
    if (!time) return '--';
    return time.split(':')[0] || '--';
  }

  getMinuteFromTime(time: string): string {
    if (!time) return '--';
    return time.split(':')[1] || '--';
  }

  adjustHour(which: 'start' | 'end', delta: number): void {
    const prop = which === 'start' ? 'startTime' : 'endTime';
    let current = this.absenceForm[prop];
    if (!current) current = `${this.startHour.toString().padStart(2, '0')}:00`;

    const parts = current.split(':');
    let h = parseInt(parts[0], 10) + delta;
    if (h < this.startHour) h = this.endHour;
    if (h > this.endHour) h = this.startHour;
    this.absenceForm[prop] = `${h.toString().padStart(2, '0')}:${parts[1]}`;
  }

  adjustMinute(which: 'start' | 'end', delta: number): void {
    const prop = which === 'start' ? 'startTime' : 'endTime';
    let current = this.absenceForm[prop];
    if (!current) current = `${this.startHour.toString().padStart(2, '0')}:00`;

    const parts = current.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10) + delta;

    if (m >= 60) { m = 0; h++; }
    if (m < 0) { m = 50; h--; }
    if (h > this.endHour) { h = this.startHour; }
    if (h < this.startHour) { h = this.endHour; }
    if (h === this.endHour && m > 0) { m = 0; }

    this.absenceForm[prop] = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}
