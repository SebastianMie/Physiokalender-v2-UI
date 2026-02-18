import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService, CreateAppointmentRequest } from '../../data-access/api/appointment.service';
import { AppointmentSeriesService } from '../../data-access/api/appointment-series.service';
import { PatientService, Patient } from '../../data-access/api/patient.service';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { ToastService } from '../../core/services/toast.service';
import { PrintService } from '../../core/services/print.service';

@Component({
  selector: 'app-appointment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onClose()">
      <div class="modal modal-create" (click)="$event.stopPropagation()">
        <div class="modal-header-bar">
          <h2>{{ openedForSeriesMaster ? 'Serientermin bearbeiten' : (appointmentId ? 'Termin bearbeiten' : 'Neuen Termin erstellen') }}</h2>
          <ng-container *ngIf="belongsToSeries && !openedForSeriesMaster">
            <div class="edit-mode-header" style="margin-left:auto;">
              <span class="edit-mode-label">Nur diesen Termin bearbeiten?</span>
              <div style="margin-left:5px;" class="edit-mode-btns">
                <button type="button" class="edit-mode-btn" [class.active]="editMode === 'single'" (click)="setEditModeSingle()">Ja</button>
                <button type="button" class="edit-mode-btn" [class.active]="editMode === 'series'" (click)="setEditModeSeries()">Serie</button>
              </div>
            </div>
          </ng-container>
          <button class="btn-close" (click)="onClose()">&times;</button>
        </div>

        <div class="modal-body">
          <div *ngIf="!appointmentId && !openedForSeriesMaster" class="type-toggle-row">
              <button type="button" class="type-btn" [class.active]="!form.isSeries" (click)="form.isSeries = false">Einzeltermin</button>
              <button type="button" class="type-btn" [class.active]="form.isSeries" (click)="form.isSeries = true">Serientermin</button>
            </div>

          <div class="form-row">
            <div class="form-col">
              <label>Patient</label>
              <div class="patient-select-row">
                <div class="patient-search-wrapper">
                  <input
                    type="text"
                    [(ngModel)]="patientQuery"
                    (ngModelChange)="onPatientQuery($event)"
                    placeholder="Patient suchen..."
                    (focus)="onPatientFieldFocus()"
                    [class.patient-selected]="!!selectedPatient"
                    [readonly]="!!selectedPatient || (appointmentId != null && !openedForSeriesMaster)"
                    autocomplete="off" />

                  <button *ngIf="selectedPatient && !(appointmentId != null && !openedForSeriesMaster)" type="button" class="input-clear-btn" (click)="clearPatient()">&times;</button>

                  <div class="dropdown-list" *ngIf="showPatientDropdownFn() && filteredPatients.length > 0 && !selectedPatient">
                    <div class="dropdown-item" *ngFor="let p of filteredPatients" (click)="selectPatient(p)">
                      {{ p.fullName }}
                    </div>
                  </div>
                </div>

                <button *ngIf="!appointmentId || openedForSeriesMaster" type="button" class="btn-new-patient" title="Neuen Patienten anlegen" (click)="requestNewPatient()">+</button>
              </div>

            </div>

            <div class="form-col">
              <label>Therapeut</label>
              <select [(ngModel)]="form.therapistId" [disabled]="appointmentId != null && !openedForSeriesMaster">
                <option [ngValue]="null">— wählen —</option>
                <option *ngFor="let t of therapists" [ngValue]="t.id">{{ t.fullName }}</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-col">
              <label>{{ form.isSeries ? 'Startdatum *' : 'Datum' }}</label>
              <input type="date" [(ngModel)]="form.date" [disabled]="appointmentId != null && !openedForSeriesMaster" />
            </div>
            <div class="form-col">
              <label>Beginn</label>
              <div class="time-hpicker">
                <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'start', 'hour')" title="Scrollen zum Ändern">{{ getHourFromTime(form.startTime) }}</span>
                <span class="tp-colon">:</span>
                <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'start', 'minute')" title="Scrollen zum Ändern">{{ getMinuteFromTime(form.startTime) }}</span>
                <span class="tp-label">Uhr</span>
              </div>
            </div>
            <div class="form-col">
              <label>Ende</label>
              <div class="time-hpicker">
                <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'end', 'hour')" title="Scrollen zum Ändern">{{ getHourFromTime(form.endTime) }}</span>
                <span class="tp-colon">:</span>
                <span class="tp-value tp-scrollable" (wheel)="onTimeScroll($event, 'end', 'minute')" title="Scrollen zum Ändern">{{ getMinuteFromTime(form.endTime) }}</span>
                <span class="tp-label">Uhr</span>
              </div>
            </div>
          </div>

          <!-- Series options (only when creating or editing series) -->
          <div *ngIf="form.isSeries" class="form-row">
              <div class="form-col">
                <label>Enddatum *</label>
                <input type="date" [(ngModel)]="form.seriesEndDate" name="seriesEndDate" required [min]="form.date" />
              </div>
              <div class="form-col">
                <label>Intervall *</label>
                <select [(ngModel)]="form.weeklyFrequency" name="weeklyFrequency" required>
                  <option [ngValue]="1">Jede Woche</option>
                  <option [ngValue]="2">Alle 2 Wochen</option>
                  <option [ngValue]="3">Alle 3 Wochen</option>
                  <option [ngValue]="4">Alle 4 Wochen</option>
                </select>
              </div>
              <div class="form-col">
                <label>Wochentag *</label>
                <select [(ngModel)]="form.weekday" name="weekday" required>
                  <option value="" disabled>Wählen...</option>
                  <option value="MONDAY">Montag</option>
                  <option value="TUESDAY">Dienstag</option>
                  <option value="WEDNESDAY">Mittwoch</option>
                  <option value="THURSDAY">Donnerstag</option>
                  <option value="FRIDAY">Freitag</option>
                </select>
              </div>
            </div>

          <!-- Series edit options when editing series master -->
          <div *ngIf="belongsToSeries && editMode === 'series'" class="series-edit-section">
            <div class="series-info-banner">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
              </svg>
              <div>Änderungen am Serientermin wirken sich auf alle Serien Elemente aus!</div>
            </div>
              <div class="form-row">
                <div class="form-col">
                  <label>Startdatum</label>
                  <input type="date" [(ngModel)]="seriesEditStartDate" name="seriesEditStartDate" />
                </div>
                <div class="form-col">
                  <label>Enddatum</label>
                  <input type="date" [(ngModel)]="seriesEditEndDate" name="seriesEditEndDate" [min]="seriesEditStartDate || form.date" />
                </div>
                <div class="form-col">
                  <label>Intervall</label>
                  <select [(ngModel)]="seriesEditWeeklyFrequency" name="seriesEditWeeklyFrequency">
                    <option [ngValue]="1">Jede Woche</option>
                    <option [ngValue]="2">Alle 2 Wochen</option>
                    <option [ngValue]="3">Alle 3 Wochen</option>
                    <option [ngValue]="4">Alle 4 Wochen</option>
                  </select>
                </div>
              </div>
            </div>

          <div class="form-row">
            <div class="form-col full">
              <label>Kommentar</label>
              <textarea rows="5" [(ngModel)]="form.comment"></textarea>
            </div>
          </div>

          <div class="treatment-checks">
            <label><input type="checkbox" [(ngModel)]="form.isHotair" /> Heißluft</label>
            <label><input type="checkbox" [(ngModel)]="form.isUltrasonic" /> Ultraschall</label>
            <label><input type="checkbox" [(ngModel)]="form.isElectric" /> Elektro</label>
          </div>

          <div *ngIf="conflictDetails || conflictMessage" class="conflict-box">
            <strong>Konflikt erkannt</strong>

            <!-- Detailed conflict list (orange warning with icon) -->
            <div *ngIf="conflictDetails && conflictDetails.length" class="conflict-list" style="margin-top:0.5rem; background:#FFF7ED; border:1px solid #FEEBC8; padding:0.5rem; border-radius:6px;">
              <div *ngFor="let c of conflictDetails" class="conflict-item" style="display:flex; gap:0.75rem; align-items:flex-start; padding:0.45rem 0;">
                <div class="conflict-icon" style="color:#F97316; flex-shrink:0;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <div style="flex:1;">
                  <div style="display:flex; gap:0.5rem; align-items:center;">
                    <div class="conflict-patient" style="font-weight:700; color:#92400E;">{{ c.patientName || (selectedPatient?.firstName && selectedPatient?.lastName ? (selectedPatient?.firstName + ' ' + selectedPatient?.lastName) : '') || 'Patient' }}</div>
                    <div class="conflict-time" style="background:#FFF1E6; color:#92400E; padding:0.15rem 0.5rem; border-radius:4px; font-weight:600;">{{ formatConflictTime(c.startTime) }} – {{ formatConflictTime(c.endTime) }}</div>
                  </div>
                  <div class="conflict-desc" style="margin-top:0.25rem; color:#92400E; font-size:0.9rem;">{{ c.message || c.description || 'Konflikt mit vorhandenem Termin' }}</div>
                </div>
              </div>

              <div class="conflict-actions" style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.5rem;">
                <button class="btn btn-primary" (click)="save(true)" [disabled]="savingAppointment()">Speichern (trotz Konflikt)</button>
              </div>
            </div>

            <!-- Fallback single-line conflict message -->
            <div *ngIf="(!conflictDetails || conflictDetails.length === 0) && conflictMessage" style="margin-top:0.5rem; display:flex; gap:0.5rem; align-items:center; background:#FFF7ED; border:1px solid #FEEBC8; padding:0.4rem; border-radius:6px;">
              <div style="color:#F97316;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <div style="flex:1; color:#92400E;">{{ conflictMessage }}</div>
              <div><button class="btn btn-primary" (click)="save(true)" [disabled]="savingAppointment()">Speichern (trotz Konflikt)</button></div>
            </div>

          </div>
        </div>

        <div class="modal-actions-bar">
          <div class="left-action-group">
            <button class="btn btn-secondary" (click)="onClose()">Abbrechen</button>
            <ng-container *ngIf="appointmentId">
              <button type="button" class="btn-print-icon" title="Alle Termine des Patienten drucken" (click)="printPatientAppointments()">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
              </button>
              <button type="button" class="btn-delete-icon" title="Termin löschen" (click)="confirmDeleteAppointment()">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </ng-container>
          </div>

          <div class="spacer"></div>
          <button class="btn btn-primary" (click)="onSaveClick()" [disabled]="!canSaveAppointment() || savingAppointment()">Speichern</button>
        </div>
      </div>
    </div>

    @if (showNewPatientModal()) {
      <div class="modal-overlay" (click)="closeNewPatientDialog()">
        <div class="modal modal-wide" (click)="$event.stopPropagation()">
          <h2>Neuen Patienten anlegen</h2>

          <div class="form-section" style="max-width:820px;">
            <div class="form-row-2">
              <div class="form-group flex-1">
                <label>Vorname *</label>
                <input type="text" [(ngModel)]="newPatientForm.firstName" autofocus />
              </div>
              <div class="form-group flex-1">
                <label>Nachname *</label>
                <input type="text" [(ngModel)]="newPatientForm.lastName" />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group flex-1">
                <label>Geburtsdatum</label>
                <input type="date" [(ngModel)]="newPatientForm.dateOfBirth" />
              </div>
              <div class="form-group flex-1">
                <label>E-Mail</label>
                <input type="email" [(ngModel)]="newPatientForm.email" />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group flex-1">
                <label>Telefon</label>
                <input type="tel" [(ngModel)]="newPatientForm.telefon" />
              </div>
              <div class="form-group flex-1">
                <label>Versicherung</label>
                <input type="text" [(ngModel)]="newPatientForm.insuranceType" />
              </div>
            </div>

            <div class="form-divider"></div>
            <h3>Adresse</h3>

            <div class="form-row-2">
              <div class="form-group flex-3">
                <label>Straße</label>
                <input type="text" [(ngModel)]="newPatientForm.street" />
              </div>
              <div class="form-group flex-1">
                <label>Hausnr.</label>
                <input type="text" [(ngModel)]="newPatientForm.houseNumber" />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group flex-1">
                <label>PLZ</label>
                <input type="text" [(ngModel)]="newPatientForm.postalCode" />
              </div>
              <div class="form-group flex-3">
                <label>Ort</label>
                <input type="text" [(ngModel)]="newPatientForm.city" />
              </div>
            </div>

            <div class="form-group">
              <label>Notizen</label>
              <textarea rows="3" [(ngModel)]="newPatientForm.notes"></textarea>
            </div>

            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="newPatientForm.isBWO" />
              BWO (Behindertenwerkstatt Oberberg)
            </label>

            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="newPatientForm.isActive" />
              Aktiver Patient
            </label>
          </div>

          <div class="modal-actions">
            <button class="btn-cancel" (click)="closeNewPatientDialog()">Abbrechen</button>
            <button class="btn-save" (click)="saveNewPatient()" [disabled]="savingPatient() || !newPatientForm.firstName || !newPatientForm.lastName">
              {{ savingPatient() ? 'Speichern...' : 'Speichern' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showDeleteAppointmentModal()) {
      <div class="modal-overlay" (click)="cancelDeleteAppointment()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <h4 style="padding-left:2rem; padding-top:1rem; padding-bottom:1rem;">Möchten Sie diesen Termin wirklich löschen?</h4>
          <div class="modal-actions-bar">
            <button class="btn-secondary" (click)="cancelDeleteAppointment()">Abbrechen</button>
            <button class="btn btn-primary" (click)="deleteAppointment()" [disabled]="deletingAppointment()">{{ deletingAppointment() ? 'Lösche...' : 'Termin löschen' }}</button>
          </div>
        </div>
      </div>
    }

    @if (showSeriesEditConfirmModal()) {
      <div class="modal-overlay" (click)="cancelSeriesEdit()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <h2>Serie bearbeiten?</h2>
          <p>Änderungen wirken sich auf alle zukünftigen Termine dieser Serie aus. Fortfahren?</p>
          <div class="modal-actions-bar">
            <button class="btn-secondary" (click)="cancelSeriesEdit()">Abbrechen</button>
            <button class="btn btn-primary" (click)="confirmSeriesEdit()">Änderungen anwenden</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:1300; }
      .modal { background: white; border-radius: 12px; padding: 1.5rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; }
      .modal.modal-sm { max-width: 420px; padding: 1rem; }
      .modal-header-bar { display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; border-bottom:1px solid #EEF2FF; }
      .modal-body { padding:1rem; max-height:65vh; overflow:auto; display:flex; flex-direction:column; gap:0.75rem; }
      .form-row { display:flex; gap:0.75rem; }
      .form-col { flex:1; display:flex; flex-direction:column; gap:0.25rem; }
      .form-col.full { flex:1 1 100%; }
      input[type="text"], input[type="date"], input[type="time"], select { padding:0.45rem; border:1px solid #E5E7EB; border-radius:6px; }
      .patient-dropdown { border:1px solid #E5E7EB; background:white; border-radius:6px; box-shadow:0 6px 12px rgba(0,0,0,0.08); max-height:160px; overflow:auto; margin-top:0.25rem; }
      .patient-option, .dropdown-item { padding:0.45rem; cursor:pointer; display:flex; align-items:center; gap:0.5rem; }
      .patient-option:hover, .dropdown-item:hover { background:#EFF6FF; }
      .selected-tag { margin-top:0.25rem; display:inline-flex; gap:0.5rem; align-items:center; background:#DBEAFE; padding:0.25rem 0.5rem; border-radius:6px; }

      /* Patient input (DailyList parity) */
      /* edit-mode button retained locally; patient / chip / clear button styles now use global utilities */
      .edit-mode-header { display:flex; align-items:center; margin-left:auto; margin-right:0.5rem; }
      .edit-mode-btns { display:flex; gap:0; border:1px solid #E5E7EB; border-radius:4px; overflow:hidden; }
      .edit-mode-btn { padding:0.25rem 0.5rem; border:none; background:#F9FAFB; cursor:pointer; font-size:0.65rem; font-weight:500; color:#9CA3AF; transition:all 0.15s; }
      .edit-mode-btn:first-child { border-right:1px solid #E5E7EB; }
      .edit-mode-btn.active { background:#3B82F6; color:white; }

      /* Close button - ensure plain "×" style and spacing from the edit-mode group */
      .btn-close { border: none; background: none; font-size: 1.5rem; cursor: pointer; color: #6B7280; padding: 0 0.25rem; margin-left: 0.25rem; }
      .btn-close:hover { color: #111827; }

      /* Type toggle (Einzel/Serie) - match DailyList visual style */
      .type-toggle-row { display: flex; gap: 0; margin-bottom: 1rem; border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; }
      .type-btn { flex: 1; padding: 0.3rem 0.75rem; border: none; background: #F9FAFB; cursor: pointer; font-size: 0.75rem; font-weight: 500; color: #9CA3AF; transition: all 0.15s; }
      .type-btn:first-child { border-right: 1px solid #E5E7EB; }
      .type-btn.active { background: #EFF6FF; color: #2563EB; }
      .type-btn:hover:not(.active) { background: #F3F4F6; color: #6B7280; }

      /* Patient search input — match DailyList so + button lines up */
      .patient-select-row { display:flex; gap:0.5rem; }
      .patient-search-wrapper { flex:1; position:relative; }
      .patient-search-wrapper input { width:100%; padding:0.5rem 0.75rem; border:1px solid #D1D5DB; border-radius:6px; font-size:0.875rem; outline:none; box-sizing:border-box; }
      .patient-search-wrapper input.patient-selected { color:#111827; font-weight:500; padding-right:2rem; }
      .dropdown-list { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #D1D5DB; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 30; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-top: 2px; }
      .dropdown-item { padding: 0.45rem 0.6rem; cursor: pointer; font-size: 0.875rem; }

      /* locally override new-patient button to match DailyList height */
      .btn-new-patient { padding:0.5rem 0.75rem; border:1px solid #3B82F6; background:#EFF6FF; color:#3B82F6; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap; font-weight:500; }

      .treatment-checks { display:flex; gap:0.75rem; align-items:center; padding-top:0.5rem; }
      .modal-actions-bar { display:flex; justify-content:flex-end; gap:0.5rem; padding:0.5rem 1rem; border-top:1px solid #F3F4F6; }
      .conflict-box { border:1px solid #E5E7EB; background:#F9FAFB; padding:0.6rem; border-radius:6px; margin-top:0.5rem; color: #374151; }
      .conflict-item { padding: 0.25rem 0; font-size: 0.875rem; }
      .conflict-actions { display:flex; justify-content:flex-end; margin-top:0.5rem; }
      .conflict-actions { display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.5rem; }

      /* Series info banner (matches DailyList) */
      .series-info-banner { display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0.75rem; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:6px; margin-bottom:1rem; font-size:0.75rem; color:#1E40AF; }
      .series-info-banner svg { flex-shrink:0; }

      /* Comment textarea */
      .form-col textarea { padding:0.5rem 0.75rem; border:1px solid #D1D5DB; border-radius:6px; font-size:0.875rem; min-height:120px; resize:vertical; }

      /* DailyList modal & time picker styles (copied for exact parity) */
      .modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; gap:0.5rem; }
      .modal-header h2 { margin: 0; font-size: 1.25rem; color: #2563EB; }
      .modal h2 { margin: 0; color: #2563EB; }
      .modal-actions { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-top:1.5rem; padding-top:1rem; border-top:1px solid #E5E7EB; }

      .btn-delete-icon { border: none; background: none; color: #9CA3AF; cursor: pointer; padding: 0.25rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
      .btn-delete-icon:hover { color: #DC2626; background: #FEE2E2; }
      .btn-print-icon { border: none; background: none; color: #9CA3AF; cursor: pointer; padding: 0.25rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
      .btn-print-icon:hover { color: #F97316; background: #FFF7ED; }

      /* Time picker */
      .time-hpicker { display:flex; align-items:center; gap:0.15rem; background:#F9FAFB; border:1px solid #D1D5DB; border-radius:8px; padding:0.4rem 0.5rem; }
      .tp-value { font-size:1.15rem; font-weight:600; color:#111827; min-width:32px; text-align:center; font-variant-numeric:tabular-nums; }
      .tp-scrollable { cursor: ns-resize; user-select: none; background: white; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0.2rem 0.35rem; transition: all 0.15s; }
      .tp-scrollable:hover { border-color: #3B82F6; background: #EFF6FF; color: #2563EB; box-shadow: 0 0 0 2px rgba(59,130,246,0.12); }
      .tp-colon { font-size: 1.1rem; font-weight: 700; color: #9CA3AF; margin: 0 0.1rem; }
      .tp-label { font-size: 0.75rem; color: #9CA3AF; font-weight: 500; margin-left: 0.2rem; }

      /* keep the older action-class name for compatibility */
      .modal-actions-bar { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding-top:1rem; border-top:1px solid #E5E7EB; }

      /* New-patient modal: consistent spacing & responsive two-column layout */
      .modal-wide { max-width: 820px; width: 90%; }
      .modal-wide .form-section { padding: 0.5rem 0; display:flex; flex-direction:column; gap:0.75rem; }
      .modal-wide .form-row-2 { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
      .modal-wide .form-group { display:flex; flex-direction:column; gap:0.25rem; min-width:0; flex:1; }
      .modal-wide .form-group label { font-size:0.75rem; color:#6B7280; font-weight:500; }
      .modal-wide .form-group input,
      .modal-wide .form-group textarea,
      .modal-wide .form-group select { width:100%; padding:0.5rem 0.6rem; border:1px solid #D1D5DB; border-radius:6px; font-size:0.9rem; box-sizing:border-box; }
      .modal-wide .form-divider { height:1px; background:#F3F4F6; margin:0.5rem 0; }
      .modal-wide .flex-1 { flex:1; }
      .modal-wide .flex-3 { flex:3; }
      .modal-wide .checkbox-label { display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; color:#374151; }

      .modal-wide .modal-actions { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding-top:0.75rem; border-top:1px solid #E5E7EB; }
      .modal-wide .btn-cancel { background: none; border: 1px solid #E5E7EB; color: #374151; padding: 0.5rem 0.9rem; border-radius: 6px; }
      .modal-wide .btn-save { padding:0.45rem 1.25rem; background: #2563EB; color: white; border: none; border-radius: 6px; cursor: pointer; }

      /* modal action left buttons (print/delete) */
      .left-action-group { display:flex; gap:0.5rem; align-items:center; margin-right:0.5rem; }
      .btn-print-left { background: #ffffff; color: orange; border: none; padding: 0.35rem 0.6rem; border-radius: 6px; display:flex; align-items:center; justify-content:center; }
      .btn-print-left:hover { background: #EA580C; }
      .btn-delete-left { background: #ffffff; color: red; border: none; padding: 0.35rem 0.6rem; border-radius: 6px; display:flex; align-items:center; justify-content:center; }
      .btn-delete-left:hover { background: #DC2626; }

      /* Responsive: stack columns on small screens */
      @media (max-width: 720px) {
        .modal-wide { width: 96%; padding: 1rem; }
        .modal-wide .form-row-2 { flex-direction: column; gap: 0.5rem; }
        .modal-wide .form-section { gap: 0.5rem; }
        .modal-wide .modal-actions { flex-direction: row; justify-content: space-between; }
      }
    `,
  ],
})
export class AppointmentModalComponent implements OnInit {
  @Input() presetPatientId: number | null = null;
  @Input() presetTherapistId: number | null = null;
  @Input() presetDate?: string | null;
  @Input() presetStartTime?: string | null;
  @Input() presetEndTime?: string | null;
  @Input() presetIsSeries?: boolean | null;
  @Input() appointmentId: number | null = null; // if set -> edit mode (load appointment)
  @Input() initialEditMode: 'single' | 'series' | null = null; // optional: open already in series-edit mode when editing an appointment
  @Input() seriesId: number | null = null; // optional: edit an existing series master directly in the appointment modal

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<any>();
  @Output() newPatient = new EventEmitter<void>();

  // Reuse DailyList-like form shape so template matches 1:1
  form: any = {
    therapistId: null as number | null,
    patientId: null as number | null,
    date: new Date().toISOString().slice(0,10),
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

  // patient search / selection (DailyList-like API)
  patientQuery = '';
  patientSearchTerm = '';
  patients: Patient[] = [];
  therapists: Therapist[] = [];
  selectedPatient: Patient | null = null;
  filteredPatients: Patient[] = [];
  showPatientDropdown = false;

  // modal state
  saving = signal(false);
  savingAppointment = signal(false);
  savingPatient = signal(false);
  deletingAppointment = signal(false);
  showNewPatientModal = signal(false);
  showDeleteAppointmentModal = signal(false);
  showSeriesEditConfirmModal = signal(false);
  conflictMessage: string | null = null;
  // detailed conflict info (if provided by API)
  // backend may include patientName/startTime/endTime/description — accept wider shape
  conflictDetails: Array<{
    message?: string;
    description?: string;
    conflictingAppointmentId?: number;
    patientName?: string;
    startTime?: string;
    endTime?: string;
    therapistName?: string;
    date?: string;
  }> | null = null;

  // series edit fields (when editing master)
  seriesEditStartDate = '';
  seriesEditEndDate = '';
  seriesEditWeeklyFrequency = 1;

  // Normalize / dedupe conflict entries and filter self-conflicts
  private normalizeConflicts(conflicts?: any[] | null): any[] | null {
    if (!conflicts || !conflicts.length) return null;
    const seen = new Set<string>();
    const out: any[] = [];
    for (const c of conflicts) {
      // skip conflicts that reference the appointment currently being edited
      if (c?.conflictingAppointmentId && this.appointmentId && c.conflictingAppointmentId === this.appointmentId) continue;
      const key = `${c?.conflictingAppointmentId ?? ''}::${(c?.patientName || '').trim()}::${c?.startTime ?? ''}::${c?.endTime ?? ''}::${(c?.description || c?.message || '').trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out.length ? out : null;
  }

  // If modal opened to edit a series directly (no appointment present), this flag helps
  // prefill the form and enable the series edit UI.
  editingSeriesId: number | null = null;

  // edit mode for series vs single (when editing an appointment that belongs to a series)
  editMode: 'single' | 'series' = 'single';

  constructor(
    private patientService: PatientService,
    private therapistService: TherapistService,
    private appointmentService: AppointmentService,
    private seriesService: AppointmentSeriesService,
    private toast: ToastService,
    private printService: PrintService
  ) {}

  // track whether loaded appointment belongs to a series
  belongsToSeries = false;

  // Helper: true when modal was opened to edit a series directly via `seriesId` input
  get openedForSeriesMaster(): boolean { return !!this.seriesId || !!this.editingSeriesId; }

  ngOnInit(): void {
    // load reference data
    this.patientService.getAll().subscribe({ next: p => {
      this.patients = (p || []);
      this.filteredPatients = this.patients;
      // If we're editing an appointment and the patients arrived after loadAppointmentForEdit,
      // ensure the selected patient is populated in the input field.
      if (this.form.patientId && !this.selectedPatient) {
        const found = this.patients.find(px => px.id === this.form.patientId);
        if (found) {
          this.selectedPatient = found;
          this.patientSearchTerm = found.fullName || '';
          // show name inside the search input as well (same behaviour as DailyList)
          this.patientQuery = found.fullName || '';
        }
      }
    } });
    this.therapistService.getAll().subscribe({ next: t => this.therapists = (t || []).filter(x => x.isActive) });

    console.log('[AppointmentModal] ngOnInit inputs:', { appointmentId: this.appointmentId, seriesId: this.seriesId, presetPatientId: this.presetPatientId });

    // apply presets (for create flow and when provided by caller)
    if (this.presetPatientId) this.form.patientId = this.presetPatientId as number;
    if (this.presetTherapistId) this.form.therapistId = this.presetTherapistId as number;
    if (this.presetDate) this.form.date = this.presetDate;
    if (this.presetStartTime) this.form.startTime = this.presetStartTime;
    if (this.presetEndTime) this.form.endTime = this.presetEndTime;
    if (this.presetIsSeries) this.form.isSeries = !!this.presetIsSeries;

    // load appointment for editing (if provided)
    if (this.appointmentId) {
      this.loadAppointmentForEdit(this.appointmentId);
    }

    // If a seriesId is provided (open modal to edit series master directly), load it
    if (!this.appointmentId && this.seriesId) {
      console.log('[AppointmentModal] ngOnInit - seriesId present, calling loadSeriesForEdit', this.seriesId);
      this.loadSeriesForEdit(this.seriesId);
    }
  }

  // patient helpers (DailyList-like API)
  filterPatients(): void {
    const raw = (this.patientSearchTerm || this.patientQuery).trim();
    const term = raw.toLowerCase();

    // Only start searching after 3 characters to reduce noise
    if (!term || raw.length < 3) {
      this.filteredPatients = [];
      this.showPatientDropdown = false;
      return;
    }

    this.filteredPatients = this.patients.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) || (p.telefon && p.telefon.includes(term)));
    this.showPatientDropdown = this.filteredPatients.length > 0;
  }

  showPatientDropdownFn(): boolean {
    // prevent opening patient dropdown when editing an existing appointment (unless editing series master)
    if (this.appointmentId && !this.openedForSeriesMaster) return false;
    const raw = (this.patientSearchTerm || this.patientQuery).trim();
    return this.showPatientDropdown && raw.length >= 3 && (this.filteredPatients.length > 0);
  }

  // wrapper for the UI 'save' buttons (allow force)
  save(force = false) { this.saveAppointment(force); }

  onPatientQuery(v: string) { this.patientQuery = v; this.patientSearchTerm = v; this.filterPatients(); }

  selectPatient(p: Patient) {
    this.selectedPatient = p;
    this.form.patientId = p.id;
    // show "Vorname Nachname" in the input field
    this.patientSearchTerm = `${p.firstName} ${p.lastName}`.trim();
    this.patientQuery = `${p.firstName} ${p.lastName}`.trim();
    this.showPatientDropdown = false;
  }

  selectedPatientFn(): Patient | null { return this.selectedPatient; }

  clearPatient() {
    // don't allow clearing patient for existing appointments (read-only)
    if (this.appointmentId && !this.openedForSeriesMaster) return;
    this.selectedPatient = null;
    this.form.patientId = null;
    this.patientSearchTerm = '';
    this.patientQuery = '';
    this.showPatientDropdown = false;
  }

  onPatientFieldFocus(): void {
    // prevent interaction when editing existing appointment (except series master)
    if (this.appointmentId && !this.openedForSeriesMaster) return;
    // only open dropdown on focus when the user has typed >= 3 chars (same behaviour as DailyList)
    if (!this.selectedPatient && (this.patientQuery || '').trim().length >= 3) {
      this.showPatientDropdown = true;
    }
  }

  setEditModeSingle(): void {
    if (this.openedForSeriesMaster) return; // prevent switching when modal opened for series master
    this.editMode = 'single';
  }

  setEditModeSeries(): void {
    if (this.openedForSeriesMaster) return; // prevent switching when modal opened for series master
    this.editMode = 'series';
    // load series details if possible
    if (!this.appointmentId) return;
    this.appointmentService.getById(this.appointmentId).subscribe({
      next: (apt) => {
        const sid = apt.appointmentSeriesId;
        if (sid) {
          this.seriesService.getById(sid).subscribe({
            next: (series) => {
              this.seriesEditStartDate = series.startDate ? series.startDate.split('T')[0] : this.form.date;
              this.seriesEditEndDate = series.endDate ? series.endDate.split('T')[0] : '';
              this.seriesEditWeeklyFrequency = series.weeklyFrequency || 1;
              this.form.weekday = this.normalizeWeekday(series.weekday) || this.form.weekday;
            },
            error: () => {
              this.seriesEditStartDate = this.form.date;
              this.seriesEditEndDate = '';
              this.seriesEditWeeklyFrequency = 1;
            }
          });
        }
      }
    });
  }

  // Time scroll helpers (copy from DailyList)
  onTimeScroll(event: WheelEvent, which: 'start' | 'end', part: 'hour' | 'minute'): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1 : -1;
    if (part === 'hour') {
      this.adjustHour(which, delta);
    } else {
      this.adjustMinute(which, delta * 10);
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

  // Format backend conflict time values (ISO or HH:mm:ss) to HH:MM
  public formatConflictTime(value?: string | null): string {
    if (!value) return '--:--';
    const s = String(value);
    if (s.includes('T')) return s.split('T')[1].substring(0,5);
    if (s.indexOf(':') >= 0) return s.substring(0,5);
    return s;
  }

  // Normalize weekday strings (accepts 'Montag', 'monday', 'MONDAY' etc.)
  private normalizeWeekday(value?: string | null): string {
    if (!value) return '';
    const map: Record<string,string> = {
      'montag':'MONDAY','dienstag':'TUESDAY','mittwoch':'WEDNESDAY','donnerstag':'THURSDAY','freitag':'FRIDAY','samstag':'SATURDAY','sonntag':'SUNDAY',
      'monday':'MONDAY','tuesday':'TUESDAY','wednesday':'WEDNESDAY','thursday':'THURSDAY','friday':'FRIDAY','saturday':'SATURDAY','sunday':'SUNDAY'
    };
    const key = value.trim();
    const lower = key.toLowerCase();
    const candidate = map[key] || map[lower] || key.toUpperCase();
    const valid = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    return valid.includes(candidate) ? candidate : '';
  }

  adjustHour(which: 'start' | 'end', delta: number): void {
    const prop = which === 'start' ? 'startTime' : 'endTime';
    let current = this.form[prop];
    if (!current) current = '07:00';

    const parts = current.split(':');
    let h = parseInt(parts[0], 10) + delta;
    if (h < 7) h = 20;
    if (h > 20) h = 7;
    this.form[prop] = `${h.toString().padStart(2, '0')}:${parts[1]}`;
  }

  adjustMinute(which: 'start' | 'end', delta: number): void {
    const prop = which === 'start' ? 'startTime' : 'endTime';
    let current = this.form[prop];
    if (!current) current = '07:00';

    const parts = current.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10) + delta;

    if (m >= 60) { m = 0; h++; }
    if (m < 0) { m = 50; h--; }
    if (h > 20) { h = 7; }
    if (h < 7) { h = 20; }
    if (h === 20 && m > 0) { m = 0; }

    this.form[prop] = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private loadAppointmentForEdit(id: number): void {
    this.appointmentService.getById(id).subscribe({
      next: (apt) => {
        console.log('[AppointmentModal] loadAppointmentForEdit - appointment loaded from service', apt);
        // populate modal form (DailyList-equivalent fields)
        this.form.patientId = apt.patientId || null;
        this.form.therapistId = apt.therapistId || null;
        this.form.date = apt.date || this.form.date;
        const start = apt.startTime.includes('T') ? apt.startTime.split('T')[1].substring(0,5) : apt.startTime.substring(0,5);
        const end = apt.endTime.includes('T') ? apt.endTime.split('T')[1].substring(0,5) : apt.endTime.substring(0,5);
        this.form.startTime = start;
        this.form.endTime = end;
        this.form.comment = apt.comment || '';
        this.form.isHotair = !!apt.isHotair;
        this.form.isUltrasonic = !!apt.isUltrasonic;
        this.form.isElectric = !!apt.isElectric;

        // mark as editing and whether it belongs to a series
        this.belongsToSeries = !!(apt.appointmentSeriesId || apt.createdBySeriesAppointment);
        if (this.belongsToSeries) this.editMode = 'single';
        // if caller requested a specific initial edit mode, apply it (e.g. open directly in series edit)
        if (this.initialEditMode) this.editMode = this.initialEditMode;

        // If caller opened the modal in series-edit mode (initialEditMode === 'series'),
        // proactively load the series master so the form is prefilled instead of showing a single occurrence.
        if (this.initialEditMode === 'series' && apt.appointmentSeriesId) {
          console.log('[AppointmentModal] loadAppointmentForEdit - initialEditMode=series, loading seriesId=', apt.appointmentSeriesId);
          this.loadSeriesForEdit(apt.appointmentSeriesId);
        }

        // show patient name while patient list loads
        // prefer explicit "Vorname Nachname" where possible
        const patientRecord = this.patients.find(p => p.id === apt.patientId) || null;
        if (patientRecord) {
          this.selectedPatient = patientRecord;
          const full = `${patientRecord.firstName} ${patientRecord.lastName}`.trim();
          this.patientSearchTerm = full;
          this.patientQuery = full;
        } else if (apt.patientId) {
          // ensure we set the appointment's patient even if the patients list hasn't loaded yet
          this.patientService.getById(apt.patientId).subscribe({
            next: (p) => {
              this.selectedPatient = p;
              const full = `${p.firstName} ${p.lastName}`.trim();
              this.patientSearchTerm = full;
              this.patientQuery = full;
            },
            error: () => {
              this.patientSearchTerm = apt.patientName || '';
              this.patientQuery = apt.patientName || '';
              this.selectedPatient = null;
            }
          });
        } else {
          this.patientSearchTerm = apt.patientName || '';
          this.patientQuery = apt.patientName || '';
          this.selectedPatient = null;
        }
      },
      error: () => {
        this.toast.error('Fehler beim Laden des Termins');
      }
    });
  }

  private loadSeriesForEdit(seriesId: number): void {
    console.log('[AppointmentModal] loadSeriesForEdit called with seriesId=', seriesId);
    this.seriesService.getById(seriesId).subscribe({
      next: (s) => {
        console.log('[AppointmentModal] loadSeriesForEdit - series loaded', s);
        // prefill form for editing the series master
        this.editingSeriesId = seriesId;
        this.form.isSeries = true;
        this.form.therapistId = s.therapistId || null;
        this.form.patientId = s.patientId || null;
        this.form.date = s.startDate ? s.startDate.split('T')[0] : this.form.date;

        // times may come as HH:mm:ss or ISO timestamps
        this.form.startTime = s.startTime ? (s.startTime.includes('T') ? s.startTime.split('T')[1].substring(0,5) : s.startTime.substring(0,5)) : '';
        this.form.endTime = s.endTime ? (s.endTime.includes('T') ? s.endTime.split('T')[1].substring(0,5) : s.endTime.substring(0,5)) : '';

        this.form.weeklyFrequency = s.weeklyFrequency || 1;
        this.form.weekday = this.normalizeWeekday(s.weekday) || '';
        this.form.seriesEndDate = s.endDate ? s.endDate.split('T')[0] : '';
        this.form.comment = s.comment || '';
        this.form.isHotair = !!s.isHotair;
        this.form.isUltrasonic = !!s.isUltrasonic;
        this.form.isElectric = !!s.isElectric;

        this.seriesEditStartDate = s.startDate ? s.startDate.split('T')[0] : this.form.date;
        this.seriesEditEndDate = s.endDate ? s.endDate.split('T')[0] : this.form.seriesEndDate;
        this.seriesEditWeeklyFrequency = s.weeklyFrequency || 1;

        this.belongsToSeries = true;
        this.editMode = 'series';
      },
      error: (err) => {
        console.error('[AppointmentModal] loadSeriesForEdit error', err);
        this.toast.error('Fehler beim Laden der Serie');
      }
    });
  }

  canSaveAppointment(): boolean {
    const f = this.form;
    if (!f.therapistId || !f.patientId || !f.startTime || !f.endTime) return false;
    if (f.isSeries) {
      return !!f.date && !!f.seriesEndDate && !!f.weekday && f.weeklyFrequency > 0;
    }
    return !!f.date;
  }

  onClose() { this.close.emit(); }

  // Delete (when editing)
  confirmDeleteAppointment(): void {
    this.showDeleteAppointmentModal.set(true);
  }

  cancelDeleteAppointment(): void {
    this.showDeleteAppointmentModal.set(false);
  }

  deleteAppointment(): void {
    if (!this.appointmentId) return;
    this.deletingAppointment.set(true);
    this.appointmentService.delete(this.appointmentId).subscribe({
      next: () => {
        this.deletingAppointment.set(false);
        this.toast.success('Termin gelöscht');
        this.saved.emit({ deleted: true });
        this.onClose();
      },
      error: () => {
        this.deletingAppointment.set(false);
        this.toast.error('Fehler beim Löschen des Termins');
      }
    });
  }

  // New patient — handled inside this modal; keep event for backward compatibility
  newPatientForm: any = this.getEmptyPatientForm();

  private getEmptyPatientForm() {
    return {
      firstName: '',
      lastName: '',
      email: '',
      telefon: '',
      dateOfBirth: '',
      insuranceType: '',
      street: '',
      houseNumber: '',
      postalCode: '',
      city: '',
      notes: '',
      isBWO: false,
      isActive: true
    };
  }

  requestNewPatient(): void {
    this.showNewPatientModal.set(true);
    this.newPatientForm = this.getEmptyPatientForm();
    this.newPatient.emit();
  }

  closeNewPatientDialog(): void {
    this.showNewPatientModal.set(false);
  }

  saveNewPatient(): void {
    if (!this.newPatientForm.firstName || !this.newPatientForm.lastName) return;
    this.savingPatient.set(true);
    const request = {
      firstName: this.newPatientForm.firstName,
      lastName: this.newPatientForm.lastName,
      email: this.newPatientForm.email || undefined,
      telefon: this.newPatientForm.telefon || undefined,
      dateOfBirth: this.newPatientForm.dateOfBirth || undefined,
      insuranceType: this.newPatientForm.insuranceType || undefined,
      street: this.newPatientForm.street || undefined,
      houseNumber: this.newPatientForm.houseNumber || undefined,
      postalCode: this.newPatientForm.postalCode || undefined,
      city: this.newPatientForm.city || undefined,
      notes: this.newPatientForm.notes || undefined,
      isActive: this.newPatientForm.isActive !== undefined ? this.newPatientForm.isActive : true,
      isBWO: this.newPatientForm.isBWO
    };

    this.patientService.create(request).subscribe({
      next: (patient) => {
        this.savingPatient.set(false);
        this.toast.success(`Patient ${patient.firstName} ${patient.lastName} angelegt`);
        this.patients = [...this.patients, patient];
        this.selectedPatient = patient;
        this.form.patientId = patient.id;
        // ensure patient name is shown in the input immediately
        const full = `${patient.firstName} ${patient.lastName}`.trim();
        this.patientSearchTerm = full;
        this.patientQuery = full;
        this.showNewPatientModal.set(false);
      },
      error: () => {
        this.savingPatient.set(false);
        this.toast.error('Fehler beim Anlegen des Patienten');
      }
    });
  }

  // Print patient appointments (reuse printService)
  printPatientAppointments(): void {
    const pid = this.form.patientId;
    if (!pid) return;
    this.appointmentService.getByPatient(pid).subscribe({
      next: (appointments) => {
        const today = new Date().toISOString().split('T')[0];
        const upcomingAppointments = (appointments || [])
          .filter(a => a.date >= today && a.status !== 'CANCELLED')
          .map(a => ({ id: a.id, date: a.date, startTime: a.startTime, endTime: a.endTime, patientName: a.patientName || '', therapistName: a.therapistName || '', status: a.status }));
        if (upcomingAppointments.length) {
          this.printService.printAppointments(this.selectedPatient?.fullName || 'Patient', upcomingAppointments as any);
        } else {
          this.toast.info('Keine kommenden Termine zum Drucken vorhanden');
        }
      }
    });
  }

  private toIso(dateStr: string, timeStr: string): string {
    // dateStr: yyyy-mm-dd, timeStr: HH:MM
    const iso = new Date(dateStr + 'T' + timeStr + ':00');
    return iso.toISOString();
  }

  // ======= Series + single save (mirrors DailyList behavior) =======
  onSaveClick(): void {
    if (!this.canSaveAppointment()) return;

    // clear any previous conflict details before attempting save
    this.conflictDetails = null;
    this.conflictMessage = null;

    // If editing an appointment that belongs to a series and user chose series edit -> confirm
    if (this.appointmentId && (this.form.isSeries || (this.editMode === 'series'))) {
      // show confirmation before touching series master
      if (this.editMode === 'series') {
        this.showSeriesEditConfirmModal.set(true);
        return;
      }
    }

    this.saveAppointment();
  }

  confirmSeriesEdit(): void {
    this.showSeriesEditConfirmModal.set(false);
    this.saveAppointment();
  }

  cancelSeriesEdit(): void {
    this.showSeriesEditConfirmModal.set(false);
  }

  private saveAppointment(force = false): void {
    if (!this.canSaveAppointment()) return;
    this.savingAppointment.set(true);

    // If editing existing appointment
    if (this.appointmentId) {
      // If appointment belongs to series and editMode === 'series' -> update series master
      if (this.editMode === 'series' && (this.form.isSeries || true)) {
        const seriesId = (this.appointmentId && undefined) || undefined; // we'll attempt to derive series id by fetching appointment first
        // fetch appointment to decide
        this.appointmentService.getById(this.appointmentId).subscribe({
          next: apt => {
            const sid = apt.appointmentSeriesId;
            if (sid) {
              const request = {
                startTime: `${this.form.date}T${this.form.startTime}:00.000`,
                endTime: `${this.form.date}T${this.form.endTime}:00.000`,
                comment: this.form.comment || undefined,
                isHotair: this.form.isHotair,
                isUltrasonic: this.form.isUltrasonic,
                isElectric: this.form.isElectric,
                endDate: this.seriesEditEndDate ? `${this.seriesEditEndDate}T00:00:00.000` : undefined,
                weeklyFrequency: this.seriesEditWeeklyFrequency
              };
              this.seriesService.update(sid, request).subscribe({
                next: () => {
                  this.savingAppointment.set(false);
                  this.toast.success('Serientermin erfolgreich aktualisiert');
                  this.saved.emit({ seriesUpdated: true });
                  this.onClose();
                },
                error: () => {
                  this.savingAppointment.set(false);
                  this.toast.error('Fehler beim Aktualisieren des Serientermins');
                }
              });
            } else {
              // fallback to single update
              this.updateExistingAppointment(this.appointmentId!, force);
            }
          },
          error: () => {
            this.savingAppointment.set(false);
            this.toast.error('Fehler beim Laden des Termins');
          }
        });
        return;
      }

      // otherwise update single appointment
      this.updateExistingAppointment(this.appointmentId, force);
      return;
    }

    // Create new (series or single)
    if (this.form.isSeries) {
      this.saveSeriesAppointment(force);
    } else {
      this.saveSingleAppointment(force);
    }
  }

  private updateExistingAppointment(id: number, force = false): void {
    const dateStr = this.form.date;
    const request: CreateAppointmentRequest = {
      therapistId: this.form.therapistId!,
      patientId: this.form.patientId!,
      date: `${dateStr}T00:00:00.000`,
      startTime: `${dateStr}T${this.form.startTime}:00.000`,
      endTime: `${dateStr}T${this.form.endTime}:00.000`,
      comment: this.form.comment || undefined,
      isHotair: this.form.isHotair,
      isUltrasonic: this.form.isUltrasonic,
      isElectric: this.form.isElectric
    };

    this.appointmentService.update(id, request, force).subscribe({
      next: (result) => {
        this.savingAppointment.set(false);
        if (result.saved) {
          this.toast.success('Termin erfolgreich aktualisiert');
          this.saved.emit(result.appointment);
          this.onClose();
        } else if (result.conflictCheck?.hasConflicts) {
          // show conflict details (deduped, skip possible self-conflict)
          this.conflictDetails = this.normalizeConflicts(result.conflictCheck.conflicts || null);
          this.conflictMessage = this.conflictDetails?.[0]?.message || result.conflictCheck.conflicts?.[0]?.message || 'Konflikt erkannt';
        }
      },
      error: (err) => {
        this.savingAppointment.set(false);
        if (err.status === 409) {
          // try to extract conflict details if backend provided them (dedupe & filter self-conflicts)
          this.conflictDetails = this.normalizeConflicts(err.error?.conflictCheck?.conflicts || err.error?.conflicts || null);
          this.conflictMessage = this.conflictDetails?.[0]?.message || err.error?.message || 'Konflikt erkannt';
        } else {
          this.toast.error('Fehler beim Aktualisieren des Termins');
        }
      }
    });
  }

  private saveSingleAppointment(force = false): void {
    const dateStr = this.form.date;
    const request: CreateAppointmentRequest = {
      therapistId: this.form.therapistId!,
      patientId: this.form.patientId!,
      date: `${dateStr}T00:00:00.000`,
      startTime: `${dateStr}T${this.form.startTime}:00.000`,
      endTime: `${dateStr}T${this.form.endTime}:00.000`,
      comment: this.form.comment || undefined,
      isHotair: this.form.isHotair,
      isUltrasonic: this.form.isUltrasonic,
      isElectric: this.form.isElectric
    };

    this.appointmentService.create(request, force).subscribe({
      next: (result) => {
        this.savingAppointment.set(false);
        if (result.saved) {
          this.toast.success('Termin erfolgreich angelegt');
          this.saved.emit(result.appointment);
          this.onClose();
        } else if (result.conflictCheck?.hasConflicts) {
          // show conflict details (deduped) and allow user to force-save
          this.conflictDetails = this.normalizeConflicts(result.conflictCheck.conflicts || null);
          this.conflictMessage = this.conflictDetails?.[0]?.message || result.conflictCheck.conflicts?.[0]?.message || 'Konflikt erkannt';
        }
      },
      error: (err) => {
        this.savingAppointment.set(false);
        if (err.status === 409) {
          this.conflictDetails = this.normalizeConflicts(err.error?.conflictCheck?.conflicts || err.error?.conflicts || null);
          this.conflictMessage = this.conflictDetails?.[0]?.message || err.error?.message || 'Konflikt erkannt';
        } else {
          this.toast.error('Fehler beim Anlegen des Termins');
        }
      }
    });
  }

  private saveSeriesAppointment(force = false): void {
    const f = this.form;
    const startDateStr = f.date;
    const endDateStr = f.seriesEndDate;

    const createRequest = {
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

    // If modal opened for editing an existing series (seriesId provided), perform update instead
    const sid = this.seriesId || this.editingSeriesId;
    if (sid) {
      const refDate = new Date().toISOString().split('T')[0];
      const updateRequest: any = {
        startTime: `${refDate}T${f.startTime}:00.000`,
        endTime: `${refDate}T${f.endTime}:00.000`,
        comment: f.comment || undefined,
        isHotair: f.isHotair,
        isUltrasonic: f.isUltrasonic,
        isElectric: f.isElectric,
        endDate: f.seriesEndDate ? `${f.seriesEndDate}T00:00:00.000` : undefined,
        weeklyFrequency: f.weeklyFrequency
      };

      this.seriesService.update(sid, updateRequest).subscribe({
        next: () => {
          this.savingAppointment.set(false);
          this.toast.success('Serientermin erfolgreich aktualisiert');
          this.saved.emit({ seriesUpdated: true });
          this.onClose();
        },
        error: () => {
          this.savingAppointment.set(false);
          this.toast.error('Fehler beim Aktualisieren des Serientermins');
        }
      });
      return;
    }

    // otherwise create new series
    this.seriesService.create(createRequest).subscribe({
      next: () => {
        this.savingAppointment.set(false);
        this.toast.success('Serientermin erfolgreich angelegt');
        this.saved.emit({ seriesCreated: true });
        this.onClose();
      },
      error: () => {
        this.savingAppointment.set(false);
        this.toast.error('Fehler beim Anlegen des Serietermins');
      }
    });
  }
}
