import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { AppointmentService, Appointment, PageResponse, AppointmentExtendedPageParams } from '../../data-access/api/appointment.service';
import { AbsenceService, Absence, CreateAbsenceRequest } from '../../data-access/api/absence.service';
import { ToastService } from '../../core/services/toast.service';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-therapist-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
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
            <div class="card-header">
              <h2>Stammdaten</h2>
              <button class="btn-edit" (click)="openEditTherapistModal()">✏️ Bearbeiten</button>
            </div>
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
              <span class="result-count">{{ totalAppointments() }}</span>
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
              <div class="filter-tabs type-filter">
                <button
                  [class.active]="appointmentTypeFilter() === 'all'"
                  (click)="setAppointmentTypeFilter('all')">
                  Alle
                </button>
                <button
                  [class.active]="appointmentTypeFilter() === 'series'"
                  (click)="setAppointmentTypeFilter('series')">
                  Serie
                </button>
                <button
                  [class.active]="appointmentTypeFilter() === 'single'"
                  (click)="setAppointmentTypeFilter('single')">
                  Einzel
                </button>
              </div>
            </div>

            <div class="search-bar">
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
                      <th>Status</th>
                      <th>Kommentar</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (apt of serverAppointments(); track apt.id) {
                      <tr [class.cancelled]="apt.status === 'CANCELLED'"
                          [class.completed]="apt.status === 'COMPLETED'"
                          (click)="navigateToDay(apt.date)">
                        <td class="col-date">{{ formatDateDE(apt.date) }}</td>
                        <td class="col-time">{{ formatTimeShort(apt.startTime) }}–{{ formatTimeShort(apt.endTime) }} Uhr</td>
                        <td>
                          <a [routerLink]="['/dashboard/patients', apt.patientId]" (click)="$event.stopPropagation()">{{ apt.patientName }}</a>
                        </td>
                        <td>
                          <div class="type-tags">
                            @if (apt.createdBySeriesAppointment) {
                              <span class="tag series">Serie</span>
                            } @else {
                              <span class="tag single">Einzel</span>
                            }
                            @if (apt.isBWO) { <span class="tag bwo">BWO</span> }
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
                <button
                  [class.active]="absenceFilter() === 'all'"
                  (click)="setAbsenceFilter('all')">
                  Alle
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
                @for (absence of filteredAbsences(); track absence.id) {
                  <div class="absence-item" [class.recurring]="absence.absenceType === 'RECURRING'">
                    <div class="absence-info">
                      @if (absence.absenceType === 'RECURRING') {
                        <span class="absence-day">{{ getWeekdayLabel(absence.weekday) }}</span>
                        <span class="absence-time">
                          @if (absence.startTime && absence.endTime) {
                            {{ formatTime(absence.startTime) }} - {{ formatTime(absence.endTime) }}
                          } @else {
                            Ganztags
                          }
                        </span>
                      } @else {
                        <span class="absence-day">{{ formatDate(absence.date!) }}
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
                      }
                    </div>
                    <div class="absence-details">
                      <span class="absence-reason">{{ absence.reason || 'Kein Grund angegeben' }}</span>
                    </div>
                    <div class="absence-type">
                      <span class="type-badge" [class]="absence.absenceType.toLowerCase()">
                        {{ absence.absenceType === 'RECURRING' ? 'Regelmäßig' : 'Einmalig' }}
                      </span>
                      <button class="btn-icon" (click)="openEditAbsenceModal(absence)" title="Bearbeiten">✏️</button>
                      <button class="btn-icon btn-delete" (click)="confirmDeleteAbsence(absence)" title="Löschen">🗑️</button>
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

      <!-- Edit Therapist Modal -->
      @if (showEditTherapistModal) {
        <div class="modal-overlay" (click)="closeEditTherapistModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Stammdaten bearbeiten</h2>
            <form (ngSubmit)="saveTherapist()">
              <div class="form-row">
                <div class="form-group">
                  <label>Vorname *</label>
                  <input type="text" [(ngModel)]="therapistForm.firstName" name="firstName" required />
                </div>
                <div class="form-group">
                  <label>Nachname *</label>
                  <input type="text" [(ngModel)]="therapistForm.lastName" name="lastName" required />
                </div>
              </div>
              <div class="form-group">
                <label>E-Mail</label>
                <input type="email" [(ngModel)]="therapistForm.email" name="email" />
              </div>
              <div class="form-group">
                <label>Telefon</label>
                <input type="tel" [(ngModel)]="therapistForm.telefon" name="telefon" />
              </div>
              <div class="form-group checkbox-group">
                <label><input type="checkbox" [(ngModel)]="therapistForm.isActive" name="isActive" /> Aktiv</label>
              </div>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closeEditTherapistModal()">Abbrechen</button>
                <button type="submit" class="btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
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
                <button type="button" class="btn-secondary" (click)="closeAbsenceModal()">Abbrechen</button>
                <button type="submit" class="btn-primary">Speichern</button>
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

    .info-card { grid-column: 1; grid-row: 1; }
    .appointments-card { grid-column: 2; grid-row: 1 / 3; display: flex; flex-direction: column; overflow: hidden; }
    .absences-card { grid-column: 1; grid-row: 2; }

    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden; display: flex; flex-direction: column; }
    .card h2 { margin: 0; font-size: 1rem; color: #2563EB; }

    /* Info Card */
    .info-grid { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .info-row { display: flex; justify-content: space-between; font-size: 0.85rem; }
    .label { color: #6B7280; }
    .value { color: #111827; font-weight: 500; }
    .value.active { color: #059669; }
    .value.inactive { color: #DC2626; }

    /* Card Header */
    .card-header { display: flex; align-items: center; gap: 0.6rem; padding: 1rem 1.25rem; border-bottom: 1px solid #F3F4F6; }
    .result-count { font-size: 0.7rem; color: #6B7280; background: #E5E7EB; padding: 0.1rem 0.4rem; border-radius: 10px; margin-right: auto; }
    .filter-tabs { display: flex; gap: 0; margin-left: auto; }
    .filter-tabs button { padding: 0.3rem 0.6rem; border: 1px solid #E5E7EB; background: white; color: #6B7280; font-size: 0.7rem; cursor: pointer; }
    .filter-tabs button:first-child { border-radius: 4px 0 0 4px; }
    .filter-tabs button:last-child { border-radius: 0 4px 4px 0; }
    .filter-tabs button.active { background: #3B82F6; border-color: #3B82F6; color: white; }
    .filter-tabs.type-filter { margin-left: 0.5rem; }
    .filter-tabs.type-filter button.active { background: #8B5CF6; border-color: #8B5CF6; }

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
    .search-bar { padding: 0.75rem 1rem; border-bottom: 1px solid #E5E7EB; }
    .search-input { width: 100%; max-width: 300px; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.8rem; }
    .search-input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
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
    .status-badge { font-size: 0.6rem; padding: 0.1rem 0.35rem; border-radius: 3px; font-weight: 500; white-space: nowrap; }
    .status-scheduled { background: #DBEAFE; color: #1E40AF; }
    .status-confirmed { background: #D1FAE5; color: #065F46; }
    .status-cancelled { background: #FEE2E2; color: #991B1B; }
    .status-completed { background: #E5E7EB; color: #374151; }
    .status-no_show { background: #FEF3C7; color: #92400E; }

    /* Absences Styles */
    .absences-list { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.75rem 1.25rem; max-height: 300px; overflow-y: auto; }
    .absence-item { display: grid; grid-template-columns: 100px 1fr auto; gap: 0.75rem; padding: 0.5rem 0.6rem; border: 1px solid #E5E7EB; border-radius: 6px; align-items: center; font-size: 0.8rem; }
    .absence-item.recurring { border-left: 3px solid #8B5CF6; }
    .absence-info { display: flex; flex-direction: column; }
    .absence-day { font-weight: 500; color: #111827; font-size: 0.8rem; }
    .absence-time { font-size: 0.7rem; color: #6B7280; }
    .absence-details { display: flex; flex-direction: column; }
    .absence-reason { font-size: 0.75rem; color: #374151; }
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
  appointmentFilter = signal<'upcoming' | 'past' | 'all'>('upcoming');
  appointmentTypeFilter = signal<'all' | 'series' | 'single'>('all');
  absenceFilter = signal<'recurring' | 'special' | 'all'>('all');

  // Server-side pagination for appointments
  private appointmentServerPage = signal<PageResponse<Appointment> | null>(null);
  appointmentPage = signal(0);
  private readonly PAGE_SIZE = 50;

  // Search and sorting for appointments
  appointmentSearchTerm = signal('');
  private appointmentSearchSubject = new Subject<string>();
  appointmentSortField = signal<'date' | 'patient'>('date');
  appointmentSortDir = signal<'asc' | 'desc'>('asc');

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
  showEditTherapistModal = false;
  showAbsenceModal = false;
  showDeleteAbsenceModal = false;
  editingAbsenceId: number | null = null;
  absenceToDelete: Absence | null = null;

  // Therapist form
  therapistForm = {
    firstName: '',
    lastName: '',
    email: '',
    telefon: '',
    isActive: true
  };

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

  ngOnInit(): void {
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
      this.appointmentSortDir.set('asc');
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

  formatTime(timeStr: string): string {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  formatDateDE(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
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
  openEditTherapistModal(): void {
    const t = this.therapist();
    if (t) {
      this.therapistForm = {
        firstName: t.firstName || '',
        lastName: t.lastName || '',
        email: t.email || '',
        telefon: t.telefon || '',
        isActive: t.isActive ?? true
      };
      this.showEditTherapistModal = true;
    }
  }

  closeEditTherapistModal(): void {
    this.showEditTherapistModal = false;
  }

  saveTherapist(): void {
    const t = this.therapist();
    if (!t) return;

    this.therapistService.update(t.id, this.therapistForm).subscribe({
      next: () => {
        this.toast.success('Stammdaten aktualisiert');
        this.loadTherapist(t.id);
        this.closeEditTherapistModal();
      },
      error: () => this.toast.error('Fehler beim Speichern')
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

  private extractTime(dateTimeStr: string): string {
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}
