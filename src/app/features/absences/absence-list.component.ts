import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AbsenceService, Absence, CreateAbsenceRequest } from '../../data-access/api/absence.service';
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
        <button class="btn-primary" (click)="openAddModal()">+ Neue Abwesenheit</button>
      </div>

      <!-- Filters -->
      <div class="filters">
        <div class="filter-group">
          <label>Therapeut:</label>
          <select [(ngModel)]="selectedTherapistId" (change)="onFilterChange()">
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
                <div class="weekday-header">
                  <span class="weekday-name">{{ weekdayGroup.label }}</span>
                  <span class="weekday-count">{{ weekdayGroup.absences.length }}</span>
                </div>
                @for (absence of weekdayGroup.absences; track absence.id) {
                  <div class="absence-item recurring">
                    <div class="absence-info">
                      <span class="absence-therapist">{{ getTherapistName(absence.therapistId) }}</span>
                      <span class="absence-time">
                        <!-- For recurring absences, only show time, never a date -->
                        @if (absence.startTime && absence.endTime) {
                          {{ formatTime(absence.startTime) }} - {{ formatTime(absence.endTime) }}
                        } @else {
                          Ganztags
                        }
                      </span>
                    </div>
                    <div class="absence-details">
                      <span class="absence-reason">{{ absence.reason || 'Kein Grund angegeben' }}</span>
                    </div>
                    <div class="absence-actions">
                      <button class="btn-icon" (click)="openEditModal(absence)" title="Bearbeiten">✏️</button>
                      <button class="btn-icon btn-delete" (click)="confirmDelete(absence)" title="Löschen">🗑️</button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
        <!-- Special Absences Section -->
        @if (specialAbsences().length > 0 && (absenceFilter() === 'all' || absenceFilter() === 'special')) {
          <div class="section">
            <div class="section-header">
              <h2>📅 Einmalige Abwesenheiten</h2>
              <span class="section-count">{{ specialAbsences().length }}</span>
            </div>
            @for (group of groupedSpecialAbsences(); track group.therapist.id) {
              <div class="therapist-group">
                <div class="group-header">
                  <a [routerLink]="['/dashboard/therapists', group.therapist.id]" class="therapist-link">
                    {{ group.therapist.fullName }}
                  </a>
                  <span class="count-badge">{{ group.absences.length }}</span>
                </div>
                <div class="absence-list">
                  @for (absence of group.absences; track absence.id) {
                    <div class="absence-item special" [class.past]="isInPast(absence)">
                      <div class="absence-info">
                        <span class="absence-day">
                          {{ formatDate(absence.date!) }}
                          @if (absence.endDate && absence.endDate !== absence.date) {
                            - {{ formatDate(absence.endDate) }}
                          }
                        </span>
                        <span class="absence-time">
                          @if (absence.startTime && absence.endTime) {
                            {{ formatTime(absence.startTime) }} - {{ formatTime(absence.endTime) }}
                          } @else {
                            Ganztags
                          }
                        </span>
                      </div>
                      <div class="absence-details">
                        <span class="absence-reason">{{ absence.reason || 'Kein Grund angegeben' }}</span>
                        @if (isInPast(absence)) {
                          <span class="past-badge">Vergangen</span>
                        }
                      </div>
                      <div class="absence-actions">
                        <button class="btn-icon" (click)="openEditModal(absence)" title="Bearbeiten">✏️</button>
                        <button class="btn-icon btn-delete" (click)="confirmDelete(absence)" title="Löschen">🗑️</button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
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
              <div class="form-row">
                <div class="form-group">
                  <label>Von Uhrzeit</label>
                  <input type="time" [(ngModel)]="absenceForm.startTime" name="startTime" />
                </div>
                <div class="form-group">
                  <label>Bis Uhrzeit</label>
                  <input type="time" [(ngModel)]="absenceForm.endTime" name="endTime" />
                </div>
              </div>
              <div class="form-group">
                <label>Grund</label>
                <input type="text" [(ngModel)]="absenceForm.reason" name="reason" placeholder="z.B. Urlaub, Fortbildung..." />
              </div>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closeModal()">Abbrechen</button>
                <button type="submit" class="btn-primary" [disabled]="saving()">
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

    .loading { text-align: center; padding: 3rem; color: #6B7280; }
    .empty-state { text-align: center; padding: 3rem; color: #9CA3AF; background: #F9FAFB; border-radius: 8px; }

    /* Section Styles */
    .section { margin-bottom: 2rem; }
    .section-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #E5E7EB; }
    .section-header h2 { margin: 0; font-size: 1.1rem; color: #374151; font-weight: 600; }
    .section-count { background: #3B82F6; color: white; padding: 0.125rem 0.5rem; border-radius: 10px; font-size: 0.75rem; font-weight: 600; }

    /* Weekday Groups for Recurring */
    .weekday-group { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 0.75rem; overflow: hidden; }
    .weekday-header { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 1rem; background: linear-gradient(to right, #DBEAFE, #EFF6FF); border-bottom: 1px solid #BFDBFE; }
    .weekday-name { font-weight: 700; color: #1E40AF; font-size: 0.9rem; }
    .weekday-count { background: #1E40AF; color: white; padding: 0.125rem 0.4rem; border-radius: 8px; font-size: 0.7rem; font-weight: 600; }

    .therapist-group { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem; overflow: hidden; }
    .group-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
    .therapist-link { color: #3B82F6; font-weight: 600; text-decoration: none; font-size: 0.95rem; }
    .therapist-link:hover { text-decoration: underline; }
    .count-badge { background: #E5E7EB; color: #374151; padding: 0.125rem 0.5rem; border-radius: 10px; font-size: 0.75rem; font-weight: 500; }

    .absence-list { padding: 0.5rem; }
    .absence-item { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid #F3F4F6; gap: 1rem; }
    .absence-item:last-child { border-bottom: none; }
    .absence-item.recurring { background: #F8FAFC; }
    .absence-item.special.past { opacity: 0.6; background: #F9FAFB; }

    .absence-info { display: flex; flex-direction: column; gap: 0.125rem; min-width: 150px; }
    .absence-therapist { font-weight: 600; color: #1F2937; font-size: 0.875rem; }
    .absence-day { font-weight: 600; color: #1F2937; font-size: 0.875rem; }
    .absence-time { font-size: 0.75rem; color: #6B7280; }

    .absence-details { flex: 1; display: flex; align-items: center; gap: 0.5rem; }
    .absence-reason { font-size: 0.8rem; color: #6B7280; }
    .past-badge { background: #9CA3AF; color: white; padding: 0.125rem 0.4rem; border-radius: 4px; font-size: 0.65rem; font-weight: 500; }

    .absence-actions { display: flex; align-items: center; gap: 0.25rem; }
    .btn-icon { background: none; border: none; cursor: pointer; font-size: 0.9rem; opacity: 0.5; transition: opacity 0.2s; padding: 0.25rem; }
    .btn-icon:hover { opacity: 1; }
    .btn-delete:hover { color: #DC2626; }

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
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; color: #374151; font-size: 0.875rem; }
    .form-group input, .form-group select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; box-sizing: border-box; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
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
  selectedTherapistId: number | null = null;

  private readonly weekdayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  private readonly weekdayLabels: { [key: string]: string } = {
    'MONDAY': 'Montag',
    'TUESDAY': 'Dienstag',
    'WEDNESDAY': 'Mittwoch',
    'THURSDAY': 'Donnerstag',
    'FRIDAY': 'Freitag',
    'SATURDAY': 'Samstag',
    'SUNDAY': 'Sonntag'
  };

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
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadData();
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
      next: (absences) => {
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
    const therapistId = this.selectedTherapistId;

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
    const therapistId = this.selectedTherapistId;
    if (therapistId) {
      abs = abs.filter(a => a.therapistId === Number(therapistId));
    }
    return abs;
  });

  /** Special absences filtered by time */
  specialAbsences = computed(() => {
    let abs = this.absences().filter(a => a.absenceType === 'SPECIAL');
    const therapistId = this.selectedTherapistId;
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

    // Sort by date
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

    for (const weekday of this.weekdayOrder) {
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

  onFilterChange(): void {
    // Trigger computed update
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
    this.absenceForm = {
      therapistId: absence.therapistId,
      absenceType: absence.absenceType,
      date: absence.date || '',
      endDate: absence.endDate || '',
      weekday: absence.weekday || 'MONDAY',
      startTime: absence.startTime || '',
      endTime: absence.endTime || '',
      reason: absence.reason || ''
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingAbsence = null;
  }

  saveAbsence(): void {
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
      therapistId: this.editingAbsence ? this.editingAbsence.therapistId : this.absenceForm.therapistId!,
      absenceType: this.absenceForm.absenceType,
      date: this.absenceForm.absenceType === 'SPECIAL' ? this.absenceForm.date : undefined,
      endDate: this.absenceForm.absenceType === 'SPECIAL' && this.absenceForm.endDate ? this.absenceForm.endDate : undefined,
      weekday: this.absenceForm.absenceType === 'RECURRING' ? this.absenceForm.weekday : undefined,
      startTime: this.absenceForm.startTime || undefined,
      endTime: this.absenceForm.endTime || undefined,
      reason: this.absenceForm.reason || undefined
    };

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
      error: () => {
        this.saving.set(false);
        this.toast.error('Fehler beim Speichern');
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

    this.deleting.set(true);
    this.absenceService.delete(this.absenceToDelete.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toast.success('Abwesenheit gelöscht');
        this.closeDeleteModal();
        this.loadAbsences();
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error('Fehler beim Löschen');
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
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatTime(timeStr: string): string {
    // Accepts ISO string or HH:mm, always returns HH:mm
    if (!timeStr) return '';
    // If ISO string (e.g. 2026-02-15T05:00), extract time part
    const match = timeStr.match(/T(\d{2}:\d{2})/);
    if (match) return match[1];
    // If only time, ensure HH:mm
    const [h, m] = timeStr.split(':');
    return `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
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
}
