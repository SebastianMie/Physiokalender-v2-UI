import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { AppointmentService, Appointment, PageResponse, AppointmentExtendedPageParams } from '../../data-access/api/appointment.service';
import { AbsenceService, Absence, CreateAbsenceRequest } from '../../data-access/api/absence.service';
import { ToastService } from '../../core/services/toast.service';
import { AppointmentModalComponent } from '../appointments/appointment-modal.standalone.component';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-therapist-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AppointmentModalComponent],
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
          <div class="card form-card">
            <div class="card-title-row">
              <h2>Stammdaten</h2>
              @if (!editMode()) {
                <button class="btn-edit-toggle" (click)="toggleEditMode()">✏️ Bearbeiten</button>
              }
            </div>

            <div class="form-section">
              @if (editMode()) {
                <!-- Edit Mode -->
                <div class="form-group">
                  <label>Vorname</label>
                  <input type="text" [(ngModel)]="therapistForm.firstName" />
                </div>
                <div class="form-group">
                  <label>Nachname</label>
                  <input type="text" [(ngModel)]="therapistForm.lastName" />
                </div>
                <div class="form-group">
                  <label>E-Mail</label>
                  <input type="email" [(ngModel)]="therapistForm.email" />
                </div>
                <div class="form-group">
                  <label>Telefon</label>
                  <input type="tel" [(ngModel)]="therapistForm.telefon" />
                </div>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="therapistForm.isActive" />
                  Aktiv
                </label>

                <div class="form-divider"></div>

                <div class="form-actions">
                  <button class="btn-cancel" (click)="cancelEdit()">Abbrechen</button>
                  <button class="btn-save" (click)="saveTherapist()" [disabled]="saving()">
                    {{ saving() ? 'Speichern...' : 'Speichern' }}
                  </button>
                </div>
              } @else {
                <!-- Read-Only Mode -->
                <div class="info-row">
                  <label>Vorname</label>
                  <span class="info-value">{{ therapist()?.firstName || '-' }}</span>
                </div>
                <div class="info-row">
                  <label>Nachname</label>
                  <span class="info-value">{{ therapist()?.lastName || '-' }}</span>
                </div>
                <div class="info-row">
                  <label>E-Mail</label>
                  <span class="info-value">{{ therapist()?.email || '-' }}</span>
                </div>
                <div class="info-row">
                  <label>Telefon</label>
                  <span class="info-value">{{ therapist()?.telefon || '-' }}</span>
                </div>
                <div class="info-row">
                  <label>Status</label>
                  <span class="info-value" [class.status-active]="therapist()?.isActive" [class.status-inactive]="!therapist()?.isActive">
                    {{ therapist()?.isActive ? 'Aktiv' : 'Inaktiv' }}
                  </span>
                </div>

                <div class="form-divider"></div>

                <div class="info-row">
                  <label>Erstellt am</label>
                  <span class="info-value">{{ therapist()?.createdAt ? formatDateTimeDE(therapist()!.createdAt!) : '-' }}</span>
                </div>
                <div class="info-row">
                  <label>Geändert am</label>
                  <span class="info-value">{{ therapist()?.modifiedAt ? formatDateTimeDE(therapist()!.modifiedAt!) : '-' }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Appointments Card -->
          <div class="card appointments-card">
            <div class="card-header">
              <h2>Termine</h2>
              <span class="result-count">{{ totalAppointments() }}</span>
            </div>

            <div class="table-controls">
              <div class="apt-filters">
                <div class="filter-tabs">
                  <button [class.active]="appointmentFilter() === 'upcoming'" (click)="setAppointmentFilter('upcoming')">Kommende</button>
                  <button [class.active]="appointmentFilter() === 'past'" (click)="setAppointmentFilter('past')">Vergangene</button>
                  <button [class.active]="appointmentFilter() === 'all'" (click)="setAppointmentFilter('all')">Alle</button>
                </div>
                <div class="filter-tabs">
                  <button [class.active]="appointmentTypeFilter() === 'all'" (click)="setAppointmentTypeFilter('all')">Alle</button>
                  <button [class.active]="appointmentTypeFilter() === 'series'" (click)="setAppointmentTypeFilter('series')">Serie</button>
                  <button [class.active]="appointmentTypeFilter() === 'single'" (click)="setAppointmentTypeFilter('single')">Einzel</button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Patient suchen..."
                [value]="appointmentSearchTerm()"
                (input)="onAppointmentSearchInput($event)"
                class="search-input"
              />
            </div>

            @if (loadingAppointments()) {
              <div class="loading-inline">
                <div class="loading-spinner-small"></div>
                Termine werden geladen...
              </div>
            } @else if (serverAppointments().length === 0) {
              <div class="empty-state">Keine Termine gefunden</div>
            } @else {
              <div class="table-wrapper">
                <table class="apt-table">
                  <thead>
                    <tr>
                      <th class="sortable" (click)="sortAppointments('date')">
                        Datum <span class="sort-icon">{{ appointmentSortField() === 'date' ? (appointmentSortDir() === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th>Zeit</th>
                      <th class="sortable" (click)="sortAppointments('patient')">
                        Patient <span class="sort-icon">{{ appointmentSortField() === 'patient' ? (appointmentSortDir() === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th>Typ</th>
                      <th class="col-status">Status</th>
                      <th>Kommentar</th>
                      <th class="col-actions">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (apt of serverAppointments(); track apt.id) {
                      <tr [class.cancelled]="apt.status === 'CANCELLED'"
                          [class.completed]="apt.status === 'COMPLETED'"
                          (click)="openAppointmentModal(apt)">
                        <td class="col-date">{{ formatDateDE(apt.date) }}</td>
                        <td class="col-time">{{ formatTimeShort(apt.startTime) }}–{{ formatTimeShort(apt.endTime) }} Uhr</td>
                        <td>
                          <a [routerLink]="['/dashboard/patients', apt.patientId]" (click)="$event.stopPropagation()">{{ apt.patientName }}</a>
                        </td>
                        <td>
                          <div class="type-tags">
                            @if (apt.createdBySeriesAppointment || apt.appointmentSeriesId) {
                              <span class="tag series">Serie</span>
                            } @else {
                              <span class="tag single">Einzel</span>
                            }
                            @if (apt.isBWO) { <span class="tag bwo">BWO</span> }
                          </div>
                        </td>
                        <td class="col-status">
                          <div class="status-cell">
                            <button class="status-badge" [class]="'status-' + apt.status.toLowerCase()" (click)="$event.stopPropagation(); openStatusMenuApt(apt.id)" title="Status ändern">
                              {{ getStatusLabel(apt.status) }}
                            </button>
                            @if (openStatusMenuIdApt === apt.id) {
                              <div class="status-dropdown-menu" (click)="$event.stopPropagation()">
                                <button class="status-option status-scheduled" (click)="updateAppointmentStatus(apt.id, 'SCHEDULED')">Geplant</button>
                                <button class="status-option status-confirmed" (click)="updateAppointmentStatus(apt.id, 'CONFIRMED')">Bestätigt</button>
                                <button class="status-option status-cancelled" (click)="updateAppointmentStatus(apt.id, 'CANCELLED')">Storniert</button>
                              </div>
                            }
                          </div>
                        </td>
                        <td class="col-comment">{{ apt.comment || '–' }}</td>
                        <td class="col-actions">
                          <button class="btn-action" title="Im Kalender anzeigen" (click)="$event.stopPropagation(); navigateToDay(apt.date)">📅</button>
                          <button class="btn-delete-apt" (click)="$event.stopPropagation(); confirmDeleteAppointment(apt.id)" title="Termin löschen">🗑️</button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <!-- Pagination Footer -->
              <div class="pagination-footer">
                <span class="pagination-info">{{ paginationStart() }}-{{ paginationEnd() }} von {{ totalAppointments() }}</span>
                <div class="pagination-buttons">
                  <button [disabled]="appointmentPage() === 0 || loadingAppointments()" (click)="previousAppointmentPage()" class="btn-pagination">←</button>
                  <span class="page-number">{{ appointmentPage() + 1 }} / {{ totalAppointmentPages() || 1 }}</span>
                  <button [disabled]="appointmentPage() >= totalAppointmentPages() - 1 || loadingAppointments()" (click)="nextAppointmentPage()" class="btn-pagination">→</button>
                </div>
              </div>
            }
          </div>

          <!-- Absences Card -->
          <div class="card absences-card">
            <div class="card-header">
              <h2>Abwesenheiten</h2>
              <div class="header-actions">
                <button class="btn-add" (click)="openAddAbsenceModal()">+ Neu</button>
                <div class="filter-tabs">
                <button
                  [class.active]="absenceFilter() === 'recurring'"
                  (click)="setAbsenceFilter('recurring')">
                  Regelmäßig
                </button>
                <button
                  [class.active]="absenceFilter() === 'special'"
                  (click)="setAbsenceFilter('special')">
                  Einmalig
                </button>
              </div>
              </div>
            </div>

            @if (loadingAbsences()) {
              <div class="loading-inline">Abwesenheiten werden geladen...</div>
            } @else if (filteredAbsences().length === 0) {
              <div class="empty-state">Keine Abwesenheiten gefunden</div>
            } @else {
              <div class="absences-list">
              <!-- Recurring: grouped by weekday Mon→Fri, time‑sorted -->
              @if ((absenceFilter() === 'recurring' || absenceFilter() === 'all') && recurringByWeekdayGroups().length > 0) {
                @for (group of recurringByWeekdayGroups(); track group.weekday) {
                  <div class="weekday-group">
                    <div class="weekday-header" (click)="toggleWeekdayCollapse(group.weekday)">
                      <button class="collapse-btn" [class.collapsed]="collapsedWeekdays().has(group.weekday)">{{ collapsedWeekdays().has(group.weekday) ? '▶' : '▼' }}</button>
                      <span class="weekday-name">{{ group.label }}</span>
                      <span class="weekday-count">{{ group.absences.length }}</span>
                    </div>

                    @if (!collapsedWeekdays().has(group.weekday)) {
                      @for (absence of group.absences; track absence.id) {
                        <div class="absence-item recurring">
                          <div class="absence-info">
                            <span class="absence-day">{{ group.label }}</span>
                            <span class="absence-time">
                              <span *ngIf="absence.startTime && absence.endTime">{{ formatTime(absence.startTime) }} - {{ formatTime(absence.endTime) }}</span>
                              <span *ngIf="!(absence.startTime && absence.endTime)">Ganztags</span>
                            </span>
                          </div>
                          <div class="absence-details"><span class="absence-reason">{{ absence.reason }}</span></div>
                          <div class="absence-actions">
                            <button class="btn-icon-edit" (click)="openEditAbsenceModal(absence)" title="Bearbeiten">✏️</button>
                            <button class="btn-icon-trash" (click)="confirmDeleteAbsence(absence)" title="Löschen">🗑️</button>
                          </div>
                        </div>
                      }
                    }
                  </div>
                }
              }

              <!-- Special (one-time) - future chronological (falls angezeigt) -->
              @if ((absenceFilter() === 'special' || absenceFilter() === 'all') && specialFutureAbsencesTherapist().length > 0) {
                <div class="section">
                  @for (absence of specialFutureAbsencesTherapist(); track absence.id) {
                    <div class="absence-item special">
                      <div class="absence-info">
                        <span class="absence-day">
                          {{ formatDate(absence.date!) }}
                          <ng-container *ngIf="absence.endDate && absence.endDate !== absence.date"> - {{ formatDate(absence.endDate) }}</ng-container>
                        </span>
                        <span class="absence-time"><span *ngIf="absence.startTime && absence.endTime">{{ formatTime(absence.startTime) }} - {{ formatTime(absence.endTime) }}</span><span *ngIf="!(absence.startTime && absence.endTime)">Ganztags</span></span>
                      </div>
                      <div class="absence-details"><span class="absence-reason">{{ absence.reason || 'Kein Grund angegeben' }}</span></div>
                      <div class="absence-actions">
                        <button class="btn-icon-edit" (click)="openEditAbsenceModal(absence)" title="Bearbeiten">✏️</button>
                        <button class="btn-icon-trash" (click)="confirmDeleteAbsence(absence)" title="Löschen">🗑️</button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
            }
          </div>
        </div>
      } @else {
        <div class="error">Therapeut nicht gefunden</div>
      }



      <!-- Absence Modal -->
      @if (showAbsenceModal) {
        <div class="modal-overlay" (click)="closeAbsenceModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>{{ editingAbsenceId ? 'Abwesenheit bearbeiten' : 'Neue Abwesenheit' }}</h2>
            <form (ngSubmit)="saveAbsence()">
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
                <button type="button" class="btn-secondary" (click)="closeAbsenceModal()">Abbrechen</button>
                <button type="submit" class="btn btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Delete Absence Confirmation -->
      @if (showDeleteAbsenceModal) {
        <div class="modal-overlay" (click)="showDeleteAbsenceModal = false">
          <div class="modal modal-sm" (click)="$event.stopPropagation()">
            <h2>Abwesenheit löschen?</h2>
            <p>Möchten Sie diese Abwesenheit wirklich löschen?</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showDeleteAbsenceModal = false">Abbrechen</button>
              <button class="btn-danger" (click)="deleteAbsence()">Löschen</button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Appointment Confirmation -->
      @if (showDeleteAppointmentModal) {
        <div class="modal-overlay" (click)="showDeleteAppointmentModal = false">
          <div class="modal modal-sm" (click)="$event.stopPropagation()">
            <h2>Termin löschen?</h2>
            <p class="modal-warning">Möchten Sie diesen Termin wirklich löschen?</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showDeleteAppointmentModal = false">Abbrechen</button>
              <button class="btn-danger" (click)="deleteAppointment()">Löschen</button>
            </div>
          </div>
        </div>
      }

      <!-- Appointment Edit Modal -->
      @if (showAppointmentModal && selectedAppointment) {
        <app-appointment-modal
          [appointmentId]="selectedAppointment.id"
          (close)="showAppointmentModal = false; selectedAppointment = null"
          (appointmentChanged)="onAppointmentChanged()"
        ></app-appointment-modal>
      }
    </div>
  `,
  styles: [`
    .detail-container { padding: 1.5rem; max-width: 1400px; margin: 0 auto; height: 100%; display: flex; flex-direction: column; }
    .header-section { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; }
    .back-btn { background: none; border: 1px solid #E5E7EB; padding: 0.4rem 0.75rem; border-radius: 6px; cursor: pointer; color: #6B7280; font-size: 0.8rem; }
    .back-btn:hover { background: #F3F4F6; color: #374151; }
    h1 { margin: 0; font-size: 1.35rem; color: #111827; }
    .loading, .error { text-align: center; padding: 3rem; color: #6B7280; }
    .error { color: #DC2626; }

    .content-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 1.25rem; flex: 1; overflow: hidden; }
    @media (max-width: 1000px) { .content-grid { grid-template-columns: 1fr; overflow: auto; } }

    .info-card { grid-column: 1; grid-row: 1; min-height: 500px; }
    .appointments-card { grid-column: 2; grid-row: 1 / 3; display: flex; flex-direction: column; overflow: hidden; }
    .absences-card { grid-column: 1; grid-row: 2; display: flex; flex-direction: column; overflow: hidden; min-height: 250px; }

    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden; display: flex; flex-direction: column; }
    .card h2 { margin: 0; font-size: 1rem; color: #2563EB; }

    /* Form Card */
    .form-card { overflow-y: auto; }
    .card-title-row { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid #F3F4F6; }
    .form-section { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .form-divider { height: 1px; background: #F3F4F6; margin: 0.25rem 0; }
    .form-group { display: flex; flex-direction: column; gap: 0.2rem; }
    .form-group label { font-size: 0.7rem; color: #6B7280; font-weight: 500; }
    .form-group input, .form-group textarea { padding: 0.4rem 0.5rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.8rem; outline: none; color: #111827; background: white; font-family: inherit; }
    .form-group input:focus, .form-group textarea:focus { border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.12); }
    .checkbox-label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: #374151; cursor: pointer; }
    .checkbox-label input { accent-color: #3B82F6; }
    .form-actions { padding-top: 0.5rem; display: flex; justify-content: space-between; }
    .btn-save { padding: 0.45rem 1.25rem; background: #2563EB; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500; }
    .btn-save:hover { background: #1D4ED8; }
    .btn-save:disabled { opacity: 0.6; cursor: default; }
    .btn-cancel { padding: 0.45rem 1rem; background: white; color: #6B7280; border: 1px solid #D1D5DB; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500; }
    .btn-cancel:hover { background: #F3F4F6; }
    .btn-edit-toggle { background: none; border: 1px solid #D1D5DB; padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.75rem; color: #6B7280; }
    .btn-edit-toggle:hover { background: #F3F4F6; color: #374151; border-color: #9CA3AF; }

    /* Info Rows */
    .info-grid { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .info-row { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.25rem 0; }
    .info-row label { font-size: 0.7rem; color: #6B7280; font-weight: 500; }
    .info-value { font-size: 0.85rem; color: #111827; }
    .info-value.status-active { color: #059669; font-weight: 500; }
    .info-value.status-inactive { color: #DC2626; font-weight: 500; }

    /* Card Header */
    .card-header { display: flex; align-items: center; gap: 0.6rem; padding: 1rem 1.25rem; border-bottom: 1px solid #F3F4F6; flex-shrink: 0; }
    .result-count { font-size: 0.7rem; color: #6B7280; background: #E5E7EB; padding: 0.1rem 0.4rem; border-radius: 10px; margin-right: auto; }
    /* filter tab styling moved to global.scss (.filter-tabs) */

    .loading-inline, .empty-state { text-align: center; padding: 2rem; color: #6B7280; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
    .loading-spinner-small { width: 16px; height: 16px; border: 2px solid #E5E7EB; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Pagination */
    .pagination-footer { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; border-top: 1px solid #E5E7EB; background: #F9FAFB; font-size: 0.75rem; }
    .pagination-info { color: #6B7280; }
    .pagination-buttons { display: flex; align-items: center; gap: 0.5rem; }
    .btn-pagination { background: white; border: 1px solid #D1D5DB; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; }
    .btn-pagination:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-pagination:not(:disabled):hover { background: #F3F4F6; }
    .page-number { color: #374151; font-weight: 500; min-width: 60px; text-align: center; }

    /* Table Styles */
    .table-wrapper { flex: 1; overflow: auto; }
    .apt-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .apt-table thead { position: sticky; top: 0; z-index: 1; }
    .apt-table th { background: #F9FAFB; padding: 0.5rem 0.6rem; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #E5E7EB; white-space: nowrap; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .apt-table th.sortable { cursor: pointer; user-select: none; }
    .apt-table th.sortable:hover { background: #F3F4F6; }
    .sort-icon { margin-left: 4px; color: #9CA3AF; }
    .apt-table td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #F3F4F6; color: #374151; vertical-align: middle; }

    /* Search Bar */
    /* search styling moved to global.scss (.table-controls .search-input) */
    .apt-table tbody tr { cursor: pointer; transition: background 0.1s; }
    .apt-table tbody tr:hover { background: #F0F7FF; }
    .apt-table tbody tr.cancelled { opacity: 0.5; }
    .apt-table tbody tr.completed td { color: #6B7280; }
    .col-date { white-space: nowrap; }
    .col-time { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .col-comment { max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #9CA3AF; font-size: 0.7rem; }
    .apt-table a { color: #3B82F6; text-decoration: none; font-weight: 500; }
    .apt-table a:hover { text-decoration: underline; }

    /* Type Tags */
    .type-tags { display: flex; gap: 3px; }
    .tag { display: inline-block; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.6rem; font-weight: 600; }
    .tag.series { background: #EDE9FE; color: #5B21B6; }
    .tag.single { background: #E5E7EB; color: #6B7280; }
    .tag.bwo { background: #FEF3C7; color: #92400E; }

    /* Status Badge */
    .status-badge { font-size: 0.6rem; padding: 0.1rem 0.35rem; border-radius: 3px; font-weight: 500; white-space: nowrap; border: none; }
    .status-scheduled { background: #DBEAFE; color: #1E40AF; }
    .status-confirmed { background: #D1FAE5; color: #065F46; }
    .status-cancelled { background: #FEE2E2; color: #991B1B; }
    .status-completed { background: #E5E7EB; color: #374151; }
    .status-no_show { background: #FEF3C7; color: #92400E; }

    /* Absences Styles */
    .absences-list { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.5rem 1rem; flex: 1; min-height: 0; overflow-y: auto; }
    .absence-item { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; padding: 0.25rem; border: 1px solid #E5E7EB; border-radius: 6px; align-items: center; font-size: 0.75rem; }
    .absence-item.recurring { border-left: 3px solid #8B5CF6; }
    .absence-info { display: flex; flex-direction: row; align-items: center; gap: 0.4rem; }
    .absence-day { font-weight: 500; color: #111827; font-size: 0.75rem; white-space: nowrap; }
    .absence-time { font-size: 0.65rem; color: #6B7280; white-space: nowrap; }
    .absence-details { display: none; }
    .absence-reason { font-size: 0.7rem; color: #374151; }
    .absence-type { display: flex; align-items: center; gap: 0.4rem; }

    .type-badge { padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.6rem; font-weight: 500; text-transform: uppercase; }
    .type-badge.recurring { background: #EDE9FE; color: #7C3AED; }
    .type-badge.special { background: #FEF3C7; color: #92400E; }

    /* Action Buttons */
    .btn-edit { background: none; border: 1px solid #E5E7EB; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.7rem; color: #6B7280; margin-left: auto; }
    .btn-edit:hover { background: #F3F4F6; color: #374151; }
    .btn-add { background: #3B82F6; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: 500; }
    .btn-add:hover { background: #2563EB; }
    .header-actions { display: flex; align-items: center; gap: 0.5rem; }
    .btn-icon { background: none; border: none; cursor: pointer; padding: 0.15rem; font-size: 0.7rem; opacity: 0.4; transition: opacity 0.2s; }
    .btn-icon:hover { opacity: 1; }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    }

    .modal-sm {
      max-width: 400px;
    }

    .modal h2 {
      margin: 0 0 1.5rem 0;
      color: #1F2937;
      font-size: 1.25rem;
    }

    .modal p {
      color: #6B7280;
      margin-bottom: 1.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
      color: #374151;
      font-size: 0.875rem;
    }

    .form-group input, .form-group select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      font-size: 0.875rem;
      box-sizing: border-box;
    }

    .form-group input:focus, .form-group select:focus {
      outline: none;
      border-color: #3B82F6;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
    }

    .checkbox-group label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .checkbox-group input[type="checkbox"] {
      width: 1rem;
      height: 1rem;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }

    .time-row-centered {
      justify-content: center;
    }

    .time-group {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .time-hpicker {
      display: flex;
      align-items: center;
      gap: 0.15rem;
      background: #F9FAFB;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      padding: 0.4rem 0.5rem;
    }

    .tp-value {
      font-size: 1.15rem;
      font-weight: 600;
      color: #111827;
      min-width: 32px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .tp-scrollable {
      cursor: pointer;
      user-select: none;
    }

    .tp-scrollable:hover {
      background: #E5E7EB;
      border-radius: 4px;
    }

    .tp-colon {
      font-size: 1.1rem;
      font-weight: 700;
      color: #9CA3AF;
      margin: 0 0.1rem;
    }

    .tp-label {
      font-size: 0.75rem;
      color: #9CA3AF;
      font-weight: 500;
      margin-left: 0.2rem;
    }

    .weekday-group {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      margin-bottom: 0.4rem;
      overflow: hidden;
    }

    .weekday-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.35rem 0.8rem;
      background: linear-gradient(to right, #DBEAFE, #EFF6FF);
      border-bottom: 1px solid #BFDBFE;
      cursor: pointer;
    }

    .weekday-header:hover {
      background: linear-gradient(to right, #BFDBFE, #DBEAFE);
    }

    .weekday-name {
      font-weight: 700;
      color: #1E40AF;
      font-size: 0.9rem;
      flex: 1;
    }

    .weekday-count {
      background: #1E40AF;
      color: white;
      padding: 0.125rem 0.4rem;
      border-radius: 8px;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .collapse-btn {
      background: none;
      border: none;
      font-size: 0.8rem;
      color: #1E40AF;
      cursor: pointer;
      padding: 0.125rem;
      margin-right: 0.5rem;
      transition: transform 0.2s;
    }

    .btn-primary {
      background: #3B82F6;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }

    .btn-primary:hover {
      background: #2563EB;
    }

    .btn-secondary {
      background: #E5E7EB;
      color: #374151;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }

    .btn-secondary:hover {
      background: #D1D5DB;
    }

    .btn-danger {
      background: #EF4444;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }

    .btn-danger:hover {
      background: #DC2626;
    }

    /* Status Dropdown & Delete Button in Appointment Table */
    .col-status { width: 130px; }
    .col-actions { width: 70px; display: flex; gap: 0.25rem; align-items: center; }
    .status-cell { position: relative; display: flex; align-items: center; gap: 0.25rem; }
    .status-dropdown-btn { background: none; border: none; padding: 0.2rem 0.4rem; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; color: #374151; transition: background 0.2s; }
    .status-dropdown-btn:hover { background: #EFF6FF; }
    .status-dropdown-menu { position: absolute; top: 100%; left: 0; background: white; border: 1px solid #E5E7EB; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); z-index: 100; min-width: 130px; }
    .status-option { padding: 0.4rem 0.6rem; cursor: pointer; font-size: 0.75rem; border: none; background: none; width: 100%; text-align: left; display: flex; align-items: center; gap: 0.4rem; transition: background 0.15s; }
    .status-option:hover { background: #F3F4F6; }
    .status-option.status-scheduled { color: #1E40AF; }
    .status-option.status-confirmed { color: #065F46; }
    .status-option.status-cancelled { color: #991B1B; }
    .btn-delete-apt { background: none; border: none; color: #9CA3AF; padding: 0.2rem 0.3rem; font-size: 1rem; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: color 0.2s, background 0.2s; }
    .btn-delete-apt:hover { color: #DC2626; background: rgba(220,38,38,0.06); }
    .btn-action { background: none; border: none; color: #9CA3AF; padding: 0.2rem 0.3rem; font-size: 1rem; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: color 0.2s, background 0.2s; }
    .btn-action:hover { color: #3B82F6; background: rgba(59,130,246,0.06); }
  `]
})
export class TherapistDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private therapistService = inject(TherapistService);
  private appointmentService = inject(AppointmentService);
  private absenceService = inject(AbsenceService);
  private toast = inject(ToastService);

  // Cleanup
  private destroy$ = new Subject<void>();
  private therapistId: number | null = null;

  therapist = signal<Therapist | null>(null);
  absences = signal<Absence[]>([]);
  loading = signal(true);
  loadingAppointments = signal(true);
  loadingAbsences = signal(true);
  editMode = signal(false);
  saving = signal(false);
  appointmentFilter = signal<'upcoming' | 'past' | 'all'>('upcoming');
  appointmentTypeFilter = signal<'all' | 'series' | 'single'>('all');
  absenceFilter = signal<'recurring' | 'special' | 'all'>('recurring');

  // Weekday grouping (for recurring absences)
  readonly weekdayOrder = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
  readonly weekdayLabels: { [key: string]: string } = { 'MONDAY':'Montag','TUESDAY':'Dienstag','WEDNESDAY':'Mittwoch','THURSDAY':'Donnerstag','FRIDAY':'Freitag','SATURDAY':'Samstag','SUNDAY':'Sonntag' };
  collapsedWeekdays = signal<Set<string>>(new Set());

  // Server-side pagination for appointments
  private appointmentServerPage = signal<PageResponse<Appointment> | null>(null);
  appointmentPage = signal(0);
  private readonly PAGE_SIZE = 50;

  // Search and sorting for appointments
  appointmentSearchTerm = signal('');
  private appointmentSearchSubject = new Subject<string>();
  appointmentSortField = signal<'date' | 'patient'>('date');
  appointmentSortDir = signal<'asc' | 'desc'>('desc');

  // Computed from server response
  serverAppointments = computed(() => this.appointmentServerPage()?.content || []);
  totalAppointments = computed(() => this.appointmentServerPage()?.totalElements || 0);
  totalAppointmentPages = computed(() => this.appointmentServerPage()?.totalPages || 0);
  paginationStart = computed(() => {
    const page = this.appointmentServerPage();
    if (!page || page.empty) return 0;
    return page.number * page.size + 1;
  });
  paginationEnd = computed(() => {
    const page = this.appointmentServerPage();
    if (!page || page.empty) return 0;
    return page.number * page.size + page.numberOfElements;
  });

  // Modal states
  showAbsenceModal = false;
  showDeleteAbsenceModal = false;
  editingAbsenceId: number | null = null;
  absenceToDelete: Absence | null = null;
  showDeleteAppointmentModal = false;
  appointmentToDeleteId: number | null = null;
  openStatusMenuIdApt: number | null = null;
  showAppointmentModal = false;
  selectedAppointment: Appointment | null = null;

  // Therapist form
  therapistForm = {
    firstName: '',
    lastName: '',
    email: '',
    telefon: '',
    isActive: true
  };

  // Time picker constants
  startHour = 6;
  endHour = 20;
  slotMinutes = 10;

  // Absence form
  absenceForm = {
    absenceType: 'SPECIAL' as 'SPECIAL' | 'RECURRING',
    date: '',
    endDate: '',
    weekday: 'MONDAY',
    startTime: '',
    endTime: '',
    reason: ''
  };

  filteredAbsences = computed(() => {
    const abs = this.absences();
    const filter = this.absenceFilter();

    switch (filter) {
      case 'recurring':
        return abs.filter(a => a.absenceType === 'RECURRING');
      case 'special':
        return abs.filter(a => a.absenceType === 'SPECIAL');
      case 'all':
      default:
        return abs;
    }
  });

  /** Recurring absences grouped by weekday (Mon→Fri) and sorted by startTime */
  recurringByWeekdayGroups = computed(() => {
    const abs = this.absences().filter(a => a.absenceType === 'RECURRING');
    const weekdays = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
    const groups: { weekday: string; label: string; absences: Absence[] }[] = [];
    for (const weekday of weekdays) {
      const items = abs.filter(a => a.weekday === weekday).sort((x, y) => (x.startTime || '').localeCompare(y.startTime || ''));
      if (items.length > 0) groups.push({ weekday, label: this.weekdayLabels[weekday], absences: items });
    }
    return groups;
  });

  /** Future single (SPECIAL) absences, chronological */
  specialFutureAbsencesTherapist = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.absences()
      .filter(a => a.absenceType === 'SPECIAL')
      .filter(a => { const end = a.endDate || a.date || ''; return end >= today; })
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  });

  ngOnInit(): void {
    // Start weekday groups collapsed by default in therapist detail
    this.collapsedWeekdays.set(new Set(this.weekdayOrder));

    // Setup debounced search for appointments
    this.appointmentSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.appointmentSearchTerm.set(term);
      this.appointmentPage.set(0);
      this.fetchAppointments();
    });

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.therapistId = id;
      this.loadTherapist(id);
      this.fetchAppointments();
      this.loadAbsences(id);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  /**
   * Fetch appointments from server with current filters, search and pagination
   */
  fetchAppointments(): void {
    if (!this.therapistId) return;

    this.loadingAppointments.set(true);

    const timeFilter = this.appointmentFilter();
    const typeFilter = this.appointmentTypeFilter();

    // Determine sort direction: use user selection, but default to desc for past filter
    let sortDir = this.appointmentSortDir();
    if (this.appointmentSortField() === 'date' && timeFilter === 'past') {
      sortDir = 'desc';
    }

    const params: AppointmentExtendedPageParams = {
      page: this.appointmentPage(),
      size: this.PAGE_SIZE,
      sortBy: this.appointmentSortField(),
      sortDir: sortDir,
      therapistId: this.therapistId,
      timeFilter: timeFilter === 'all' ? undefined : (timeFilter as 'upcoming' | 'past'),
      appointmentType: typeFilter === 'all' ? undefined : (typeFilter as 'series' | 'single'),
      search: this.appointmentSearchTerm() || undefined
    };

    this.appointmentService.getPaginatedExtended(params).pipe(
      finalize(() => this.loadingAppointments.set(false)),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => this.appointmentServerPage.set(response),
      error: () => this.toast.error('Fehler beim Laden der Termine')
    });
  }

  // Pagination methods
  previousAppointmentPage(): void {
    if (this.appointmentPage() > 0) {
      this.appointmentPage.set(this.appointmentPage() - 1);
      this.fetchAppointments();
    }
  }

  nextAppointmentPage(): void {
    if (this.appointmentPage() < this.totalAppointmentPages() - 1) {
      this.appointmentPage.set(this.appointmentPage() + 1);
      this.fetchAppointments();
    }
  }

  loadAbsences(therapistId: number): void {
    this.absenceService.getByTherapist(therapistId).subscribe({
      next: (absences) => {
        this.absences.set(absences);
        this.loadingAbsences.set(false);
      },
      error: () => {
        this.loadingAbsences.set(false);
      }
    });
  }

  setAppointmentFilter(filter: 'upcoming' | 'past' | 'all'): void {
    this.appointmentFilter.set(filter);
    this.appointmentPage.set(0);
    this.fetchAppointments();
  }

  setAppointmentTypeFilter(filter: 'all' | 'series' | 'single'): void {
    this.appointmentTypeFilter.set(filter);
    this.appointmentPage.set(0);
    this.fetchAppointments();
  }

  /**
   * Handle search input with debounce
   */
  onAppointmentSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.appointmentSearchSubject.next(value);
  }

  /**
   * Sort appointments by column
   */
  sortAppointments(field: 'date' | 'patient'): void {
    if (this.appointmentSortField() === field) {
      this.appointmentSortDir.set(this.appointmentSortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.appointmentSortField.set(field);
      // newest-first for date, ascending for other fields
      this.appointmentSortDir.set(field === 'date' ? 'desc' : 'asc');
    }
    this.appointmentPage.set(0);
    this.fetchAppointments();
  }

  setAbsenceFilter(filter: 'recurring' | 'special' | 'all'): void {
    this.absenceFilter.set(filter);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/therapists']);
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

  /**
   * Open status menu for appointment
   */
  openStatusMenuApt(aptId: number): void {
    this.openStatusMenuIdApt = this.openStatusMenuIdApt === aptId ? null : aptId;
  }

  /**
   * Update appointment status
   */
  updateAppointmentStatus(aptId: number, newStatus: string): void {
    const statusUpdate = {
      status: newStatus as 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW',
      reason: undefined
    };

    this.appointmentService.updateStatus(aptId, statusUpdate).subscribe({
      next: () => {
        this.openStatusMenuIdApt = null;
        this.toast.success('Status aktualisiert');
        this.appointmentPage.set(0);
        this.fetchAppointments();
      },
      error: (err: any) => {
        const errMsg = err?.error?.error || 'Fehler beim Aktualisieren des Status';
        this.toast.error(`Status konnte nicht aktualisiert werden: ${errMsg}`);
      }
    });
  }

  /**
   * Confirm delete appointment
   */
  confirmDeleteAppointment(aptId: number): void {
    this.appointmentToDeleteId = aptId;
    this.showDeleteAppointmentModal = true;
  }

  /**
   * Delete appointment
   */
  deleteAppointment(): void {
    if (!this.appointmentToDeleteId) return;

    this.appointmentService.delete(this.appointmentToDeleteId).subscribe({
      next: () => {
        this.toast.success('Termin gelöscht');
        this.showDeleteAppointmentModal = false;
        this.appointmentToDeleteId = null;
        this.appointmentPage.set(0);
        this.fetchAppointments();
      },
      error: (err: any) => {
        this.toast.error('Fehler beim Löschen des Termins');
      }
    });
  }

  /**
   * Open appointment modal for editing
   */
  openAppointmentModal(apt: Appointment): void {
    this.selectedAppointment = apt;
    this.showAppointmentModal = true;
  }

  /**
   * Handle appointment changes from modal
   */
  onAppointmentChanged(): void {
    this.appointmentPage.set(0);
    this.fetchAppointments();
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

  getWeekdayLabel(weekday: string | null): string {
    if (!weekday) return '-';
    const labels: Record<string, string> = {
      'MONDAY': 'Montag',
      'TUESDAY': 'Dienstag',
      'WEDNESDAY': 'Mittwoch',
      'THURSDAY': 'Donnerstag',
      'FRIDAY': 'Freitag',
      'SATURDAY': 'Samstag',
      'SUNDAY': 'Sonntag'
    };
    return labels[weekday.toUpperCase()] || weekday;
  }

  // Toggle collapse state for weekday groups (used by the template)
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

  formatTime(timeStr: string): string {
    if (!timeStr) return '';
    // Extract time part (HH:mm or HH:mm:ss) from ISO string or return as-is
    const match = timeStr.match(/(\d{2}:\d{2})/);
    if (match) return match[1];
    return timeStr;
  }

  formatDateDE(dateStr: string): string {
    if (!dateStr) return '';
    // Extract date part (YYYY-MM-DD) to avoid timezone issues
    const dateOnly = dateStr.split('T')[0];
    if (!dateOnly || !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateStr;

    // Parse as local date and format with weekday
    const [year, month, day] = dateOnly.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
    return `${weekday} ${day}.${month}.`;
  }

  formatDateTimeDE(dateStr: string): string {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  }

  formatTimeShort(timeStr: string): string {
    if (!timeStr) return '';
    // Handle ISO timestamp format (2024-01-15T09:00:00)
    if (timeStr.includes('T')) return timeStr.split('T')[1].substring(0, 5);
    // Handle HH:mm:ss format
    return timeStr.substring(0, 5);
  }

  navigateToDay(dateStr: string): void {
    this.router.navigate(['/dashboard/calendar'], { queryParams: { date: dateStr } });
  }

  // === Therapist Edit Methods ===
  toggleEditMode(): void {
    const t = this.therapist();
    if (t) {
      this.therapistForm = {
        firstName: t.firstName || '',
        lastName: t.lastName || '',
        email: t.email || '',
        telefon: t.telefon || '',
        isActive: t.isActive ?? true
      };
      this.editMode.set(true);
    }
  }

  cancelEdit(): void {
    const t = this.therapist();
    if (t) {
      this.therapistForm = {
        firstName: t.firstName || '',
        lastName: t.lastName || '',
        email: t.email || '',
        telefon: t.telefon || '',
        isActive: t.isActive ?? true
      };
    }
    this.editMode.set(false);
  }

  saveTherapist(): void {
    const t = this.therapist();
    if (!t) return;

    this.saving.set(true);
    this.therapistService.update(t.id, this.therapistForm).subscribe({
      next: (updated) => {
        this.therapist.set(updated);
        this.therapistForm = {
          firstName: updated.firstName || '',
          lastName: updated.lastName || '',
          email: updated.email || '',
          telefon: updated.telefon || '',
          isActive: updated.isActive ?? true
        };
        this.saving.set(false);
        this.editMode.set(false);
        this.toast.success('Stammdaten aktualisiert');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Fehler beim Speichern');
      }
    });
  }

  // === Absence Methods ===
  openAddAbsenceModal(): void {
    this.editingAbsenceId = null;
    this.absenceForm = {
      absenceType: 'SPECIAL',
      date: '',
      endDate: '',
      weekday: 'MONDAY',
      startTime: '',
      endTime: '',
      reason: ''
    };
    this.showAbsenceModal = true;
  }

  openEditAbsenceModal(absence: Absence): void {
    this.editingAbsenceId = absence.id;
    this.absenceForm = {
      absenceType: absence.absenceType,
      date: absence.date ? absence.date.split('T')[0] : '',
      endDate: absence.endDate ? absence.endDate.split('T')[0] : '',
      weekday: absence.weekday || 'MONDAY',
      startTime: absence.startTime ? this.extractTime(absence.startTime) : '',
      endTime: absence.endTime ? this.extractTime(absence.endTime) : '',
      reason: absence.reason || ''
    };
    this.showAbsenceModal = true;
  }

  closeAbsenceModal(): void {
    this.showAbsenceModal = false;
    this.editingAbsenceId = null;
  }

  saveAbsence(): void {
    const t = this.therapist();
    if (!t) return;

    const request: CreateAbsenceRequest = {
      therapistId: t.id,
      absenceType: this.absenceForm.absenceType,
      reason: this.absenceForm.reason || undefined
    };

    if (this.absenceForm.absenceType === 'RECURRING') {
      request.weekday = this.absenceForm.weekday;
    } else {
      request.date = this.absenceForm.date || undefined;
      request.endDate = this.absenceForm.endDate || undefined;
    }

    if (this.absenceForm.startTime) {
      request.startTime = this.absenceForm.date
        ? `${this.absenceForm.date}T${this.absenceForm.startTime}:00`
        : `2000-01-01T${this.absenceForm.startTime}:00`;
    }
    if (this.absenceForm.endTime) {
      request.endTime = this.absenceForm.date
        ? `${this.absenceForm.date}T${this.absenceForm.endTime}:00`
        : `2000-01-01T${this.absenceForm.endTime}:00`;
    }

    const obs = this.editingAbsenceId
      ? this.absenceService.update(this.editingAbsenceId, request)
      : this.absenceService.create(request);

    obs.subscribe({
      next: () => {
        this.toast.success(this.editingAbsenceId ? 'Abwesenheit aktualisiert' : 'Abwesenheit erstellt');
        this.loadAbsences(t.id);
        this.closeAbsenceModal();
      },
      error: () => this.toast.error('Fehler beim Speichern')
    });
  }

  confirmDeleteAbsence(absence: Absence): void {
    this.absenceToDelete = absence;
    this.showDeleteAbsenceModal = true;
  }

  deleteAbsence(): void {
    if (!this.absenceToDelete) return;
    const t = this.therapist();
    if (!t) return;

    this.absenceService.delete(this.absenceToDelete.id).subscribe({
      next: () => {
        this.toast.success('Abwesenheit gelöscht');
        this.loadAbsences(t.id);
        this.showDeleteAbsenceModal = false;
        this.absenceToDelete = null;
      },
      error: () => this.toast.error('Fehler beim Löschen')
    });
  }

  private extractTime(timeStr: string): string {
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
