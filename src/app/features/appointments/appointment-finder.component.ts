import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize, forkJoin, debounceTime, distinctUntilChanged } from 'rxjs';
import { SlotSearchService, SlotSearchRequest, SlotSearchResponse, SlotDTO, DayPart } from '../../data-access/api/slot-search.service';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { PatientService, Patient } from '../../data-access/api/patient.service';
import { AppointmentService, CreateAppointmentRequest } from '../../data-access/api/appointment.service';
import { ToastService } from '../../core/services/toast.service';
import { PracticeSettingsService } from '../../core/services/practice-settings.service';

interface SearchForm {
  patientId: number | null;
  therapistId: number | null;
  durationMinutes: number;
  dayParts: DayPart[];
  rangeFrom: string;
  rangeTo: string;
}

@Component({
  selector: 'app-appointment-finder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="finder-card">
      <div class="finder-header">
        <h3>🔍 Terminfinder</h3>
        <span class="finder-subtitle">Freie Termine suchen</span>
      </div>

      <div class="finder-body">
        <!-- Search Form -->
        <div class="search-form">
          <!-- Patient Selection -->
          <div class="form-group">
            <label>Patient</label>
            <div class="patient-search-container">
              <input
                type="text"
                [(ngModel)]="patientSearchQuery"
                (ngModelChange)="onPatientSearch($event)"
                placeholder="Patient suchen..."
                class="patient-search-input"
              />
              @if (showPatientDropdown() && filteredPatients().length > 0) {
                <div class="patient-dropdown">
                  @for (patient of filteredPatients(); track patient.id) {
                    <div
                      class="patient-option"
                      [class.selected]="form.patientId === patient.id"
                      (click)="selectPatient(patient)">
                      {{ patient.fullName }}
                    </div>
                  }
                </div>
              }
            </div>
            @if (selectedPatient()) {
              <div class="selected-patient-tag">
                <span>{{ selectedPatient()?.fullName }}</span>
                <button class="remove-btn" (click)="clearPatient()">×</button>
              </div>
            }
          </div>

          <!-- Therapist Selection -->
          <div class="form-group">
            <label>Therapeut</label>
            <select [(ngModel)]="form.therapistId">
              <option [ngValue]="null">Alle Therapeuten</option>
              @for (therapist of therapists(); track therapist.id) {
                <option [ngValue]="therapist.id">{{ therapist.fullName }}</option>
              }
            </select>
          </div>

          <!-- Duration -->
          <div class="form-group">
            <label>Termindauer</label>
            <select [(ngModel)]="form.durationMinutes">
              <option [value]="15">15 Minuten</option>
              <option [value]="20">20 Minuten</option>
              <option [value]="30">30 Minuten</option>
              <option [value]="45">45 Minuten</option>
              <option [value]="60">60 Minuten</option>
            </select>
          </div>

          <!-- Day Parts -->
          <div class="form-group">
            <label>Tageszeit</label>
            <div class="day-part-checkboxes">
              <label class="checkbox-label">
                <input type="checkbox" [checked]="isDayPartSelected('MORNING')" (change)="toggleDayPart('MORNING')">
                Morgens
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [checked]="isDayPartSelected('AFTERNOON')" (change)="toggleDayPart('AFTERNOON')">
                Nachmittags
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [checked]="isDayPartSelected('EVENING')" (change)="toggleDayPart('EVENING')">
                Abends
              </label>
            </div>
          </div>

          <!-- Date Range -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label>Von</label>
              <input type="date" [(ngModel)]="form.rangeFrom" />
            </div>
            <div class="form-group flex-1">
              <label>Bis</label>
              <input type="date" [(ngModel)]="form.rangeTo" />
            </div>
          </div>

          <!-- Search Button -->
          <button
            class="btn-search"
            (click)="searchSlots()"
            [disabled]="searching() || !canSearch()">
            @if (searching()) {
              <span class="spinner"></span> Suche läuft...
            } @else {
              🔍 Freie Termine suchen
            }
          </button>
        </div>

        <!-- Results -->
        @if (hasSearched()) {
          <div class="results-section">
            <div class="results-header">
              <h4>Ergebnis</h4>
              <span class="result-count">{{ totalSlots() }} freie Slots</span>
            </div>

            @if (searchResponse()?.slotsByDay?.length) {
              <div class="results-list">
                @for (dayGroup of searchResponse()!.slotsByDay; track dayGroup.date) {
                  <div class="day-group">
                    <div class="day-header">
                      <span class="day-date">{{ formatDate(dayGroup.date) }}</span>
                      <span class="day-weekday">{{ getWeekday(dayGroup.date) }}</span>
                      <span class="slot-count">{{ dayGroup.slots.length }} Slots</span>
                    </div>
                    <div class="slots-grid">
                      @for (slot of dayGroup.slots.slice(0, expandedDays().has(dayGroup.date) ? undefined : 6); track $index) {
                        <button
                          class="slot-btn"
                          [class.selected]="isSlotSelected(slot)"
                          (click)="selectSlot(slot)">
                          <span class="slot-time">{{ formatTime(slot.startTime) }}</span>
                          <span class="slot-therapist">{{ slot.therapistName }}</span>
                        </button>
                      }
                      @if (dayGroup.slots.length > 6 && !expandedDays().has(dayGroup.date)) {
                        <button class="show-more-btn" (click)="expandDay(dayGroup.date)">
                          +{{ dayGroup.slots.length - 6 }} weitere
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="no-results">
                <span class="no-results-icon">📭</span>
                <p>Keine freien Termine im gewählten Zeitraum gefunden.</p>
                <p class="hint">Versuchen Sie einen größeren Zeitraum oder andere Kriterien.</p>
              </div>
            }
          </div>
        }

        <!-- Selected Slot Action -->
        @if (selectedSlot()) {
          <div class="selected-slot-action">
            <div class="selected-slot-info">
              <strong>{{ formatDate(selectedSlot()!.date) }}</strong>
              <span>{{ formatTime(selectedSlot()!.startTime) }} - {{ formatTime(selectedSlot()!.endTime) }}</span>
              <span>bei {{ selectedSlot()!.therapistName }}</span>
            </div>
            <button
              class="btn-book"
              (click)="bookAppointment()"
              [disabled]="booking() || !selectedPatient()">
              @if (booking()) {
                <span class="spinner"></span>
              } @else {
                ✓ Termin buchen
              }
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .finder-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: 100%;
    }

    .finder-header {
      padding: 0.75rem 1rem;
      background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
      border-bottom: 1px solid #BFDBFE;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .finder-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #1D4ED8;
    }

    .finder-subtitle {
      font-size: 0.75rem;
      color: #6B7280;
    }

    .finder-body {
      padding: 1rem;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .search-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .form-group label {
      font-size: 0.7rem;
      color: #6B7280;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .form-group input,
    .form-group select {
      padding: 0.5rem 0.6rem;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      font-size: 0.85rem;
      outline: none;
      color: #111827;
      background: white;
      font-family: inherit;
    }

    .form-group input:focus,
    .form-group select:focus {
      border-color: #3B82F6;
      box-shadow: 0 0 0 2px rgba(59,130,246,0.12);
    }

    .form-row {
      display: flex;
      gap: 0.5rem;
    }

    .flex-1 { flex: 1; }

    /* Patient Search */
    .patient-search-container {
      position: relative;
    }

    .patient-search-input {
      width: 100%;
    }

    .patient-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      max-height: 150px;
      overflow-y: auto;
      z-index: 100;
    }

    .patient-option {
      padding: 0.5rem 0.6rem;
      font-size: 0.85rem;
      cursor: pointer;
      border-bottom: 1px solid #F3F4F6;
    }

    .patient-option:hover {
      background: #EFF6FF;
    }

    .patient-option.selected {
      background: #DBEAFE;
      color: #1D4ED8;
    }

    .patient-option:last-child {
      border-bottom: none;
    }

    .selected-patient-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #DBEAFE;
      color: #1D4ED8;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      margin-top: 0.25rem;
    }

    .remove-btn {
      background: none;
      border: none;
      color: #1D4ED8;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      padding: 0;
    }

    .remove-btn:hover {
      color: #DC2626;
    }

    /* Day Part Checkboxes */
    .day-part-checkboxes {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.8rem;
      color: #374151;
      cursor: pointer;
    }

    .checkbox-label input {
      accent-color: #3B82F6;
    }

    /* Search Button */
    .btn-search {
      padding: 0.6rem 1rem;
      background: #2563EB;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      margin-top: 0.25rem;
    }

    .btn-search:hover:not(:disabled) {
      background: #1D4ED8;
    }

    .btn-search:disabled {
      opacity: 0.6;
      cursor: default;
    }

    /* Results */
    .results-section {
      border-top: 1px solid #E5E7EB;
      padding-top: 1rem;
    }

    .results-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .results-header h4 {
      margin: 0;
      font-size: 0.9rem;
      color: #111827;
    }

    .result-count {
      font-size: 0.7rem;
      color: #6B7280;
      background: #E5E7EB;
      padding: 0.15rem 0.4rem;
      border-radius: 10px;
    }

    .results-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-height: 300px;
      overflow-y: auto;
    }

    .day-group {
      background: #F9FAFB;
      border-radius: 6px;
      padding: 0.6rem;
    }

    .day-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .day-date {
      font-size: 0.85rem;
      font-weight: 600;
      color: #111827;
    }

    .day-weekday {
      font-size: 0.75rem;
      color: #6B7280;
    }

    .slot-count {
      margin-left: auto;
      font-size: 0.65rem;
      color: #6B7280;
      background: #E5E7EB;
      padding: 0.1rem 0.3rem;
      border-radius: 8px;
    }

    .slots-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .slot-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.4rem 0.6rem;
      background: white;
      border: 1px solid #D1D5DB;
      border-radius: 4px;
      cursor: pointer;
      min-width: 70px;
      transition: all 0.15s;
    }

    .slot-btn:hover {
      border-color: #3B82F6;
      background: #EFF6FF;
    }

    .slot-btn.selected {
      background: #2563EB;
      border-color: #2563EB;
      color: white;
    }

    .slot-btn.selected .slot-therapist {
      color: rgba(255,255,255,0.8);
    }

    .slot-time {
      font-size: 0.8rem;
      font-weight: 600;
    }

    .slot-therapist {
      font-size: 0.65rem;
      color: #6B7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 70px;
    }

    .show-more-btn {
      padding: 0.4rem 0.6rem;
      background: #E5E7EB;
      border: none;
      border-radius: 4px;
      color: #6B7280;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .show-more-btn:hover {
      background: #D1D5DB;
    }

    /* No Results */
    .no-results {
      text-align: center;
      padding: 1.5rem;
      color: #6B7280;
    }

    .no-results-icon {
      font-size: 2rem;
      display: block;
      margin-bottom: 0.5rem;
    }

    .no-results p {
      margin: 0.25rem 0;
      font-size: 0.85rem;
    }

    .no-results .hint {
      font-size: 0.75rem;
      color: #9CA3AF;
    }

    /* Selected Slot Action */
    .selected-slot-action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem;
      background: #ECFDF5;
      border: 1px solid #A7F3D0;
      border-radius: 6px;
      margin-top: auto;
    }

    .selected-slot-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      font-size: 0.8rem;
      color: #065F46;
    }

    .selected-slot-info strong {
      font-size: 0.85rem;
    }

    .btn-book {
      padding: 0.5rem 1rem;
      background: #059669;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      flex-shrink: 0;
    }

    .btn-book:hover:not(:disabled) {
      background: #047857;
    }

    .btn-book:disabled {
      opacity: 0.6;
      cursor: default;
    }

    /* Spinner */
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid white;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class AppointmentFinderComponent implements OnInit, OnDestroy {
  private slotSearchService = inject(SlotSearchService);
  private therapistService = inject(TherapistService);
  private patientService = inject(PatientService);
  private appointmentService = inject(AppointmentService);
  private toastService = inject(ToastService);
  private practiceSettings = inject(PracticeSettingsService);

  private destroy$ = new Subject<void>();
  private patientSearchSubject = new Subject<string>();

  // State signals
  therapists = signal<Therapist[]>([]);
  patients = signal<Patient[]>([]);
  filteredPatients = signal<Patient[]>([]);
  showPatientDropdown = signal(false);
  selectedPatient = signal<Patient | null>(null);
  selectedSlot = signal<SlotDTO | null>(null);
  expandedDays = signal<Set<string>>(new Set());

  searching = signal(false);
  booking = signal(false);
  hasSearched = signal(false);
  searchResponse = signal<SlotSearchResponse | null>(null);

  totalSlots = computed(() => this.searchResponse()?.totalSlotsFound ?? 0);

  patientSearchQuery = '';

  form: SearchForm = {
    patientId: null,
    therapistId: null,
    durationMinutes: 30,
    dayParts: [],
    rangeFrom: this.getDefaultFromDate(),
    rangeTo: this.getDefaultToDate()
  };

  ngOnInit(): void {
    this.loadInitialData();
    this.setupPatientSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadInitialData(): void {
    forkJoin({
      therapists: this.therapistService.getAll(),
      patients: this.patientService.getAll()
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.therapists.set(data.therapists.filter(t => t.isActive));
          this.patients.set(data.patients.filter(p => p.isActive));
        },
        error: (err) => {
          console.error('Error loading data:', err);
          this.toastService.error('Fehler beim Laden der Daten');
        }
      });
  }

  private setupPatientSearch(): void {
    this.patientSearchSubject.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      if (query.length < 2) {
        this.filteredPatients.set([]);
        this.showPatientDropdown.set(false);
        return;
      }

      const lowerQuery = query.toLowerCase();
      const filtered = this.patients().filter(p =>
        p.fullName.toLowerCase().includes(lowerQuery) ||
        p.firstName.toLowerCase().includes(lowerQuery) ||
        p.lastName.toLowerCase().includes(lowerQuery)
      ).slice(0, 10);

      this.filteredPatients.set(filtered);
      this.showPatientDropdown.set(true);
    });
  }

  onPatientSearch(query: string): void {
    this.patientSearchSubject.next(query);
  }

  selectPatient(patient: Patient): void {
    this.selectedPatient.set(patient);
    this.form.patientId = patient.id;
    this.patientSearchQuery = '';
    this.showPatientDropdown.set(false);
    this.filteredPatients.set([]);
  }

  clearPatient(): void {
    this.selectedPatient.set(null);
    this.form.patientId = null;
    this.patientSearchQuery = '';
  }

  isDayPartSelected(dayPart: DayPart): boolean {
    return this.form.dayParts.includes(dayPart);
  }

  toggleDayPart(dayPart: DayPart): void {
    const index = this.form.dayParts.indexOf(dayPart);
    if (index === -1) {
      this.form.dayParts = [...this.form.dayParts, dayPart];
    } else {
      this.form.dayParts = this.form.dayParts.filter(dp => dp !== dayPart);
    }
  }

  canSearch(): boolean {
    return !!this.form.rangeFrom && !!this.form.rangeTo && this.form.durationMinutes > 0;
  }

  searchSlots(): void {
    if (!this.canSearch()) return;

    this.searching.set(true);
    this.hasSearched.set(false);
    this.selectedSlot.set(null);
    this.expandedDays.set(new Set());

    const request: SlotSearchRequest = {
      rangeFrom: this.form.rangeFrom,
      rangeTo: this.form.rangeTo,
      durationMinutes: this.form.durationMinutes,
      therapistId: this.form.therapistId ?? undefined,
      dayParts: this.form.dayParts.length > 0 ? this.form.dayParts : undefined,
      excludePatientId: this.form.patientId ?? undefined
    };

    this.slotSearchService.searchSlots(request)
      .pipe(
        finalize(() => this.searching.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.searchResponse.set(response);
          this.hasSearched.set(true);
        },
        error: (err) => {
          console.error('Slot search error:', err);
          this.toastService.error('Fehler bei der Terminsuche');
          this.hasSearched.set(true);
          this.searchResponse.set({ slotsByDay: [], totalSlotsFound: 0 });
        }
      });
  }

  selectSlot(slot: SlotDTO): void {
    const current = this.selectedSlot();
    if (current && current.date === slot.date &&
        current.startTime === slot.startTime &&
        current.therapistId === slot.therapistId) {
      this.selectedSlot.set(null);
    } else {
      this.selectedSlot.set(slot);
    }
  }

  isSlotSelected(slot: SlotDTO): boolean {
    const selected = this.selectedSlot();
    if (!selected) return false;
    return selected.date === slot.date &&
           selected.startTime === slot.startTime &&
           selected.therapistId === slot.therapistId;
  }

  expandDay(date: string): void {
    const expanded = new Set(this.expandedDays());
    expanded.add(date);
    this.expandedDays.set(expanded);
  }

  bookAppointment(): void {
    const slot = this.selectedSlot();
    const patient = this.selectedPatient();

    if (!slot || !patient) {
      this.toastService.error('Bitte wählen Sie einen Slot und einen Patienten aus');
      return;
    }

    this.booking.set(true);

    // Build ISO timestamps
    const startDateTime = `${slot.date}T${this.normalizeTime(slot.startTime)}`;
    const endDateTime = `${slot.date}T${this.normalizeTime(slot.endTime)}`;

    const request: CreateAppointmentRequest = {
      therapistId: slot.therapistId,
      patientId: patient.id,
      date: `${slot.date}T00:00:00.000Z`,
      startTime: startDateTime,
      endTime: endDateTime
    };

    this.appointmentService.create(request)
      .pipe(
        finalize(() => this.booking.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (result) => {
          if (result.saved) {
            this.toastService.success(`Termin erfolgreich gebucht für ${patient.fullName}`);
            this.selectedSlot.set(null);
            // Re-search to update available slots
            this.searchSlots();
          } else {
            this.toastService.error('Termin konnte nicht gebucht werden - Konflikt erkannt');
          }
        },
        error: (err) => {
          console.error('Booking error:', err);
          this.toastService.error('Fehler beim Buchen des Termins');
        }
      });
  }

  // Helper methods
  private getDefaultFromDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1); // Start from tomorrow
    return this.formatDateISO(date);
  }

  private getDefaultToDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 14); // 2 weeks ahead
    return this.formatDateISO(date);
  }

  private formatDateISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  getWeekday(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString('de-DE', { weekday: 'long' });
  }

  formatTime(time: string): string {
    // Handle both "HH:mm:ss" and "HH:mm" formats
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
  }

  private normalizeTime(time: string): string {
    const parts = time.split(':');
    if (parts.length === 2) {
      return `${parts[0]}:${parts[1]}:00`;
    }
    return time;
  }
}
