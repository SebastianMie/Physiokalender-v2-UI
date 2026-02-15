import { Component, OnInit, Input, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { AppointmentService, Appointment, MoveAppointmentRequest, CreateAppointmentRequest } from '../../data-access/api/appointment.service';
import { AppointmentSeriesService, CreateAppointmentSeriesRequest } from '../../data-access/api/appointment-series.service';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { PatientService, Patient, CreatePatientRequest } from '../../data-access/api/patient.service';
import { ToastService } from '../../core/services/toast.service';
import { AppointmentCacheService } from '../../core/services/appointment-cache.service';
import { PracticeSettingsService } from '../../core/services/practice-settings.service';
import { PrintService, PrintableAppointment } from '../../core/services/print.service';

interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
}

interface TherapistColumn {
  therapist: Therapist;
  appointments: Appointment[];
}

interface NewAppointmentForm {
  therapistId: number | null;
  patientId: number | null;
  date: string;
  startTime: string;
  endTime: string;
  comment: string;
  isHotair: boolean;
  isUltrasonic: boolean;
  isElectric: boolean;
  isSeries: boolean;
  seriesEndDate: string;
  weeklyFrequency: number;
  weekday: string;
}

interface NewPatientForm {
  firstName: string;
  lastName: string;
  email: string;
  telefon: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  isBWO: boolean;
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
          <button class="nav-btn" (click)="previousDay()">&#8249;</button>
          <button class="today-btn" (click)="goToToday()">Heute</button>
          <button class="nav-btn" (click)="nextDay()">&#8250;</button>
          <input type="date" [value]="selectedDateStr()" (change)="onDateChange($event)" class="date-input" />
        </div>
        <h1>{{ formattedDate() }}</h1>
        <div class="view-options">
          <span class="appointments-count">{{ totalAppointments() }} Termine</span>
          @if (!embedded) {
            <div class="view-toggle">
              <button class="toggle-btn" [class.active]="viewMode() === 'all'" (click)="setViewMode('all')">Alle Therapeuten</button>
              <button class="toggle-btn" [class.active]="viewMode() === 'single'" (click)="setViewMode('single')">Einzelansicht</button>
            </div>
            @if (viewMode() === 'single') {
              <select class="therapist-select" [ngModel]="selectedTherapistId()" (ngModelChange)="selectTherapistById($event)">
                @for (t of therapists(); track t.id) {
                  <option [ngValue]="t.id">{{ t.fullName }}</option>
                }
              </select>
            }
          }
          <button class="btn-create" (click)="openCreateDialog()">+ Neuer Termin</button>
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
              <div class="time-slot" [style.height.px]="slotHeight"
                [class.hour-slot]="slot.minute === 0"
                [class.half-slot]="slot.minute === 30">
                @if (slot.minute === 0 || slot.minute === 30) {
                  <span class="time-label">{{ slot.time }}</span>
                }
              </div>
            }
          </div>

          <!-- Therapist Columns -->
          @for (col of visibleColumns(); track col.therapist.id) {
            <div class="therapist-column">
              <div class="therapist-header">
                <a [routerLink]="['/dashboard/therapists', col.therapist.id]" class="therapist-name">
                  {{ col.therapist.fullName }}
                </a>
                <div class="header-actions">
                  <span class="apt-count">{{ col.appointments.length }}</span>
                  <button class="btn-add-small" (click)="openCreateDialogForTherapist(col.therapist)" title="Termin hinzufuegen">+</button>
                </div>
              </div>
              <div
                class="appointments-container"
                [style.min-height.px]="totalSlots * slotHeight"
                cdkDropList
                cdkDropListSortingDisabled
                [cdkDropListData]="col.appointments"
                [id]="'therapist-' + col.therapist.id"
                [cdkDropListConnectedTo]="connectedDropLists()"
                (cdkDropListDropped)="onDrop($event, col.therapist.id)"
                (click)="onTimeSlotClick($event, col.therapist)">

                <!-- Grid lines -->
                @for (slot of timeSlots; track slot.time) {
                  <div class="grid-line" [style.top.px]="getSlotOffset(slot)"
                    [class.hour-line]="slot.minute === 0"
                    [class.half-line]="slot.minute === 30"></div>
                }

                @for (apt of col.appointments; track apt.id) {
                  <div
                    class="appointment-card"
                    cdkDrag
                    [cdkDragData]="apt"
                    [style.top.px]="getAppointmentTop(apt)"
                    [style.height.px]="getAppointmentHeight(apt)"
                    [class.small-card]="getAppointmentHeight(apt) <= 32"
                    [class.cancelled]="apt.status === 'CANCELLED'"
                    [class.completed]="apt.status === 'COMPLETED'"
                    [class.bwo]="apt.isBWO"
                    [class.series]="apt.createdBySeriesAppointment"
                    [class.hotair-card]="apt.isHotair && !apt.isUltrasonic && !apt.isElectric"
                    [class.ultra-card]="apt.isUltrasonic && !apt.isHotair && !apt.isElectric"
                    [class.electro-card]="apt.isElectric && !apt.isHotair && !apt.isUltrasonic"
                    [class.multi-treatment]="(apt.isHotair ? 1 : 0) + (apt.isUltrasonic ? 1 : 0) + (apt.isElectric ? 1 : 0) > 1"
                    (click)="openEditDialog(apt); $event.stopPropagation()">

                    <div class="apt-patient-name">{{ apt.patientName || 'Kein Patient' }}</div>
                    <div class="apt-time">{{ formatTime(apt.startTime) }} - {{ formatTime(apt.endTime) }}</div>
                    @if (apt.comment) {
                      <div class="apt-comment">{{ apt.comment }}</div>
                    }
                    <div class="apt-tags">
                      @if (apt.createdBySeriesAppointment) {
                        <span class="apt-tag series-tag">Serie</span>
                      }
                      @if (apt.isBWO) {
                        <span class="apt-tag bwo">BWO</span>
                      }
                      @if (apt.isHotair) {
                        <span class="apt-tag hotair">HL</span>
                      }
                      @if (apt.isUltrasonic) {
                        <span class="apt-tag ultra">US</span>
                      }
                      @if (apt.isElectric) {
                        <span class="apt-tag electro">ET</span>
                      }
                    </div>

                    <div class="drag-handle" cdkDragHandle>&#8942;&#8942;</div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Create/Edit Appointment Modal -->
      @if (showCreateModal()) {
        <div class="modal-overlay" (click)="closeCreateModal()">
          <div class="modal modal-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ editingAppointment() ? 'Termin bearbeiten' : (newAppointment.isSeries ? 'Neuen Serientermin anlegen' : 'Neuen Termin anlegen') }}</h2>
              <button class="btn-close" (click)="closeCreateModal()">&times;</button>
            </div>
            <form (ngSubmit)="saveAppointment()">
              <!-- Termin-Typ Toggle (nur im Erstellen-Modus) -->
              @if (!editingAppointment()) {
                <div class="type-toggle-row">
                  <button type="button" class="type-btn" [class.active]="!newAppointment.isSeries" (click)="newAppointment.isSeries = false">
                    Einzeltermin
                  </button>
                  <button type="button" class="type-btn" [class.active]="newAppointment.isSeries" (click)="newAppointment.isSeries = true">
                    Serientermin
                  </button>
                </div>
              }

              <div class="form-grid">
                <!-- Therapeut -->
                <div class="form-group">
                  <label>Therapeut *</label>
                  <select [(ngModel)]="newAppointment.therapistId" name="therapistId" required>
                    <option [ngValue]="null" disabled>Therapeut w&auml;hlen...</option>
                    @for (t of therapists(); track t.id) {
                      <option [ngValue]="t.id">{{ t.fullName }}</option>
                    }
                  </select>
                </div>

                <!-- Patient -->
                <div class="form-group">
                  <label>Patient *</label>
                  <div class="patient-select-row">
                    <div class="patient-search-wrapper">
                      <input
                        type="text"
                        [(ngModel)]="patientSearchTerm"
                        name="patientSearch"
                        placeholder="Patient suchen..."
                        (input)="filterPatients()"
                        (focus)="onPatientFieldFocus()"
                        [class.patient-selected]="!!selectedPatient()"
                        [readonly]="!!selectedPatient()"
                        autocomplete="off" />
                      @if (selectedPatient()) {
                        <button type="button" class="input-clear-btn" (click)="clearPatient()">&times;</button>
                      }
                      @if (showPatientDropdown() && filteredPatients().length > 0 && !selectedPatient()) {
                        <div class="dropdown-list">
                          @for (p of filteredPatients(); track p.id) {
                            <div class="dropdown-item" (click)="selectPatient(p)">
                              <strong>{{ p.fullName }}</strong>
                              @if (p.telefon) { <span class="patient-info"> &ndash; {{ p.telefon }}</span> }
                              @if (p.isBWO) { <span class="badge-bwo">BWO</span> }
                            </div>
                          }
                        </div>
                      }
                      @if (showPatientDropdown() && patientSearchTerm.length > 1 && filteredPatients().length === 0 && !selectedPatient()) {
                        <div class="dropdown-list">
                          <div class="dropdown-item no-results">Kein Patient gefunden</div>
                        </div>
                      }
                    </div>
                    <button type="button" class="btn-new-patient" (click)="openNewPatientDialog()">+ Neu</button>
                  </div>
                </div>

                <!-- Datum (Startdatum bei Serie) -->
                <div class="form-group">
                  <label>{{ newAppointment.isSeries ? 'Startdatum *' : 'Datum *' }}</label>
                  <input type="date" [(ngModel)]="newAppointment.date" name="date" required />
                </div>

                <!-- Enddatum (nur bei Serie) -->
                @if (newAppointment.isSeries) {
                  <div class="form-group">
                    <label>Enddatum *</label>
                    <input type="date" [(ngModel)]="newAppointment.seriesEndDate" name="seriesEndDate" required [min]="newAppointment.date" />
                  </div>
                }

                <!-- Zeiten -->
                <div class="form-row">
                  <div class="form-group">
                    <label>Beginn *</label>
                    <div class="time-hpicker">
                      <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'start', 'hour')" title="Scrollen zum Ändern">{{ getHourFromTime(newAppointment.startTime) }}</span>
                      <span class="tp-colon">:</span>
                      <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'start', 'minute')" title="Scrollen zum Ändern">{{ getMinuteFromTime(newAppointment.startTime) }}</span>
                      <span class="tp-label">Uhr</span>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Ende *</label>
                    <div class="time-hpicker">
                      <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'end', 'hour')" title="Scrollen zum Ändern">{{ getHourFromTime(newAppointment.endTime) }}</span>
                      <span class="tp-colon">:</span>
                      <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'end', 'minute')" title="Scrollen zum Ändern">{{ getMinuteFromTime(newAppointment.endTime) }}</span>
                      <span class="tp-label">Uhr</span>
                    </div>
                  </div>
                </div>

                <!-- Serien-Optionen -->
                @if (newAppointment.isSeries) {
                  <div class="form-row">
                    <div class="form-group">
                      <label>Intervall *</label>
                      <select [(ngModel)]="newAppointment.weeklyFrequency" name="weeklyFrequency" required>
                        <option [ngValue]="1">Jede Woche</option>
                        <option [ngValue]="2">Alle 2 Wochen</option>
                        <option [ngValue]="3">Alle 3 Wochen</option>
                        <option [ngValue]="4">Alle 4 Wochen</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Wochentag *</label>
                      <select [(ngModel)]="newAppointment.weekday" name="weekday" required>
                        <option value="" disabled>W&auml;hlen...</option>
                        <option value="MONDAY">Montag</option>
                        <option value="TUESDAY">Dienstag</option>
                        <option value="WEDNESDAY">Mittwoch</option>
                        <option value="THURSDAY">Donnerstag</option>
                        <option value="FRIDAY">Freitag</option>
                      </select>
                    </div>
                  </div>
                }

                <!-- Optionen -->
                <div class="form-row checkboxes">
                  <label class="checkbox-label">
                    <input type="checkbox" [(ngModel)]="newAppointment.isHotair" name="isHotair" />
                    Hei&szlig;luft
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" [(ngModel)]="newAppointment.isUltrasonic" name="isUltrasonic" />
                    Ultraschall
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" [(ngModel)]="newAppointment.isElectric" name="isElectric" />
                    Elektrotherapie
                  </label>
                </div>

                <!-- Kommentar -->
                <div class="form-group full-width">
                  <label>Kommentar</label>
                  <textarea [(ngModel)]="newAppointment.comment" name="comment" rows="2" placeholder="Optionale Bemerkung..."></textarea>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closeCreateModal()">Abbrechen</button>
                @if (editingAppointment()) {
                  <button type="button" class="btn-delete-icon" title="Termin löschen" (click)="confirmDeleteAppointment()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                  <button type="button" class="btn-print-icon" title="Alle Termine des Patienten drucken" (click)="printPatientAppointments()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                  </button>
                }
                <div class="spacer"></div>
                <button type="submit" class="btn-primary"
                  [disabled]="!canSaveAppointment() || savingAppointment()">
                  {{ savingAppointment() ? 'Speichern...' : (editingAppointment() ? 'Speichern' : (newAppointment.isSeries ? 'Serie anlegen' : 'Termin anlegen')) }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Delete Appointment Confirmation Modal -->
      @if (showDeleteAppointmentModal()) {
        <div class="modal-overlay" (click)="cancelDeleteAppointment()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Termin löschen</h2>
              <button class="btn-close" (click)="cancelDeleteAppointment()">&times;</button>
            </div>
            <p>Möchten Sie diesen Termin wirklich löschen?</p>
            @if (editingAppointment(); as apt) {
              <div class="delete-info">
                <strong>{{ apt.patientName }}</strong><br>
                {{ apt.date | date:'dd.MM.yyyy' }} · {{ apt.startTime }} - {{ apt.endTime }}
              </div>
            }
            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="cancelDeleteAppointment()">Abbrechen</button>
              <button type="button" class="btn-danger" (click)="deleteAppointment()" [disabled]="deletingAppointment()">
                {{ deletingAppointment() ? 'Löschen...' : 'Löschen' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- New Patient Modal -->
      @if (showNewPatientModal()) {
        <div class="modal-overlay" (click)="closeNewPatientDialog()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Neuen Patienten anlegen</h2>
              <button class="btn-close" (click)="closeNewPatientDialog()">&times;</button>
            </div>
            <form (ngSubmit)="saveNewPatient()">
              <div class="form-grid">
                <div class="form-group">
                  <label>Vorname *</label>
                  <input type="text" [(ngModel)]="newPatient.firstName" name="pFirstName" required />
                </div>
                <div class="form-group">
                  <label>Nachname *</label>
                  <input type="text" [(ngModel)]="newPatient.lastName" name="pLastName" required />
                </div>
                <div class="form-group">
                  <label>Telefon</label>
                  <input type="tel" [(ngModel)]="newPatient.telefon" name="pTelefon" />
                </div>
                <div class="form-group">
                  <label>E-Mail</label>
                  <input type="email" [(ngModel)]="newPatient.email" name="pEmail" />
                </div>
                <div class="form-group">
                  <label>Stra&szlig;e</label>
                  <input type="text" [(ngModel)]="newPatient.street" name="pStreet" />
                </div>
                <div class="form-group">
                  <label>Hausnr.</label>
                  <input type="text" [(ngModel)]="newPatient.houseNumber" name="pHouseNumber" />
                </div>
                <div class="form-group">
                  <label>PLZ</label>
                  <input type="text" [(ngModel)]="newPatient.postalCode" name="pPostalCode" />
                </div>
                <div class="form-group">
                  <label>Ort</label>
                  <input type="text" [(ngModel)]="newPatient.city" name="pCity" />
                </div>
                <div class="form-group full-width">
                  <label class="checkbox-label">
                    <input type="checkbox" [(ngModel)]="newPatient.isBWO" name="pBWO" />
                    BWO (Behindertenwerkstatt Oberberg)
                  </label>
                </div>
              </div>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closeNewPatientDialog()">Abbrechen</button>
                <button type="submit" class="btn-primary"
                  [disabled]="!newPatient.firstName || !newPatient.lastName || savingPatient()">
                  {{ savingPatient() ? 'Speichern...' : 'Patient anlegen' }}
                </button>
              </div>
            </form>
          </div>
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
    .calendar-container { display: flex; flex-direction: column; height: 100%; background: white; }
    .calendar-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.5rem; border-bottom: 1px solid #E5E7EB; background: #F9FAFB; flex-wrap: wrap; gap: 0.5rem; }
    .date-navigation { display: flex; align-items: center; gap: 0.5rem; }
    .nav-btn, .today-btn { padding: 0.4rem 0.65rem; border: 1px solid #E5E7EB; background: white; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .nav-btn:hover, .today-btn:hover { background: #F3F4F6; }
    .date-input { padding: 0.4rem; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 0.8rem; }
    h1 { margin: 0; font-size: 1.125rem; color: #111827; white-space: nowrap; }
    .view-options { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .appointments-count { font-size: 0.8rem; color: #6B7280; }

    /* View toggle */
    .view-toggle { display: flex; border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; }
    .toggle-btn { padding: 0.35rem 0.75rem; border: none; background: white; cursor: pointer; font-size: 0.8rem; color: #6B7280; transition: all 0.15s; }
    .toggle-btn:not(:last-child) { border-right: 1px solid #E5E7EB; }
    .toggle-btn.active { background: #3B82F6; color: white; }
    .toggle-btn:hover:not(.active) { background: #F3F4F6; }
    .therapist-select { padding: 0.35rem 0.5rem; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 0.8rem; background: white; }

    .btn-create { padding: 0.4rem 0.85rem; border: none; background: #3B82F6; color: white; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500; }
    .btn-create:hover { background: #2563EB; }
    .loading { display: flex; align-items: center; justify-content: center; flex: 1; color: #6B7280; padding: 3rem; }
    .calendar-grid { display: flex; flex: 1; overflow: auto; }

    /* Time column */
    .time-column { width: 52px; flex-shrink: 0; border-right: 1px solid #E5E7EB; background: #F9FAFB; }
    .time-header { height: 40px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: #6B7280; font-weight: 500; border-bottom: 1px solid #E5E7EB; }
    .time-slot { display: flex; align-items: flex-start; justify-content: center; padding-top: 0; }
    .time-slot.hour-slot { border-top: 1px solid #D1D5DB; }
    .time-slot.half-slot { border-top: 1px solid #E5E7EB; }
    .time-label { font-size: 0.6rem; color: #9CA3AF; line-height: 1; margin-top: -1px; }
    .time-slot.hour-slot .time-label { color: #6B7280; font-weight: 500; font-size: 0.65rem; }

    /* Therapist columns */
    .therapist-column { flex: 1; min-width: 160px; border-right: 1px solid #E5E7EB; }
    .therapist-header { height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 0 0.5rem; border-bottom: 1px solid #E5E7EB; background: #F9FAFB; }
    .therapist-name { font-size: 0.8rem; font-weight: 500; color: #3B82F6; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .therapist-name:hover { text-decoration: underline; }
    .header-actions { display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0; }
    .apt-count { font-size: 0.7rem; color: #6B7280; background: #E5E7EB; padding: 0.1rem 0.4rem; border-radius: 10px; }
    .btn-add-small { width: 22px; height: 22px; border: 1px solid #D1D5DB; background: white; border-radius: 4px; cursor: pointer; font-size: 0.9rem; line-height: 1; color: #3B82F6; display: flex; align-items: center; justify-content: center; }
    .btn-add-small:hover { background: #EFF6FF; }

    /* Appointments container */
    .appointments-container { position: relative; cursor: pointer; }
    .grid-line { position: absolute; left: 0; right: 0; height: 1px; pointer-events: none; }
    .grid-line.hour-line { background: #D1D5DB; }
    .grid-line.half-line { background: #E5E7EB; }

    /* Appointment cards */
    .appointment-card { position: absolute; left: 3px; right: 3px; background: #EFF6FF; border-left: 3px solid #3B82F6; border-radius: 3px; padding: 0.2rem 0.4rem; font-size: 0.7rem; cursor: pointer; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: box-shadow 0.15s; z-index: 2; }
    .appointment-card:hover { box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 3; }
    .appointment-card.cdk-drag-dragging { cursor: grabbing; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10; }
    .appointment-card.cancelled { background: #FEE2E2; border-left-color: #DC2626; opacity: 0.6; }
    .appointment-card.completed { background: #D1FAE5; border-left-color: #059669; }
    .appointment-card.bwo { background: #FEF3C7; border-left-color: #D97706; }
    .appointment-card.hotair-card { background: #FEE2E2; border-left-color: #EF4444; }
    .appointment-card.ultra-card { background: #EDE9FE; border-left-color: #7C3AED; }
    .appointment-card.electro-card { background: #D1FAE5; border-left-color: #059669; }
    .appointment-card.multi-treatment { background: linear-gradient(135deg, #FEE2E2 0%, #EDE9FE 50%, #D1FAE5 100%); border-left-color: #6366F1; }
    .apt-patient-name { font-weight: 600; color: #111827; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
    .apt-time { color: #6B7280; font-size: 0.6rem; line-height: 1.1; }
    .apt-patient { color: #3B82F6; text-decoration: none; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.7rem; }
    .apt-patient:hover { text-decoration: underline; }
    .apt-comment { color: #6B7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.6rem; line-height: 1.1; }
    .apt-tags { display: flex; gap: 2px; flex-wrap: wrap; }

    /* Small card (≤20 min): compact display */
    .appointment-card.small-card { padding: 0.1rem 0.35rem; }
    .appointment-card.small-card .apt-patient-name { font-size: 0.6rem; line-height: 1.1; }
    .appointment-card.small-card .apt-time { display: none; }
    .appointment-card.small-card .apt-tags { display: none; }
    .appointment-card.small-card .drag-handle { display: none; }
    .appointment-card.small-card .apt-comment { font-size: 0.5rem; line-height: 1; }
    .apt-tag { display: inline-block; padding: 0 0.2rem; border-radius: 2px; font-size: 0.5rem; font-weight: 600; margin-right: 2px; }
    .apt-tag.bwo { background: #FBBF24; color: #713F12; }
    .apt-tag.hotair { background: #F87171; color: white; }
    .apt-tag.ultra { background: #818CF8; color: white; }
    .apt-tag.electro { background: #34D399; color: #064E3B; }
    .apt-tag.series-tag { background: #A78BFA; color: white; }
    .appointment-card.series { border-left-color: #7C3AED; }
    .drag-handle { position: absolute; top: 50%; right: 3px; transform: translateY(-50%); color: #9CA3AF; cursor: grab; font-size: 0.65rem; letter-spacing: -2px; }
    .cdk-drag-placeholder { background: #DBEAFE; border: 2px dashed #3B82F6; border-radius: 4px; }
    .cdk-drag-animating { transition: transform 250ms cubic-bezier(0,0,0.2,1); }

    /* Modal Styles */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; border-radius: 12px; padding: 1.5rem; max-width: 480px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal.modal-lg { max-width: 600px; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    .modal-header h2 { margin: 0; font-size: 1.25rem; color: #2563EB; }
    .btn-close { border: none; background: none; font-size: 1.5rem; cursor: pointer; color: #6B7280; padding: 0 0.25rem; }
    .btn-close:hover { color: #111827; }
    .modal h2 { margin: 0 0 1rem 0; color: #2563EB; }
    .modal ul { margin: 0.5rem 0; padding-left: 1.5rem; }
    .modal-actions { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #E5E7EB; }
    .spacer { flex: 1; }
    .btn-secondary { padding: 0.5rem 1rem; border: 1px solid #E5E7EB; background: white; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .btn-secondary:hover { background: #F3F4F6; }
    .btn-primary { padding: 0.5rem 1rem; border: none; background: #3B82F6; color: white; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .btn-primary:hover { background: #2563EB; }
    .btn-primary:disabled { background: #93C5FD; cursor: not-allowed; }
    .btn-delete-icon { border: none; background: none; color: #9CA3AF; cursor: pointer; padding: 0.25rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .btn-delete-icon:hover { color: #DC2626; background: #FEE2E2; }
    .btn-print-icon { border: none; background: none; color: #9CA3AF; cursor: pointer; padding: 0.25rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .btn-print-icon:hover { color: #F97316; background: #FFF7ED; }
    .btn-danger { padding: 0.5rem 1rem; border: none; background: #DC2626; color: white; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .btn-danger:hover { background: #B91C1C; }
    .btn-danger:disabled { background: #FCA5A5; cursor: not-allowed; }
    .delete-info { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0.75rem; margin: 1rem 0; font-size: 0.875rem; color: #374151; }

    /* Form Styles */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.25rem; }
    .form-group.full-width { grid-column: 1 / -1; }
    .form-group label { font-size: 0.8rem; font-weight: 500; color: #374151; }
    .form-group input, .form-group select, .form-group textarea { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; outline: none; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .form-row { grid-column: 1 / -1; display: flex; gap: 1rem; }
    .form-row .form-group { flex: 1; }
    .form-row.checkboxes { flex-wrap: wrap; gap: 1rem; }
    .checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #374151; cursor: pointer; }
    .checkbox-label input[type="checkbox"] { width: 16px; height: 16px; accent-color: #3B82F6; }

    /* Patient search */
    .patient-select-row { display: flex; gap: 0.5rem; }
    .patient-search-wrapper { flex: 1; position: relative; }
    .patient-search-wrapper input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; outline: none; box-sizing: border-box; }
    .patient-search-wrapper input:focus { border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .btn-new-patient { padding: 0.5rem 0.75rem; border: 1px solid #3B82F6; background: #EFF6FF; color: #3B82F6; border-radius: 6px; cursor: pointer; font-size: 0.8rem; white-space: nowrap; font-weight: 500; }
    .btn-new-patient:hover { background: #DBEAFE; }
    .dropdown-list { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #D1D5DB; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-top: 2px; }
    .dropdown-item { padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem; }
    .dropdown-item:hover { background: #F3F4F6; }
    .dropdown-item.no-results { color: #9CA3AF; cursor: default; }
    .dropdown-item.no-results:hover { background: white; }
    .patient-info { color: #6B7280; font-size: 0.75rem; }
    .badge-bwo { background: #FBBF24; color: #713F12; font-size: 0.625rem; padding: 0 0.375rem; border-radius: 3px; font-weight: 600; }
    .selected-patient-chip { display: inline-flex; align-items: center; gap: 0.5rem; background: #EFF6FF; border: 1px solid #BFDBFE; padding: 0.25rem 0.75rem; border-radius: 16px; font-size: 0.8rem; margin-top: 0.5rem; color: #1E40AF; }
    .chip-remove { border: none; background: none; cursor: pointer; font-size: 1rem; color: #6B7280; padding: 0; line-height: 1; }
    .chip-remove:hover { color: #DC2626; }

    /* Type toggle */
    .type-toggle-row { display: flex; gap: 0; margin-bottom: 1rem; border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; }
    .type-btn { flex: 1; padding: 0.3rem 0.75rem; border: none; background: #F9FAFB; cursor: pointer; font-size: 0.75rem; font-weight: 500; color: #9CA3AF; transition: all 0.15s; }
    .type-btn:first-child { border-right: 1px solid #E5E7EB; }
    .type-btn.active { background: #EFF6FF; color: #2563EB; }
    .type-btn:hover:not(.active) { background: #F3F4F6; color: #6B7280; }

    /* Scroll time picker */
    .time-hpicker { display: flex; align-items: center; gap: 0.15rem; background: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 8px; padding: 0.4rem 0.5rem; }
    .tp-value { font-size: 1.15rem; font-weight: 600; color: #111827; min-width: 32px; text-align: center; font-variant-numeric: tabular-nums; }
    .tp-scrollable { cursor: ns-resize; user-select: none; background: white; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0.2rem 0.35rem; transition: all 0.15s; }
    .tp-scrollable:hover { border-color: #3B82F6; background: #EFF6FF; color: #2563EB; box-shadow: 0 0 0 2px rgba(59,130,246,0.12); }
    .tp-colon { font-size: 1.1rem; font-weight: 700; color: #9CA3AF; margin: 0 0.1rem; }
    .tp-label { font-size: 0.75rem; color: #9CA3AF; font-weight: 500; margin-left: 0.2rem; }

    /* Patient input inline selection */
    .patient-search-wrapper input.patient-selected { color: #111827; font-weight: 500; background: #F0FFF4; border-color: #86EFAC; padding-right: 2rem; }
    .input-clear-btn { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; background: #E5E7EB; color: #6B7280; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; line-height: 1; }
    .input-clear-btn:hover { background: #FCA5A5; color: #991B1B; }
  `]
})
export class DailyListComponent implements OnInit {
  private appointmentService = inject(AppointmentService);
  private seriesService = inject(AppointmentSeriesService);
  private therapistService = inject(TherapistService);
  private patientService = inject(PatientService);
  private toastService = inject(ToastService);
  private appointmentCache = inject(AppointmentCacheService);
  private practiceSettings = inject(PracticeSettingsService);
  private printService = inject(PrintService);
  private route = inject(ActivatedRoute);

  /** When embedded (e.g. on dashboard), hide view toggle and default to 'all' */
  @Input() embedded = false;

  // State
  selectedDate = signal(new Date());
  loading = signal(true);
  therapists = signal<Therapist[]>([]);
  appointments = signal<Appointment[]>([]);
  viewMode = signal<'all' | 'single'>('all');
  selectedTherapistId = signal<number | null>(null);
  showConflictModal = signal(false);
  conflictInfo = signal<any>(null);
  pendingMove = signal<{ appointmentId: number; request: MoveAppointmentRequest } | null>(null);

  // Create appointment state
  showCreateModal = signal(false);
  showNewPatientModal = signal(false);
  savingAppointment = signal(false);
  savingPatient = signal(false);
  showDeleteAppointmentModal = signal(false);
  deletingAppointment = signal(false);
  selectedPatient = signal<Patient | null>(null);
  allPatients = signal<Patient[]>([]);
  filteredPatients = signal<Patient[]>([]);
  showPatientDropdown = signal(false);
  patientSearchTerm = '';
  editingAppointment = signal<Appointment | null>(null);

  newAppointment: NewAppointmentForm = {
    therapistId: null,
    patientId: null,
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    comment: '',
    isHotair: false,
    isUltrasonic: false,
    isElectric: false,
    isSeries: false,
    seriesEndDate: '',
    weeklyFrequency: 1,
    weekday: ''
  };
  newPatient: NewPatientForm = this.getEmptyPatientForm();

  // Configuration — 10-minute slots
  slotHeight = 16; // pixels per 10 minutes
  startHour = 7;
  endHour = 20;
  slotMinutes = 10;

  // Time options for select dropdowns (10-min steps, 07:00 – 20:00)
  timeOptions: string[] = [];

  // Time slots
  timeSlots: TimeSlot[] = [];
  totalSlots = 0;

  // Computed
  selectedDateStr = computed(() => this.selectedDate().toISOString().split('T')[0]);

  formattedDate = computed(() => {
    const date = this.selectedDate();
    const weekday = date.toLocaleDateString('de-DE', { weekday: 'long' });
    const formatted = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${weekday}, ${formatted}`;
  });

  totalAppointments = computed(() => {
    const apts = this.appointments();
    return apts.filter(a => a.status !== 'CANCELLED').length;
  });

  /** All therapist columns with their appointments */
  allColumns = computed<TherapistColumn[]>(() => {
    const therapists = this.therapists();
    const apts = this.appointments();
    return therapists.map(therapist => ({
      therapist,
      appointments: apts
        .filter(a => a.therapistId === therapist.id)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    }));
  });

  /** Visible columns based on view mode */
  visibleColumns = computed<TherapistColumn[]>(() => {
    const all = this.allColumns();
    if (this.viewMode() === 'single') {
      const id = this.selectedTherapistId();
      return all.filter(c => c.therapist.id === id);
    }
    return all;
  });

  connectedDropLists = computed(() => {
    return this.visibleColumns().map(c => 'therapist-' + c.therapist.id);
  });

  constructor() {
    // Generate 10-minute time slots from startHour to endHour
    for (let hour = this.startHour; hour < this.endHour; hour++) {
      for (let minute = 0; minute < 60; minute += this.slotMinutes) {
        const label = `${hour}:${minute.toString().padStart(2, '0')}`;
        this.timeSlots.push({ time: label, hour, minute });
      }
    }
    this.totalSlots = this.timeSlots.length;

    // Generate time options for select dropdowns (10-min steps)
    for (let hour = this.startHour; hour <= this.endHour; hour++) {
      const maxMin = hour === this.endHour ? 0 : 50;
      for (let minute = 0; minute <= maxMin; minute += this.slotMinutes) {
        this.timeOptions.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
  }

  ngOnInit(): void {
    // Handle query params (date + editId from appointment overview)
    this.route.queryParams.subscribe(params => {
      if (params['date']) {
        this.selectedDate.set(new Date(params['date']));
      }
      if (params['editId']) {
        this.pendingEditId = parseInt(params['editId'], 10);
      }
    });
    this.loadData();
  }

  private pendingEditId: number | null = null;

  loadData(): void {
    this.loading.set(true);

    this.therapistService.getAll().subscribe({
      next: (therapists) => {
        const active = therapists.filter(t => t.isActive);
        this.therapists.set(active);
        // Default to first therapist for single view
        if (active.length > 0 && !this.selectedTherapistId()) {
          this.selectedTherapistId.set(active[0].id);
        }
        this.loadAppointments();
      },
      error: () => {
        this.loading.set(false);
        this.toastService.show('Fehler beim Laden der Therapeuten', 'error');
      }
    });

    // Load patients for the create dialog
    this.patientService.getAll().subscribe({
      next: (patients) => this.allPatients.set(patients),
      error: () => {} // silently fail, will reload when dialog opens
    });
  }

  loadAppointments(): void {
    const dateStr = this.selectedDateStr();
    this.appointmentService.getByDate(dateStr).subscribe({
      next: (appointments) => {
        // Backend returns null/undefined on 204 No Content
        this.appointments.set(appointments || []);
        this.loading.set(false);
        // Auto-open edit dialog if navigated from overview
        if (this.pendingEditId) {
          const apt = (appointments || []).find(a => a.id === this.pendingEditId);
          if (apt) {
            setTimeout(() => this.openEditDialog(apt), 100);
          }
          this.pendingEditId = null;
        }
      },
      error: (err) => {
        // 204 No Content may also come as error
        if (err.status === 204) {
          this.appointments.set([]);
        }
        this.loading.set(false);
      }
    });
  }

  // ================== View Mode ==================

  setViewMode(mode: 'all' | 'single'): void {
    this.viewMode.set(mode);
  }

  selectTherapistById(id: number): void {
    this.selectedTherapistId.set(id);
  }

  // ================== Navigation ==================

  previousDay(): void {
    const date = new Date(this.selectedDate());
    date.setDate(date.getDate() - 1);
    // Skip closed days (go backwards)
    this.skipToOpenDay(date, -1);
    this.selectedDate.set(date);
    this.loadAppointments();
  }

  nextDay(): void {
    const date = new Date(this.selectedDate());
    date.setDate(date.getDate() + 1);
    // Skip closed days (go forward)
    this.skipToOpenDay(date, 1);
    this.selectedDate.set(date);
    this.loadAppointments();
  }

  goToToday(): void {
    const date = new Date();
    // Skip to next open day if today is closed
    this.skipToOpenDay(date, 1);
    this.selectedDate.set(date);
    this.loadAppointments();
  }

  /**
   * Skip to the next open day in the given direction.
   * Modifies the date in-place.
   * @param date The date to start from (will be modified)
   * @param direction 1 for forward, -1 for backward
   * @param maxIterations Maximum days to skip (default 7 to avoid infinite loop)
   */
  private skipToOpenDay(date: Date, direction: 1 | -1, maxIterations = 7): void {
    let iterations = 0;
    while (!this.practiceSettings.isDayOpen(date.getDay()) && iterations < maxIterations) {
      date.setDate(date.getDate() + direction);
      iterations++;
    }
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedDate.set(new Date(input.value));
    this.loadAppointments();
  }

  // ================== Position Helpers ==================

  getSlotOffset(slot: TimeSlot): number {
    const minutesFromStart = (slot.hour - this.startHour) * 60 + slot.minute;
    return (minutesFromStart / this.slotMinutes) * this.slotHeight;
  }

  getAppointmentTop(apt: Appointment): number {
    // startTime could be "2024-01-15T09:00:00" or "09:00:00"
    const timeStr = apt.startTime.includes('T') ? apt.startTime.split('T')[1] : apt.startTime;
    const parts = timeStr.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    const minutesFromStart = (hour - this.startHour) * 60 + minute;
    return (minutesFromStart / this.slotMinutes) * this.slotHeight;
  }

  getAppointmentHeight(apt: Appointment): number {
    const startStr = apt.startTime.includes('T') ? apt.startTime.split('T')[1] : apt.startTime;
    const endStr = apt.endTime.includes('T') ? apt.endTime.split('T')[1] : apt.endTime;
    const startParts = startStr.split(':');
    const endParts = endStr.split(':');
    const startMinutes = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
    const endMinutes = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
    const duration = endMinutes - startMinutes;
    return Math.max((duration / this.slotMinutes) * this.slotHeight - 2, 14);
  }

  formatTime(timeStr: string): string {
    if (timeStr.includes('T')) {
      return timeStr.split('T')[1].substring(0, 5);
    }
    return timeStr.substring(0, 5);
  }

  // ================== Create Appointment ==================

  openCreateDialog(): void {
    this.newAppointment = this.getEmptyAppointmentForm();
    this.newAppointment.date = this.selectedDateStr();
    this.selectedPatient.set(null);
    this.patientSearchTerm = '';
    this.showPatientDropdown.set(false);
    this.showCreateModal.set(true);
    // Reload patients
    this.patientService.getAll().subscribe({
      next: (patients) => this.allPatients.set(patients)
    });
  }

  openCreateDialogForTherapist(therapist: Therapist): void {
    this.openCreateDialog();
    this.newAppointment.therapistId = therapist.id;
  }

  onTimeSlotClick(event: MouseEvent, therapist: Therapist): void {
    const container = (event.currentTarget as HTMLElement);
    const rect = container.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const slotIndex = Math.floor(y / this.slotHeight);
    const totalMinutes = slotIndex * this.slotMinutes;
    const hour = this.startHour + Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    this.openCreateDialog();
    this.newAppointment.therapistId = therapist.id;
    this.newAppointment.startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    // Default 30 min duration
    const endTotalMin = totalMinutes + 30;
    const endHour = this.startHour + Math.floor(endTotalMin / 60);
    const endMinute = endTotalMin % 60;
    this.newAppointment.endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  }

  openEditDialog(apt: Appointment): void {
    this.editingAppointment.set(apt);
    this.newAppointment = this.getEmptyAppointmentForm();
    this.newAppointment.therapistId = apt.therapistId;
    this.newAppointment.patientId = apt.patientId;
    this.newAppointment.date = apt.date;
    this.newAppointment.startTime = this.formatTime(apt.startTime);
    this.newAppointment.endTime = this.formatTime(apt.endTime);
    this.newAppointment.comment = apt.comment || '';
    this.newAppointment.isHotair = apt.isHotair;
    this.newAppointment.isUltrasonic = apt.isUltrasonic;
    this.newAppointment.isElectric = apt.isElectric;
    this.newAppointment.isSeries = false;

    // Set the selected patient display
    const patient = this.allPatients().find(p => p.id === apt.patientId);
    this.selectedPatient.set(patient || null);
    this.patientSearchTerm = patient ? patient.fullName : '';
    this.showPatientDropdown.set(false);
    this.showCreateModal.set(true);

    // Reload patients
    this.patientService.getAll().subscribe({
      next: (patients) => {
        this.allPatients.set(patients);
        const p = patients.find(p => p.id === apt.patientId);
        if (p) this.selectedPatient.set(p);
      }
    });
  }

  // ================== Time Scroll Helpers ==================

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
    let current = this.newAppointment[prop];
    if (!current) current = `${this.startHour.toString().padStart(2, '0')}:00`;

    const parts = current.split(':');
    let h = parseInt(parts[0], 10) + delta;
    if (h < this.startHour) h = this.endHour;
    if (h > this.endHour) h = this.startHour;
    this.newAppointment[prop] = `${h.toString().padStart(2, '0')}:${parts[1]}`;
  }

  adjustMinute(which: 'start' | 'end', delta: number): void {
    const prop = which === 'start' ? 'startTime' : 'endTime';
    let current = this.newAppointment[prop];
    if (!current) current = `${this.startHour.toString().padStart(2, '0')}:00`;

    const parts = current.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10) + delta;

    if (m >= 60) { m = 0; h++; }
    if (m < 0) { m = 50; h--; }
    if (h > this.endHour) { h = this.startHour; }
    if (h < this.startHour) { h = this.endHour; }
    if (h === this.endHour && m > 0) { m = 0; }

    this.newAppointment[prop] = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  filterPatients(): void {
    const term = this.patientSearchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredPatients.set(this.allPatients());
    } else {
      this.filteredPatients.set(
        this.allPatients().filter(p =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) ||
          (p.telefon && p.telefon.includes(term))
        )
      );
    }
    this.showPatientDropdown.set(true);
  }

  selectPatient(patient: Patient): void {
    this.selectedPatient.set(patient);
    this.newAppointment.patientId = patient.id;
    this.patientSearchTerm = patient.fullName;
    this.showPatientDropdown.set(false);
  }

  clearPatient(): void {
    this.selectedPatient.set(null);
    this.newAppointment.patientId = null;
    this.patientSearchTerm = '';
    this.showPatientDropdown.set(false);
  }

  onPatientFieldFocus(): void {
    if (!this.selectedPatient()) {
      this.showPatientDropdown.set(true);
    }
  }

  // ================== New Patient ==================

  openNewPatientDialog(): void {
    this.newPatient = this.getEmptyPatientForm();
    this.showNewPatientModal.set(true);
  }

  closeNewPatientDialog(): void {
    this.showNewPatientModal.set(false);
  }

  saveNewPatient(): void {
    if (!this.newPatient.firstName || !this.newPatient.lastName) return;
    this.savingPatient.set(true);

    const request: CreatePatientRequest = {
      firstName: this.newPatient.firstName,
      lastName: this.newPatient.lastName,
      email: this.newPatient.email || undefined,
      telefon: this.newPatient.telefon || undefined,
      street: this.newPatient.street || undefined,
      houseNumber: this.newPatient.houseNumber || undefined,
      postalCode: this.newPatient.postalCode || undefined,
      city: this.newPatient.city || undefined,
      isBWO: this.newPatient.isBWO
    };

    this.patientService.create(request).subscribe({
      next: (patient) => {
        this.savingPatient.set(false);
        this.toastService.show(`Patient ${patient.firstName} ${patient.lastName} angelegt`, 'success');
        // Add to list and select
        this.allPatients.update(list => [...list, patient]);
        this.selectPatient(patient);
        this.closeNewPatientDialog();
      },
      error: () => {
        this.savingPatient.set(false);
        this.toastService.show('Fehler beim Anlegen des Patienten', 'error');
      }
    });
  }

  // ================== Save Appointment ==================

  canSaveAppointment(): boolean {
    const f = this.newAppointment;
    if (!f.therapistId || !f.patientId || !f.startTime || !f.endTime) return false;
    if (f.isSeries) {
      return !!f.date && !!f.seriesEndDate && !!f.weekday && f.weeklyFrequency > 0;
    }
    return !!f.date;
  }

  saveAppointment(): void {
    if (!this.canSaveAppointment()) return;
    this.savingAppointment.set(true);

    const editing = this.editingAppointment();
    if (editing) {
      this.updateExistingAppointment(editing.id);
    } else if (this.newAppointment.isSeries) {
      this.saveSeriesAppointment();
    } else {
      this.saveSingleAppointment();
    }
  }

  private updateExistingAppointment(id: number): void {
    const dateStr = this.newAppointment.date;
    const request: CreateAppointmentRequest = {
      therapistId: this.newAppointment.therapistId!,
      patientId: this.newAppointment.patientId!,
      date: `${dateStr}T00:00:00.000`,
      startTime: `${dateStr}T${this.newAppointment.startTime}:00.000`,
      endTime: `${dateStr}T${this.newAppointment.endTime}:00.000`,
      comment: this.newAppointment.comment || undefined,
      isHotair: this.newAppointment.isHotair,
      isUltrasonic: this.newAppointment.isUltrasonic,
      isElectric: this.newAppointment.isElectric
    };

    this.appointmentService.update(id, request).subscribe({
      next: (result) => {
        this.savingAppointment.set(false);
        if (result.saved) {
          this.appointmentCache.invalidateCache(); // Invalidate cache on successful update
          this.toastService.show('Termin erfolgreich aktualisiert', 'success');
          this.closeCreateModal();
          this.loadAppointments();
        } else if (result.conflictCheck?.hasConflicts) {
          this.toastService.show('Konflikt: ' + (result.conflictCheck.conflicts?.[0]?.message || 'Terminkonflikt'), 'warning');
        }
      },
      error: (err) => {
        this.savingAppointment.set(false);
        this.toastService.show('Fehler beim Aktualisieren des Termins', 'error');
      }
    });
  }

  private saveSingleAppointment(): void {
    const dateStr = this.newAppointment.date; // "2024-01-15"

    // Build ISO timestamps for the backend java.util.Date fields
    const request: CreateAppointmentRequest = {
      therapistId: this.newAppointment.therapistId!,
      patientId: this.newAppointment.patientId!,
      date: `${dateStr}T00:00:00.000`,
      startTime: `${dateStr}T${this.newAppointment.startTime}:00.000`,
      endTime: `${dateStr}T${this.newAppointment.endTime}:00.000`,
      comment: this.newAppointment.comment || undefined,
      isHotair: this.newAppointment.isHotair,
      isUltrasonic: this.newAppointment.isUltrasonic,
      isElectric: this.newAppointment.isElectric
    };

    this.appointmentService.create(request).subscribe({
      next: (result) => {
        this.savingAppointment.set(false);
        if (result.saved) {
          this.appointmentCache.invalidateCache(); // Invalidate cache on successful create
          this.toastService.show('Termin erfolgreich angelegt', 'success');
          this.closeCreateModal();
          this.loadAppointments();
        } else if (result.conflictCheck?.hasConflicts) {
          this.toastService.show('Konflikt: ' + (result.conflictCheck.conflicts?.[0]?.message || 'Terminkonflikt'), 'warning');
        }
      },
      error: (err) => {
        this.savingAppointment.set(false);
        if (err.status === 409) {
          const conflicts = err.error?.conflicts || [];
          this.toastService.show('Konflikt: ' + (conflicts[0]?.message || 'Terminkonflikt erkannt'), 'warning');
        } else {
          this.toastService.show('Fehler beim Anlegen des Termins', 'error');
        }
      }
    });
  }

  private saveSeriesAppointment(): void {
    const f = this.newAppointment;
    const startDateStr = f.date;        // "2024-01-15"
    const endDateStr = f.seriesEndDate;  // "2024-06-15"

    const request: CreateAppointmentSeriesRequest = {
      therapistId: f.therapistId!,
      patientId: f.patientId!,
      startTime: `${startDateStr}T${f.startTime}:00.000`,
      endTime: `${startDateStr}T${f.endTime}:00.000`,
      startDate: `${startDateStr}T00:00:00.000`,
      endDate: `${endDateStr}T00:00:00.000`,
      weeklyFrequency: f.weeklyFrequency,
      weekday: f.weekday,
      comment: f.comment || undefined,
      isHotair: f.isHotair,
      isUltrasonic: f.isUltrasonic,
      isElectric: f.isElectric
    };

    this.seriesService.create(request).subscribe({
      next: () => {
        this.savingAppointment.set(false);
        this.toastService.show('Serientermin erfolgreich angelegt', 'success');
        this.closeCreateModal();
        this.loadAppointments();
      },
      error: () => {
        this.savingAppointment.set(false);
        this.toastService.show('Fehler beim Anlegen des Serietermins', 'error');
      }
    });
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.selectedPatient.set(null);
    this.patientSearchTerm = '';
    this.showPatientDropdown.set(false);
    this.editingAppointment.set(null);
  }

  confirmDeleteAppointment(): void {
    this.showDeleteAppointmentModal.set(true);
  }

  cancelDeleteAppointment(): void {
    this.showDeleteAppointmentModal.set(false);
  }

  deleteAppointment(): void {
    const apt = this.editingAppointment();
    if (!apt) return;

    this.deletingAppointment.set(true);
    this.appointmentService.delete(apt.id).subscribe({
      next: () => {
        this.toastService.show('Termin wurde gelöscht', 'success');
        this.showDeleteAppointmentModal.set(false);
        this.closeCreateModal();
        this.loadAppointments();
        this.appointmentCache.invalidateCache();
      },
      error: (err) => {
        console.error('Error deleting appointment:', err);
        this.toastService.show('Fehler beim Löschen des Termins', 'error');
        this.deletingAppointment.set(false);
      },
      complete: () => {
        this.deletingAppointment.set(false);
      }
    });
  }

  printPatientAppointments(): void {
    const apt = this.editingAppointment();
    if (!apt || !apt.patientId) return;

    // Fetch all appointments for this patient and print upcoming ones
    this.appointmentService.getByPatient(apt.patientId).subscribe({
      next: (appointments) => {
        const today = new Date().toISOString().split('T')[0];
        const upcomingAppointments = appointments
          .filter(a => a.date >= today && a.status !== 'CANCELLED')
          .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
          .map(a => ({
            id: a.id,
            date: a.date,
            startTime: a.startTime,
            endTime: a.endTime,
            patientName: a.patientName || apt.patientName || '',
            therapistName: a.therapistName || '',
            status: a.status
          } as PrintableAppointment));

        if (upcomingAppointments.length > 0) {
          this.printService.printAppointments(apt.patientName || 'Patient', upcomingAppointments);
        } else {
          this.toastService.show('Keine kommenden Termine zum Drucken vorhanden', 'warning');
        }
      },
      error: () => {
        this.toastService.show('Fehler beim Laden der Termine', 'error');
      }
    });
  }

  // ================== Drag & Drop ==================

  onDrop(event: CdkDragDrop<Appointment[]>, targetTherapistId: number): void {
    const appointment = event.item.data as Appointment;

    // Calculate new time from drop position
    const dropContainer = event.container.element.nativeElement;
    const containerRect = dropContainer.getBoundingClientRect();
    const dropY = event.dropPoint.y - containerRect.top + dropContainer.scrollTop;

    // Convert pixel position to minutes from start of day
    const totalMinutesFromStart = (dropY / this.slotHeight) * this.slotMinutes;
    // Round to nearest 10-minute slot
    const roundedMinutes = Math.round(totalMinutesFromStart / this.slotMinutes) * this.slotMinutes;
    const newHour = this.startHour + Math.floor(roundedMinutes / 60);
    const newMinute = roundedMinutes % 60;

    // Clamp to valid time range
    const clampedHour = Math.max(this.startHour, Math.min(this.endHour, newHour));
    const clampedMinute = clampedHour >= this.endHour ? 0 : Math.max(0, Math.min(50, newMinute));

    // Calculate duration of original appointment
    const origStart = appointment.startTime.includes('T') ? appointment.startTime.split('T')[1] : appointment.startTime;
    const origEnd = appointment.endTime.includes('T') ? appointment.endTime.split('T')[1] : appointment.endTime;
    const origStartParts = origStart.split(':');
    const origEndParts = origEnd.split(':');
    const durationMinutes = (parseInt(origEndParts[0], 10) * 60 + parseInt(origEndParts[1], 10))
      - (parseInt(origStartParts[0], 10) * 60 + parseInt(origStartParts[1], 10));

    const newStartTime = `${clampedHour.toString().padStart(2, '0')}:${clampedMinute.toString().padStart(2, '0')}`;
    const endTotalMinutes = clampedHour * 60 + clampedMinute + durationMinutes;
    const endHour = Math.floor(endTotalMinutes / 60);
    const endMinute = endTotalMinutes % 60;
    const newEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

    // Skip if nothing changed
    if (newStartTime === this.formatTime(appointment.startTime) && targetTherapistId === appointment.therapistId) {
      return;
    }

    const request: MoveAppointmentRequest = {
      newDate: this.selectedDateStr(),
      newStartTime: newStartTime,
      newEndTime: newEndTime,
      newTherapistId: targetTherapistId !== appointment.therapistId ? targetTherapistId : undefined,
      force: false
    };

    this.appointmentService.move(appointment.id, request).subscribe({
      next: (result) => {
        if (result.saved) {
          this.appointmentCache.invalidateCache(); // Invalidate cache on successful move
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
          // Reload to reset card positions after failed drag
          this.loadAppointments();
        }
      }
    });
  }

  closeConflictModal(): void {
    this.showConflictModal.set(false);
    this.conflictInfo.set(null);
    this.pendingMove.set(null);
    this.loadAppointments();
  }

  forceMove(): void {
    const pending = this.pendingMove();
    if (!pending) return;

    const request = { ...pending.request, force: true };
    this.appointmentService.move(pending.appointmentId, request, true).subscribe({
      next: () => {
        this.appointmentCache.invalidateCache(); // Invalidate cache on successful force move
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

  // ================== Helpers ==================

  private getEmptyAppointmentForm(): NewAppointmentForm {
    return {
      therapistId: null,
      patientId: null,
      date: this.selectedDateStr(),
      startTime: '',
      endTime: '',
      comment: '',
      isHotair: false,
      isUltrasonic: false,
      isElectric: false,
      isSeries: false,
      seriesEndDate: '',
      weeklyFrequency: 1,
      weekday: ''
    };
  }

  private getEmptyPatientForm(): NewPatientForm {
    return {
      firstName: '',
      lastName: '',
      email: '',
      telefon: '',
      street: '',
      houseNumber: '',
      postalCode: '',
      city: '',
      isBWO: false
    };
  }
}
