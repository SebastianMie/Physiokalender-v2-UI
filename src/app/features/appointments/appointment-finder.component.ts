import { Component, OnInit, OnDestroy, OnChanges, Input, Output, EventEmitter, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize, forkJoin, debounceTime, distinctUntilChanged, catchError, of } from 'rxjs';
import { SlotSearchService, SlotSearchRequest, SlotSearchResponse, SlotDTO, DayPart } from '../../data-access/api/slot-search.service';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { PatientService, Patient } from '../../data-access/api/patient.service';
import { AppointmentService, CreateAppointmentRequest } from '../../data-access/api/appointment.service';
import { ToastService } from '../../core/services/toast.service';
import { PracticeSettingsService } from '../../core/services/practice-settings.service';

interface SearchForm {
  patientId: number | null;
  therapistIds: number[];       // empty = any therapist ("Alle")
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
        <button class="btn-reset" style="margin-left:auto;" title="Reset Finder (X)" (click)="resetFinder()">✕</button>
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

          <!-- Therapist Selection (chips + "Alle" option) -->
                <div class="form-group">
            <label>Therapeut</label>
            <div class="therapist-scroller" role="list">
              <button type="button" class="therapist-chip" [class.active]="form.therapistIds.length === 0" (click)="clearTherapistSelection()">Alle Therapeuten</button>
              @for (therapist of therapists(); track therapist.id) {
                <button type="button" class="therapist-chip" [class.active]="form.therapistIds.includes(therapist.id)" (click)="toggleTherapist(therapist.id)">{{ therapist.fullName }}</button>
              }
            </div>
            <div class="form-note">Ausgewählt: {{ form.therapistIds.length === 0 ? 'Alle' : (form.therapistIds.length + ' ausgewählt') }}</div>
          </div>

          <!-- Duration -->
          <div class="form-group">
            <label>Termindauer</label>
            <select [(ngModel)]="form.durationMinutes">
              <option [value]="10">10 Minuten</option>
              <option [value]="20">20 Minuten</option>
              <option [value]="30">30 Minuten</option>
              <option [value]="40">40 Minuten</option>
              <option [value]="60">60 Minuten</option>
            </select>
          </div>

          <!-- Day Parts + Time-range scroller -->
          <div class="form-group">
            <label>Tageszeit</label>
            <div class="day-part-checkboxes">
                <label class="checkbox-label">
                <input type="checkbox" [checked]="isDayPartSelected('MORNING')" (change)="toggleDayPart('MORNING')">
                Morgens (06:00–12:00)
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [checked]="isDayPartSelected('AFTERNOON')" (change)="toggleDayPart('AFTERNOON')">
                Nachmittags (12:00–17:00)
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [checked]="isDayPartSelected('EVENING')" (change)="toggleDayPart('EVENING')">
                Abends (19:30–21:00)
              </label>
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
            <div class="results-header" style="display:flex;align-items:center;gap:0.75rem;">
              <h4 style="margin:0">Ergebnis</h4>

              <div style="display:flex;align-items:center;gap:0.5rem;margin-left:0.5rem;">
                <label style="font-size:0.8rem;color:#6B7280;">Filter:</label>
                <select [ngModel]="resultTherapistFilter()" (ngModelChange)="resultTherapistFilter.set($event)">
                  <option [ngValue]="null">Alle Therapeuten</option>
                  @for (t of visibleResultTherapists(); track t.id) {
                    <option [ngValue]="t.id">{{ t.fullName }}</option>
                  }
                </select>
              </div>

              <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem;">
                <span class="result-count">{{ totalSlots() }} freie Slots</span>
                <label style="font-size:0.8rem;color:#6B7280;display:flex;align-items:center;gap:0.35rem;">
                  <input type="checkbox" [checked]="collapseGroups()" (click)="toggleCollapseGroups()" /> Termine zusammenfassen
                </label>
              </div>
            </div>

            @if (searchResponse()?.slotsByDay?.length) {
              <div class="results-list">
                @for (dayGroup of displayedSlotsByDay(); track dayGroup.date) {
                  <div class="day-group">
                    <div class="day-header">
                      <span class="day-date">{{ formatDate(dayGroup.date) }}</span>
                      <span class="day-weekday">{{ getWeekday(dayGroup.date) }}</span>
                      <span class="slot-count">{{ dayGroup.slots.length }} Slots</span>
                    </div>
                    <div class="slots-grid" [class.grouped]="collapseGroups()">
                      @if (!collapseGroups()) {
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
                      } @else {
                        @for (group of getGroupsForDay(dayGroup.slots); track group.therapistId) {
                          <div class="group-card" [class.selected]="isGroupSelected(dayGroup.date, group.therapistId) || isGroupExpanded(dayGroup.date, group.therapistId)" (click)="toggleGroupSelection(dayGroup.date, group.therapistId, group.slots)" style="display:flex;align-items:center;gap:0.5rem;background:#fff;padding:0.4rem;border-radius:6px;border:1px solid #E5E7EB;cursor:pointer;">
                            <div style="flex:1;display:flex;flex-direction:column;">
                              <div style="font-weight:600" class="group-therapist-name">{{ group.therapistName }}</div>
                              <div style="font-size:0.75rem;color:#6B7280">{{ group.slots.length }} Slot(s)</div>
                            </div>
                            <div style="display:flex;gap:0.5rem;align-items:center;">
                              <button class="btn-sm" (click)="$event.stopPropagation(); toggleExpandedGroup(dayGroup.date, group.therapistId)">{{ isGroupExpanded(dayGroup.date, group.therapistId) ? 'Verbergen' : 'Anzeigen' }}</button>
                            </div>
                          </div>
                          @if (isGroupExpanded(dayGroup.date, group.therapistId)) {
                            <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.5rem;">
                              @for (s of group.slots; track s.startTime) {
                                <button class="slot-btn" [class.selected]="isSlotSelected(s)" (click)="selectSlot(s)">
                                  <span class="slot-time">{{ formatTime(s.startTime) }}</span>
                                  <span class="slot-therapist">{{ s.therapistName }}</span>
                                </button>
                              }
                            </div>
                          }
                        }
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

        <!-- Selected Slots Action (multi-select) -->
        @if (selectedSlotsArray().length > 0) {
          <div class="selected-slot-action">
            <div class="selected-slot-info">
              <strong>{{ selectedSlotsArray().length }} Slots ausgewählt</strong>
              <div style="font-size:0.85rem;color:#374151">Patient: <strong>{{ selectedPatient()?.fullName }}</strong></div>
              @for (s of selectedSlotsArray(); track s.startTime) {
                <span class="selected-slot-item">{{ formatDate(s.date) }} · {{ formatTimeFull(s.startTime) }}–{{ formatTimeFull(s.endTime) }} · {{ s.therapistName }}</span>
              }
            </div>
            <button
              class="btn-book"
              (click)="bookSelectedSlots()"
              [disabled]="booking() || !selectedPatient()">
              @if (booking()) {
                <span class="spinner"></span>
              } @else {
                ✓ Termine buchen ({{ selectedSlotsArray().length }})
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
      min-height: 0; /* allow inner scrolling in flex layout */
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
      min-height: 0; /* important for flex children to allow scrolling */
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

    /* Time-range scroller */
    .time-range-scroller { display: flex; gap: 0.5rem; overflow-x: auto; padding: 0.5rem 0 0 0; }
    .time-range-chip { padding: 0.35rem 0.6rem; border-radius: 9999px; border: 1px solid #E5E7EB; background: white; cursor: pointer; font-size: 0.75rem; color: #374151; white-space: nowrap; }
    .time-range-chip.active { background: #2563EB; color: white; border-color: #2563EB; }

    /* Therapist chips */
    .therapist-scroller { display:flex; gap:0.5rem; overflow-x:auto; padding-top:0.35rem; }
    .therapist-chip { padding: 0.35rem 0.6rem; border-radius: 9999px; border: 1px solid #E5E7EB; background: white; cursor: pointer; font-size: 0.78rem; color: #374151; white-space: nowrap; }
    .therapist-chip.active { background: #2563EB; color: white; border-color: #2563EB; }
    .therapist-chip:first-child { min-width: 110px; }
    .therapist-scroller::-webkit-scrollbar { height: 8px; }
    .therapist-scroller::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 6px; }

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

    /* Small white buttons used across the finder (slim, white) */
    .btn-sm {
      padding: 0.25rem 0.5rem;
      background: white;
      border: 1px solid #E5E7EB;
      color: #374151;
      border-radius: 6px;
      font-size: 0.72rem;
      cursor: pointer;
      min-width: 64px;
    }
    .btn-sm:hover { background: #F8FAFC; border-color: #E6F0FF; }

    /* reset button: transparent only X */
    .btn-reset { background: transparent; border: none; color: #374151; font-size: 1rem; padding: 0.15rem 0.35rem; cursor: pointer; }
    .btn-reset:hover { background: rgba(0,0,0,0.04); border-radius: 6px; }

    /* Group card selected state (more visible blue highlight) */
    .group-card.selected { background: #DBEAFE; border-color: #2563EB; box-shadow: 0 1px 0 rgba(37,99,235,0.06); }
    .group-card.selected .group-therapist-name { color: #2563EB; font-weight:600; }

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

    /* Grouped (collapsed) layout: rows per therapist, full width */
    .slots-grid.grouped {
      flex-direction: column;
      gap: 0.5rem;
    }
    .slots-grid.grouped .group-card {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem;
    }
    .slots-grid.grouped .group-card + .group-card { margin-top: 0.25rem; }
    .slots-grid.grouped .group-card .group-therapist-name { font-size: 0.95rem; }
    .slots-grid.grouped .group-card .slot-btn { margin-left: 0.5rem; }


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
      max-height: 160px;
      overflow-y: auto;
    }

    .selected-slot-item {
      display: block;
      padding: 0.15rem 0;
      color: #064E3B;
      font-size: 0.82rem;
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
export class AppointmentFinderComponent implements OnInit, OnDestroy, OnChanges {
  @Input() initialPatientId: number | null = null;
  @Input() initialTherapistId: number | null = null;
  @Output() reset = new EventEmitter<void>();


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
  // multi-select support for slots
  selectedSlots = signal<Map<string, SlotDTO>>(new Map());
  selectedSlotsArray = computed(() => Array.from(this.selectedSlots().values()));
  expandedDays = signal<Set<string>>(new Set());

  searching = signal(false);
  booking = signal(false);
  hasSearched = signal(false);
  searchResponse = signal<SlotSearchResponse | null>(null);

  totalSlots = computed(() => this.searchResponse()?.totalSlotsFound ?? 0);

  patientSearchQuery = '';

  form: SearchForm = {
    patientId: null,
    therapistIds: [],
    durationMinutes: 20,
    dayParts: [],
    rangeFrom: this.getDefaultFromDate(),
    rangeTo: this.getDefaultToDate()
  };

  // Result / UI helpers
  // collapse grouped slots (group by therapist) — default: collapsed
  collapseGroups = signal(true);
  expandedGroupKeys = signal<Set<string>>(new Set());

  // filter results by therapist (signal so computed/DOM update in real-time)
  resultTherapistFilter = signal<number | null>(null);

  // derived list of therapists to show in the result dropdown — when the user
  // selected specific therapists in the search form, only show those here
  visibleResultTherapists = computed(() => {
    const sel = this.form.therapistIds || [];
    return sel.length === 0 ? this.therapists() : this.therapists().filter(t => sel.includes(t.id));
  });


  ngOnInit(): void {
    this.loadInitialData();
    this.setupPatientSearch();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // apply presets when inputs change
    if (changes['initialPatientId'] || changes['initialTherapistId']) {
      this.applyInitialSelections();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Apply input-based presets to the internal form (if data already loaded)
   */
  private applyInitialSelections(): void {
    // Therapist preset — set single-selection into the therapistIds array
    if (this.initialTherapistId != null && this.therapists().length > 0) {
      const t = this.therapists().find(x => x.id === this.initialTherapistId);
      if (t) {
        this.form.therapistIds = [t.id];
      }
    }

    // Patient preset
    if (this.initialPatientId != null && this.patients().length > 0) {
      const p = this.patients().find(x => x.id === this.initialPatientId);
      if (p) {
        this.selectPatient(p);
      }
    }
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
          // apply any initial presets passed in via inputs
          this.applyInitialSelections();
          // restore previously persisted finder state (if any)
          this.loadFinderState();
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
    this.saveFinderState();
  }

  clearPatient(): void {
    this.selectedPatient.set(null);
    this.form.patientId = null;
    this.patientSearchQuery = '';
    this.saveFinderState();
  }

  // Therapist multi-select helpers
  toggleTherapist(therapistId: number): void {
    const ids = [...(this.form.therapistIds || [])];
    const idx = ids.indexOf(therapistId);
    if (idx === -1) ids.push(therapistId); else ids.splice(idx, 1);
    this.form.therapistIds = ids;
    this.saveFinderState();
  }

  clearTherapistSelection(): void {
    this.form.therapistIds = [];
    this.saveFinderState();
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
    this.saveFinderState();
  }

  canSearch(): boolean {
    return !!this.form.rangeFrom && !!this.form.rangeTo && this.form.durationMinutes > 0;
  }

  private getHolidaysFromLocalStorage(): string[] {
    try {
      const raw = localStorage.getItem('physio_holidays');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<{ date: string }>; // date stored as YYYY-MM-DD
      return parsed.map(p => p.date);
    } catch (e) {
      return [];
    }
  }


  searchSlots(): void {
    if (!this.canSearch()) return;

    this.searching.set(true);
    this.hasSearched.set(false);
    // clear any previous selections when a new search runs
    this.selectedSlots.set(new Map());
    this.expandedDays.set(new Set());

    const baseRequest: Omit<SlotSearchRequest, 'therapistId'> = {
      rangeFrom: this.form.rangeFrom,
      rangeTo: this.form.rangeTo,
      durationMinutes: this.form.durationMinutes,
      dayParts: this.form.dayParts.length > 0 ? this.form.dayParts : undefined,
      excludePatientId: this.form.patientId ?? undefined
    };

    const therapistIds = this.form.therapistIds || [];

    const finalizeAndSet = (response: SlotSearchResponse) => {
      // always filter out holidays (client-side) as requested
      const holidays = this.getHolidaysFromLocalStorage();
      if (holidays && holidays.length > 0 && response?.slotsByDay) {
        response.slotsByDay = response.slotsByDay.filter(g => !holidays.includes(g.date));
        response.totalSlotsFound = response.slotsByDay.reduce((s, g) => s + (g.slots?.length || 0), 0);
      }
      this.searchResponse.set(response || { slotsByDay: [], totalSlotsFound: 0 });
      this.hasSearched.set(true);
      // persist finder state so closing/opening preserves the last search
      this.saveFinderState();
    };

    // if multiple therapists selected -> call backend per therapist and merge results
    if (therapistIds.length > 1) {
      const calls = therapistIds.map(id => this.slotSearchService.searchSlots({ ...baseRequest, therapistId: id }));
      forkJoin(calls).pipe(
        finalize(() => this.searching.set(false)),
        takeUntil(this.destroy$)
      ).subscribe({
        next: (responses) => {
          const map = new Map<string, SlotDTO[]>();
          for (const resp of responses) {
            (resp.slotsByDay || []).forEach(g => {
              const list = map.get(g.date) || [];
              list.push(...(g.slots || []));
              map.set(g.date, list);
            });
          }
          const merged: SlotSearchResponse = {
            slotsByDay: Array.from(map.entries()).map(([date, slots]) => ({ date, slots: slots.sort((a,b)=>a.startTime.localeCompare(b.startTime)) })),
            totalSlotsFound: Array.from(map.values()).reduce((s, arr) => s + arr.length, 0)
          };
          finalizeAndSet(merged);
        },
        error: (err) => {
          console.error('Slot search error (multi):', err);
          this.toastService.error('Fehler bei der Terminsuche');
          this.hasSearched.set(true);
          this.searchResponse.set({ slotsByDay: [], totalSlotsFound: 0 });
        }
      });
      return;
    }

    // single therapist or "any"
    const request: SlotSearchRequest = { ...(baseRequest as SlotSearchRequest), therapistId: therapistIds.length === 1 ? therapistIds[0] : undefined };
    this.slotSearchService.searchSlots(request)
      .pipe(
        finalize(() => this.searching.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => finalizeAndSet(response),
        error: (err) => {
          console.error('Slot search error:', err);
          this.toastService.error('Fehler bei der Terminsuche');
          this.hasSearched.set(true);
          this.searchResponse.set({ slotsByDay: [], totalSlotsFound: 0 });
        }
      });
  }



  // helper to key slots for multi-select
  getSlotKey(slot: SlotDTO): string { return `${slot.date}|${slot.startTime}|${slot.therapistId}`; }

  selectSlot(slot: SlotDTO): void {
    const key = this.getSlotKey(slot);
    const map = new Map(this.selectedSlots());
    if (map.has(key)) {
      map.delete(key);
    } else {
      map.set(key, slot);
    }
    this.selectedSlots.set(map);
    this.saveFinderState();
  }

  isSlotSelected(slot: SlotDTO): boolean {
    return this.selectedSlots().has(this.getSlotKey(slot));
  }

  expandDay(date: string): void {
    const expanded = new Set(this.expandedDays());
    expanded.add(date);
    this.expandedDays.set(expanded);
  }

  /** Toggle collapse / expand for grouped display */
  toggleCollapseGroups(): void {
    this.collapseGroups.set(!this.collapseGroups());
  }

  /**
   * Group slots by therapist for the collapsed/grouped view.
   * Returns array of { therapistId, therapistName, slots }
   */
  getGroupsForDay(slots: SlotDTO[]): Array<{ therapistId: number; therapistName: string; slots: SlotDTO[] }> {
    const map = new Map<number, { therapistName: string; slots: SlotDTO[] }>();
    for (const s of slots) {
      const id = Number(s.therapistId);
      const entry = map.get(id) || { therapistName: s.therapistName, slots: [] };
      entry.slots.push(s);
      map.set(id, entry);
    }
    return Array.from(map.entries()).map(([therapistId, v]) => ({ therapistId, therapistName: v.therapistName, slots: v.slots }));
  }

  /** Toggle per-day+therapist expanded group */
  toggleExpandedGroup(date: string, therapistId: number): void {
    const key = `${date}|${therapistId}`;
    const set = new Set(this.expandedGroupKeys());
    if (set.has(key)) set.delete(key); else set.add(key);
    this.expandedGroupKeys.set(set);
    this.saveFinderState();
  }

  isGroupExpanded(date: string, therapistId: number): boolean {
    return this.expandedGroupKeys().has(`${date}|${therapistId}`);
  }

  /** Toggle selection of all slots in a grouped card */
  toggleGroupSelection(date: string, therapistId: number, slots: SlotDTO[]): void {
    const map = new Map(this.selectedSlots());
    const keys = slots.map(s => this.getSlotKey(s));
    const allSelected = keys.every(k => map.has(k));
    if (allSelected) {
      keys.forEach(k => map.delete(k));
    } else {
      // add all (preserve existing)
      slots.forEach(s => {
        map.set(this.getSlotKey(s), s);
      });
    }
    this.selectedSlots.set(map);
    this.saveFinderState();
  }

  isGroupSelected(date: string, therapistId: number): boolean {
    const resp = this.searchResponse();
    if (!resp || !resp.slotsByDay) return false;
    const day = resp.slotsByDay.find(d => d.date === date);
    if (!day) return false;
    const groupSlots = day.slots.filter(s => s.therapistId === therapistId);
    return groupSlots.some(s => this.isSlotSelected(s));
  }

  bookAppointment(): void {
    const slot = this.selectedSlotsArray().length === 1 ? this.selectedSlotsArray()[0] : null;
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
            // reset finder state on successful booking
            this.clearFinderState();
            // Re-search to update available slots (fresh state)
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

  /** Persist current finder state to localStorage */
  private saveFinderState(): void {
    try {
      const state: any = {
        form: {
          patientId: this.form.patientId,
          therapistIds: this.form.therapistIds,
          durationMinutes: this.form.durationMinutes,
          dayParts: this.form.dayParts,
          rangeFrom: this.form.rangeFrom,
          rangeTo: this.form.rangeTo
        },
        resultTherapistFilter: this.resultTherapistFilter(),
        timeRangeFilters: this.timeRangeFilters(),
        collapseGroups: this.collapseGroups(),
        expandedGroupKeys: Array.from(this.expandedGroupKeys()),
        searchResponse: this.searchResponse(),
        selectedSlots: Array.from(this.selectedSlots().keys()),
        selectedPatientId: this.selectedPatient()?.id ?? null
      };
      localStorage.setItem('physio_terminfinder_state', JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save finder state', e);
    }
  }

  /** Load persisted state (if any) — called after initial data loaded */
  private loadFinderState(): void {
    try {
      const raw = localStorage.getItem('physio_terminfinder_state');
      if (!raw) return;
      const state = JSON.parse(raw);

      // restore form fields if present
      if (state.form) {
        this.form = { ...this.form, ...state.form };
      }

      if (state.resultTherapistFilter != null) this.resultTherapistFilter.set(state.resultTherapistFilter);
      if (state.timeRangeFilters) this.timeRangeFilters.set(state.timeRangeFilters);
      if (state.collapseGroups != null) this.collapseGroups.set(state.collapseGroups);
      if (state.expandedGroupKeys) this.expandedGroupKeys.set(new Set(state.expandedGroupKeys));

      if (state.searchResponse) {
        this.searchResponse.set(state.searchResponse);
        this.hasSearched.set(true);
      }

      // restore selected slots by matching keys against restored searchResponse
      const map = new Map<string, SlotDTO>();
      if (state.selectedSlots && this.searchResponse()) {
        const resp = this.searchResponse()!;
        for (const k of state.selectedSlots) {
          const [date, startTime, therapistIdStr] = k.split('|');
          const tid = Number(therapistIdStr);
          const day = resp.slotsByDay?.find(d => d.date === date);
          const found = day?.slots.find(s => s.startTime === startTime && s.therapistId === tid);
          if (found) map.set(k, found);
        }
      }
      this.selectedSlots.set(map);

      // restore selected patient if available
      if (state.selectedPatientId && this.patients().length > 0) {
        const p = this.patients().find(x => x.id === state.selectedPatientId);
        if (p) this.selectedPatient.set(p);
      }
    } catch (e) {
      console.warn('Could not load finder state', e);
    }
  }

  /** Clear persisted finder state and reset UI */
  private clearFinderState(): void {
    localStorage.removeItem('physio_terminfinder_state');
    // reset to defaults
    this.form = {
      patientId: null,
      therapistIds: [],
      durationMinutes: 20,
      dayParts: [],
      rangeFrom: this.getDefaultFromDate(),
      rangeTo: this.getDefaultToDate()
    };
    this.selectedSlots.set(new Map());
    this.selectedPatient.set(null);
    this.searchResponse.set(null);
    this.hasSearched.set(false);
    this.timeRangeFilters.set([]);
    this.collapseGroups.set(false);
    this.expandedDays.set(new Set());
    this.expandedGroupKeys.set(new Set());
    this.resultTherapistFilter.set(null);
  }

  /** Explicit reset action (X) exposed in UI */
  resetFinder(): void {
    this.clearFinderState();
    // notify parent (dashboard/modal) so modal can be closed if open
    try { this.reset.emit(); } catch (e) { /* ignore */ }
  }

  private getDefaultToDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30); // 1 month ahead
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
    return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}`;
  }

  /**
   * Full time formatting used in detailed summaries (keeps same HH:mm representation)
   */
  formatTimeFull(time: string): string {
    return this.formatTime(time);
  }

  private normalizeTime(time: string): string {
    const parts = time.split(':');
    if (parts.length === 2) {
      return `${parts[0]}:${parts[1]}:00`;
    }
    return time;
  }

  // Return selected therapist name (used in template) - avoids using arrow functions in template
  getSelectedTherapistName(): string | null {
    const ids = this.form.therapistIds || [];
    if (!ids || ids.length !== 1) return null;
    const id = ids[0];
    const t = this.therapists().find(th => th.id === id);
    return t?.fullName ?? null;
  }

  /* ----------------- Time-range filters & multi-select helpers ----------------- */
  // client-side selected time-range chips (more granular than backend dayParts)
  // client-side selected time-range chips (more granular than backend dayParts)
  timeRangeFilters = signal<string[]>([]);

  isTimeRangeSelected(rangeId: string): boolean {
    return this.timeRangeFilters().includes(rangeId);
  }

  toggleTimeRange(rangeId: string): void {
    const current = this.timeRangeFilters();

    if (rangeId === 'ALL') {
      this.timeRangeFilters.set([]);
      // 'ALL' means no dayParts restriction
      this.form.dayParts = [];
      this.saveFinderState();
      return;
    }

    const idx = current.indexOf(rangeId);
    if (idx === -1) {
      this.timeRangeFilters.set([...current, rangeId]);
    } else {
      this.timeRangeFilters.set(current.filter(r => r !== rangeId));
    }

    // Map selected ranges to coarse backend dayParts (if user hasn't selected them explicitly)
    const mapped: Set<DayPart> = new Set(this.form.dayParts || []);
    const updated = this.timeRangeFilters();
    if (updated.some(r => r.startsWith('MORNING') || r === 'VORMITTAGS')) mapped.add('MORNING');
    if (updated.some(r => r.startsWith('AFTERNOON'))) mapped.add('AFTERNOON');
    if (updated.some(r => r === 'EVENING')) mapped.add('EVENING');

    this.form.dayParts = Array.from(mapped);
    this.saveFinderState();
  }

  // compute displayed slots by applying client-side time-range filters
  displayedSlotsByDay = computed(() => {
    const resp = this.searchResponse();
    if (!resp || !resp.slotsByDay) return [];

    // If no specific time-range filters are active, start from full list
    const trFilters = this.timeRangeFilters();
    const useFullDay = trFilters.length === 0 || trFilters.includes('ALL');

    const ranges = trFilters.map(r => {
      switch (r) {
        case 'MORNING1': return { from: 6 * 60, to: 9 * 60 };
        case 'VORMITTAGS': return { from: 9 * 60, to: 12 * 60 };
        case 'AFTERNOON1': return { from: 12 * 60, to: 15 * 60 };
        case 'AFTERNOON2': return { from: 15 * 60, to: 17 * 60 };
        case 'EVENING': return { from: 19 * 60 + 30, to: 21 * 60 };
        default: return { from: 0, to: 24 * 60 };
      }
    });

    const matchesRange = (time: string) => {
      if (useFullDay) return true;
      const parts = time.split(':');
      const minutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      return ranges.some(r => minutes >= r.from && minutes < r.to);
    };

    // Determine which therapists are allowed by current UI filters:
    // 1) explicit result filter (single therapist) takes precedence
    // 2) otherwise, if the search form selected therapists, restrict to those
    // 3) else, allow all
    const explicit = this.resultTherapistFilter();
    const selected = this.form.therapistIds || [];
    const allowedTherapistIds: number[] | null = explicit != null ? [explicit] : (selected.length > 0 ? selected : null);

    return resp.slotsByDay
      .map(day => ({ date: day.date, slots: day.slots.filter(s => matchesRange(s.startTime) && (allowedTherapistIds == null || allowedTherapistIds.includes(s.therapistId))) }))
      .filter(d => d.slots.length > 0);
  });

  // Book all selected slots (multi-book)
  bookSelectedSlots(): void {
    const patient = this.selectedPatient();
    const slots = this.selectedSlotsArray();
    if (!patient || slots.length === 0) {
      this.toastService.error('Bitte Patient auswählen und mindestens einen Slot markieren');
      return;
    }

    this.booking.set(true);

    const requests = slots.map(s => {
      const req: CreateAppointmentRequest = {
        therapistId: s.therapistId,
        patientId: patient.id,
        date: `${s.date}T00:00:00.000Z`,
        startTime: `${s.date}T${this.normalizeTime(s.startTime)}`,
        endTime: `${s.date}T${this.normalizeTime(s.endTime)}`
      };
      return this.appointmentService.create(req).pipe(catchError(err => of({ saved: false, error: err })));
    });

    forkJoin(requests).pipe(finalize(() => this.booking.set(false))).subscribe((results: any[]) => {
      const saved = results.filter(r => r && r.saved).length;
      const failed = results.length - saved;
      if (saved > 0) this.toastService.success(`${saved} Termin(e) erfolgreich gebucht`);
      if (failed > 0) this.toastService.error(`${failed} Termin(e) konnten nicht gebucht werden`);
      // clear selections and refresh slots
      if (saved > 0) {
        // reset finder state only when appointments were actually created
        this.clearFinderState();
      }
      this.selectedSlots.set(new Map());
      this.searchSlots();
    }, (err) => {
      console.error('Multi-book error', err);
      this.toastService.error('Fehler beim Buchen der Termine');
      this.booking.set(false);
    });
  }
}
