import { Component, OnInit, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PatientService, Patient } from '../../data-access/api/patient.service';
import { AppointmentService, Appointment } from '../../data-access/api/appointment.service';
import { ToastService } from '../../core/services/toast.service';
import { PrintService, PrintableAppointment } from '../../core/services/print.service';
import { AppointmentModalComponent } from '../appointments/appointment-modal.standalone.component';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppointmentModalComponent],
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
              @if (!editMode()) {
                <button class="btn-edit-toggle" (click)="toggleEditMode()">✏️ Bearbeiten</button>
              }
            </div>

            <div class="form-section">
              @if (editMode()) {
                <!-- Edit Mode -->
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
                  BWO (Behindertenwerkstatt Oberberg)
                </label>

                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="editForm.isActive" />
                  Aktiver Patient
                </label>

                <div class="form-actions">
                  <button class="btn-delete-subtle" (click)="confirmDeletePatient()" title="Patient löschen">Patient löschen</button>

                  <div style="margin-left:auto; display:flex; gap:0.5rem;">
                    <button class="btn-cancel" (click)="cancelEdit()">Abbrechen</button>
                    <button class="btn-save" (click)="savePatient()" [disabled]="saving()">
                      {{ saving() ? 'Speichern...' : 'Speichern' }}
                    </button>
                  </div>
                </div>
              } @else {
                <!-- Read-Only Mode -->
                <div class="info-row">
                  <label>Vorname</label>
                  <span class="info-value">{{ patient()?.firstName || '-' }}</span>
                </div>
                <div class="info-row">
                  <label>Nachname</label>
                  <span class="info-value">{{ patient()?.lastName || '-' }}</span>
                </div>
                <div class="info-row">
                  <label>Geburtsdatum</label>
                  <span class="info-value">{{ patient()?.dateOfBirth ? formatDateDE(patient()?.dateOfBirth) : '-' }}</span>
                </div>
                <div class="info-row">
                  <label>E-Mail</label>
                  <span class="info-value">{{ patient()?.email || '-' }}</span>
                </div>
                <div class="info-row">
                  <label>Telefon</label>
                  <span class="info-value">{{ patient()?.telefon || '-' }}</span>
                </div>
                <div class="info-row">
                  <label>Versicherung</label>
                  <span class="info-value">{{ patient()?.insuranceType || '-' }}</span>
                </div>

                <div class="form-divider"></div>
                <h3>Adresse</h3>

                <div class="info-row">
                  <label>Straße / Hausnr.</label>
                  <span class="info-value">{{ getAddressLine1() }}</span>
                </div>
                <div class="info-row">
                  <label>PLZ / Ort</label>
                  <span class="info-value">{{ getAddressLine2() }}</span>
                </div>

                <div class="form-divider"></div>

                <div class="info-row">
                  <label>Notizen</label>
                  <span class="info-value notes-text">{{ patient()?.notes || '-' }}</span>
                </div>

                <div class="info-row">
                  <label>BWO</label>
                  <span class="info-value">{{ patient()?.isBWO ? 'Ja' : 'Nein' }}</span>
                </div>
                <div class="info-row">
                  <label>Status</label>
                  <span class="info-value" [class.status-active]="patient()?.isActive" [class.status-inactive]="!patient()?.isActive">
                    {{ patient()?.isActive ? 'Aktiv' : 'Inaktiv' }}
                  </span>
                </div>

                <div class="form-divider"></div>
              }
            </div>
          </div>

          <!-- Appointments Table (2/3) -->
          <div class="card appointments-card">
            <div class="card-header">
              <h2>Termine</h2>
              <span class="result-count">{{ filteredAppointments().length }}</span>
              <button class="btn-print" (click)="openPrintModal()" title="Termine drucken">
                🖨️ Drucken
              </button>
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

              <input type="text" [(ngModel)]="appointmentSearchTerm" (input)="onAppointmentSearchInput($event)" placeholder="Suche (Therapeut, Kommentar, Datum)..." class="search-input" />
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
                      <th class="col-date sortable" (click)="sortAppointments('date')">Datum <span class="sort-icon">{{ getSortIcon('date') || '⇅' }}</span></th>
                      <th class="col-time sortable" (click)="sortAppointments('time')">Zeit <span class="sort-icon">{{ getSortIcon('time') || '⇅' }}</span></th>
                      <th class="sortable" (click)="sortAppointments('therapist')">Therapeut <span class="sort-icon">{{ getSortIcon('therapist') || '⇅' }}</span></th>
                      <th class="sortable" (click)="sortAppointments('type')">Typ <span class="sort-icon">{{ getSortIcon('type') || '⇅' }}</span></th>
                      <th>Behandlung</th>
                      <th class="col-status sortable" (click)="sortAppointments('status')">Status <span class="sort-icon">{{ getSortIcon('status') || '⇅' }}</span></th>
                      <th>Kommentar</th>
                      <th class="col-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (apt of filteredAppointments(); track apt.id) {
                      <tr [class.cancelled]="apt.status === 'CANCELLED'"
                          [class.completed]="apt.status === 'COMPLETED'"
                          (click)="openAppointmentModal(apt)">
                        <td class="col-date">{{ formatDateDE(apt.date) }}</td>
                        <td class="col-time">{{ formatTime(apt.startTime) }} – {{ formatTime(apt.endTime) }} Uhr</td>
                        <td>
                          <a [routerLink]="['/dashboard/therapists', apt.therapistId]" (click)="$event.stopPropagation()">{{ apt.therapistName }}</a>
                        </td>
                        <td>
                          <div class="type-tags">
                            @if (apt.createdBySeriesAppointment || apt.appointmentSeriesId) {
                              <span class="tag series">Serie</span>
                            } @else {
                              <span class="tag single">Einzel</span>
                            }
                          </div>
                        </td>
                        <td>
                          <div class="treatment-tags">
                            @if (apt.isHotair) { <span class="tag hotair">HL</span> }
                            @if (apt.isUltrasonic) { <span class="tag ultra">US</span> }
                            @if (apt.isElectric) { <span class="tag electro">ET</span> }
                            @if (!apt.isHotair && !apt.isUltrasonic && !apt.isElectric) { <span class="tag default">KG</span> }
                          </div>
                        </td>
                        <td class="col-status">
                          <div class="status-cell" (click)="$event.stopPropagation()">
                            <button class="status-badge" [class]="'status-' + apt.status.toLowerCase()" (click)="openStatusMenuApt(apt.id)" title="Status ändern">
                              {{ getStatusLabel(apt.status) }}
                            </button>
                            @if (openStatusMenuIdApt === apt.id) {
                              <div class="status-dropdown-menu">
                                <button class="status-option status-scheduled" (click)="updateAppointmentStatus(apt.id, 'SCHEDULED')">Geplant</button>
                                <button class="status-option status-confirmed" (click)="updateAppointmentStatus(apt.id, 'CONFIRMED')">Bestätigt</button>
                                <button class="status-option status-cancelled" (click)="updateAppointmentStatus(apt.id, 'CANCELLED')">Storniert</button>
                              </div>
                            }
                          </div>
                        </td>
                        <td class="col-comment">{{ apt.comment || '–' }}</td>
                        <td class="col-actions" (click)="$event.stopPropagation()">
                          <button class="btn-action" title="Im Kalender anzeigen" (click)="navigateToDay(apt.date)">📅</button>
                          <button class="btn-delete-apt" title="Termin löschen" (click)="confirmDeleteAppointment(apt.id)">🗑️</button>
                        </td>
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

      <!-- Print Appointments Modal -->
      @if (showPrintModal) {
        <div class="modal-overlay" (click)="showPrintModal = false">
          <div class="modal modal-wide" (click)="$event.stopPropagation()">
            <h2>🖨️ Termine drucken</h2>
            <p class="modal-desc">Wählen Sie die Termine aus, die gedruckt werden sollen.</p>

            <div class="print-filter-row">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="printOnlyUpcoming" (change)="updatePrintSelection()" />
                Nur kommende Termine
              </label>
              <button class="btn-link" (click)="selectAllForPrint()">Alle auswählen</button>
              <button class="btn-link" (click)="deselectAllForPrint()">Keine auswählen</button>
            </div>

            <div class="print-appointment-list">
              @for (apt of printableAppointments(); track apt.id) {
                <label class="print-apt-item" [class.past]="isPastAppointment(apt.date)">
                  <input type="checkbox" [(ngModel)]="selectedForPrint[apt.id]" />
                  <span class="apt-date">{{ formatDateDE(apt.date) }}</span>
                  <span class="apt-time">{{ formatTime(apt.startTime) }} Uhr</span>
                  <span class="apt-therapist">{{ apt.therapistName }}</span>
                </label>
              }
              @if (printableAppointments().length === 0) {
                <div class="empty-state">Keine druckbaren Termine gefunden</div>
              }
            </div>

            <div class="print-summary">
              {{ countSelectedForPrint() }} Termine ausgewählt
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" (click)="showPrintModal = false">Abbrechen</button>
              <button class="btn-print-action" (click)="printSelectedAppointments()" [disabled]="countSelectedForPrint() === 0">
                🖨️ Drucken ({{ countSelectedForPrint() }})
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirmation Modal -->
      @if (showDeleteModal) {
        <div class="modal-overlay" (click)="showDeleteModal = false">
          <div class="modal modal-sm" (click)="$event.stopPropagation()">
            <h2>Patient löschen?</h2>
            <p class="modal-warning">
              Möchten Sie <strong>{{ patient()?.fullName }}</strong> wirklich unwiderruflich löschen?
            </p>
            <p class="modal-hint">
              Hinweis: Normalerweise sollten Patienten auf "Inaktiv" gesetzt werden, um die Terminhistorie zu erhalten.
            </p>
            <div class="modal-actions">
              <button class="btn-cancel" (click)="showDeleteModal = false">Abbrechen</button>
              <button class="btn-danger" (click)="deletePatient()">Endgültig löschen</button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Appointment Confirmation -->
      @if (showDeleteAppointmentModal) {
        <div class="modal-overlay" (click)="showDeleteAppointmentModal = false">
          <div class="modal modal-sm" (click)="$event.stopPropagation()">
            <h2>Termin löschen?</h2>
            <p class="modal-warning">Möchten Sie diesen Termin wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
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
    /* toolbar layout and search styling moved to global styles (.table-controls) */
    /* filter-tabs styling moved to global.scss (.filter-tabs) */
    .status-filter { display: flex; gap: 0.25rem; margin-left: auto; flex-wrap: wrap; }
    .status-chip { padding: 0.15rem 0.4rem; border: 1px solid #E5E7EB; background: white; border-radius: 4px; font-size: 0.6rem; cursor: pointer; color: #6B7280; }
    .status-chip.active { background: #EFF6FF; border-color: #3B82F6; color: #2563EB; }
    .loading-inline, .empty-state { text-align: center; padding: 2rem; color: #6B7280; font-size: 0.85rem; }
    .table-wrapper { flex: 1; overflow: auto; }
    .apt-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .apt-table thead { position: sticky; top: 0; z-index: 1; }
    .apt-table th { background: #F9FAFB; padding: 0.5rem 0.6rem; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #E5E7EB; white-space: nowrap; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .apt-table th.sortable { cursor: pointer; user-select: none; }
    .apt-table th.sortable:hover { background: #EFF6FF; color: #2563EB; }
    .sort-icon { margin-left: 0.35rem; font-size: 0.75rem; color: #9CA3AF; }
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
    .type-tags { display: flex; gap: 3px; }
    .tag { display: inline-block; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.6rem; font-weight: 600; }
    .tag.series { background: #EDE9FE; color: #5B21B6; }
    .tag.single { background: #E5E7EB; color: #6B7280; }
    .tag.hotair { background: #FEE2E2; color: #991B1B; }
    .tag.ultra { background: #EDE9FE; color: #5B21B6; }
    .tag.electro { background: #D1FAE5; color: #065F46; }
    .tag.default { background: #E5E7EB; color: #6B7280; }
    .status-badge { font-size: 0.6rem; padding: 0.1rem 0.35rem; border-radius: 3px; font-weight: 500; white-space: nowrap; border: none; }
    .status-scheduled { background: #DBEAFE; color: #1E40AF; }
    .status-confirmed { background: #D1FAE5; color: #065F46; }
    .status-cancelled { background: #FEE2E2; color: #991B1B; }
    .status-completed { background: #E5E7EB; color: #374151; }
    .status-no_show { background: #FEF3C7; color: #92400E; }

    /* Edit Toggle Button */
    .btn-edit-toggle { background: none; border: 1px solid #D1D5DB; padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.75rem; color: #6B7280; }
    .btn-edit-toggle:hover { background: #F3F4F6; color: #374151; border-color: #9CA3AF; }

    /* Read-Only Info Rows */
    .info-row { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.25rem 0; }
    .info-row label { font-size: 0.7rem; color: #6B7280; font-weight: 500; }
    .info-value { font-size: 0.85rem; color: #111827; }
    .info-value.notes-text { white-space: pre-wrap; color: #6B7280; font-size: 0.8rem; }
    .info-value.status-active { color: #059669; font-weight: 500; }
    .info-value.status-inactive { color: #DC2626; font-weight: 500; }

    /* Form Actions with Cancel */
    .form-actions { padding-top: 0.5rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .btn-cancel { padding: 0.45rem 1rem; background: white; color: #6B7280; border: 1px solid #D1D5DB; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500; }
    .btn-cancel:hover { background: #F3F4F6; }

    /* Delete Section */
    .delete-section { margin-top: auto; padding-top: 1rem; }
    .btn-delete-subtle { background: none; border: none; color: #9CA3AF; padding: 0.25rem 0; cursor: pointer; font-size: 0.7rem; }
    .btn-delete-subtle:hover { color: #6B7280; text-decoration: underline; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .modal.modal-wide { max-width: 560px; }
    /* small centered confirm dialogs */
    .modal-sm { max-width: 360px; padding: 1rem; }
    .modal h2 { margin: 0 0 1rem 0; color: #111827; font-size: 1.15rem; }
    .modal-desc { color: #6B7280; margin: 0 0 1rem 0; font-size: 0.8rem; }
    .modal-warning { color: #374151; margin: 0 0 0.5rem 0; font-size: 0.875rem; }
    .modal-hint { color: #6B7280; margin: 0 0 1.25rem 0; font-size: 0.8rem; background: #FEF3C7; padding: 0.5rem 0.75rem; border-radius: 6px; }
    .modal-actions { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .btn-danger { padding: 0.45rem 1rem; background: #DC2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500; }
    .btn-danger:hover { background: #B91C1C; }

    /* Print Button & Modal */
    .header-actions-inline { margin-left: auto; display: flex; gap: 0.25rem; align-items: center; }
    .btn-print { padding: 0.35rem 0.75rem; background: #F97316; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 500; }
    .btn-print:hover { background: #EA580C; }
    .btn-delete-inline { border: none; background: transparent; color: #9CA3AF; padding: 0.35rem 0.45rem; font-size: 0.95rem; border-radius: 6px; cursor: pointer; }
    .btn-delete-inline:hover { color: #DC2626; background: rgba(220,38,38,0.06); }
    .print-filter-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .btn-link { background: none; border: none; color: #3B82F6; cursor: pointer; font-size: 0.75rem; padding: 0; }
    .btn-link:hover { text-decoration: underline; }
    .print-appointment-list { max-height: 300px; overflow-y: auto; border: 1px solid #E5E7EB; border-radius: 8px; margin-bottom: 0.75rem; }
    .print-apt-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid #F3F4F6; cursor: pointer; font-size: 0.8rem; }
    .print-apt-item:last-child { border-bottom: none; }
    .print-apt-item:hover { background: #F9FAFB; }
    .print-apt-item.past { color: #9CA3AF; }
    .print-apt-item input { accent-color: #F97316; }
    .apt-date { min-width: 80px; font-weight: 500; }
    .apt-time { min-width: 60px; color: #6B7280; }
    .apt-therapist { flex: 1; color: #6B7280; text-align: right; }
    .print-summary { font-size: 0.75rem; color: #6B7280; text-align: right; margin-bottom: 1rem; }
    .btn-print-action { padding: 0.45rem 1rem; background: #F97316; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500; }
    .btn-print-action:hover { background: #EA580C; }
    .btn-print-action:disabled { background: #FDBA74; cursor: not-allowed; }

    /* Status Dropdown & Delete Button in Appointment Table */
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
    .col-actions { display: flex; gap: 0.25rem; align-items: center; }
  `]
})
export class PatientDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private patientService = inject(PatientService);
  private appointmentService = inject(AppointmentService);
  private toastService = inject(ToastService);
  private printService = inject(PrintService);

  patient = signal<Patient | null>(null);
  appointments = signal<Appointment[]>([]);
  loading = signal(true);
  loadingAppointments = signal(true);
  saving = signal(false);
  editMode = signal(false);
  showDeleteModal = false;
  showPrintModal = false;
  showDeleteAppointmentModal = false;
  showAppointmentModal = false;
  appointmentToDeleteId: number | null = null;
  openStatusMenuIdApt: number | null = null;
  selectedAppointment: Appointment | null = null;
  printOnlyUpcoming = true;
  selectedForPrint: { [key: number]: boolean } = {};
  appointmentFilter = signal<'upcoming' | 'past' | 'all'>('upcoming');
  appointmentTypeFilter = signal<'all' | 'series' | 'single'>('all');
  filterStatus = '';

  // Local search for patient appointments (shown above table)
  appointmentSearchTerm = '';


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

  // Appointment filtering + client-side sorting for patient detail table
  appointmentSortField = signal<'date'|'time'|'therapist'|'type'|'status'>('date');
  appointmentSortDir = signal<'asc'|'desc'>('asc');

  filteredAppointments = computed(() => {
    let apts = this.appointments();
    const filter = this.appointmentFilter();
    const typeFilter = this.appointmentTypeFilter();
    const today = new Date().toISOString().split('T')[0];

    switch (filter) {
      case 'upcoming':
        apts = apts.filter(a => a.date >= today && a.status !== 'CANCELLED');
        break;
      case 'past':
        apts = apts.filter(a => a.date < today);
        break;
    }

    switch (typeFilter) {
      case 'series':
        // treat appointments as part of a series if either flag or seriesId is present
        apts = apts.filter(a => a.createdBySeriesAppointment || !!a.appointmentSeriesId);
        break;
      case 'single':
        apts = apts.filter(a => !(a.createdBySeriesAppointment || !!a.appointmentSeriesId));
        break;
    }

    if (this.filterStatus) {
      apts = apts.filter(a => a.status === this.filterStatus);
    }

    // local search (therapist name, comment, or date)
    if (this.appointmentSearchTerm && this.appointmentSearchTerm.trim()) {
      const t = this.appointmentSearchTerm.trim().toLowerCase();
      apts = apts.filter(a =>
        (a.therapistName || '').toLowerCase().includes(t) ||
        (a.comment || '').toLowerCase().includes(t) ||
        (a.date || '').toLowerCase().includes(t)
      );
    }

    // client-side sorting
    const field = this.appointmentSortField();
    const dir = this.appointmentSortDir();

    apts = apts.slice().sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case 'date':
          cmp = a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
          break;
        case 'time':
          cmp = a.startTime.localeCompare(b.startTime) || a.date.localeCompare(b.date);
          break;
        case 'therapist':
          cmp = (a.therapistName || '').localeCompare(b.therapistName || '');
          break;
        case 'type':
          const ta = (a.createdBySeriesAppointment || !!a.appointmentSeriesId) ? 0 : 1;
          const tb = (b.createdBySeriesAppointment || !!b.appointmentSeriesId) ? 0 : 1;
          cmp = ta - tb;
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          cmp = 0;
      }
      return dir === 'asc' ? cmp : -cmp;
    });

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
        this.editMode.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.toastService.show('Fehler beim Speichern', 'error');
      }
    });
  }

  toggleEditMode(): void {
    const p = this.patient();
    if (p) {
      this.populateForm(p);
    }
    this.editMode.set(true);
  }

  cancelEdit(): void {
    const p = this.patient();
    if (p) {
      this.populateForm(p);
    }
    this.editMode.set(false);
  }

  confirmDeletePatient(): void {
    this.showDeleteModal = true;
  }

  deletePatient(): void {
    const p = this.patient();
    if (!p) return;

    this.patientService.delete(p.id).subscribe({
      next: () => {
        this.toastService.show('Patient gelöscht', 'success');
        this.router.navigate(['/dashboard/patients']);
      },
      error: () => {
        this.toastService.show('Fehler beim Löschen', 'error');
      }
    });
    this.showDeleteModal = false;
  }

  getAddressLine1(): string {
    const p = this.patient();
    if (!p) return '-';
    const street = p.street || '';
    const house = p.houseNumber || '';
    if (!street && !house) return '-';
    return `${street} ${house}`.trim();
  }

  getAddressLine2(): string {
    const p = this.patient();
    if (!p) return '-';
    const plz = p.postalCode || '';
    const city = p.city || '';
    if (!plz && !city) return '-';
    return `${plz} ${city}`.trim();
  }

  loadAppointments(patientId: number): void {
    this.appointmentService.getByPatient(patientId).subscribe({
      next: (appointments) => {
        appointments.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
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

  setAppointmentTypeFilter(filter: 'all' | 'series' | 'single'): void {
    this.appointmentTypeFilter.set(filter);
  }

  toggleStatusFilter(status: string): void {
    this.filterStatus = this.filterStatus === status ? '' : status;
  }

  onAppointmentSearchInput(event: Event): void {
    this.appointmentSearchTerm = (event.target as HTMLInputElement).value;
  }

  // Sorting helpers for appointments table
  sortAppointments(field: 'date'|'time'|'therapist'|'type'|'status') {
    if (this.appointmentSortField() === field) {
      this.appointmentSortDir.set(this.appointmentSortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.appointmentSortField.set(field);
      this.appointmentSortDir.set(field === 'date' ? 'asc' : 'asc');
    }
  }

  getSortIcon(field: 'date'|'time'|'therapist'|'type'|'status'): string {
    return this.appointmentSortField() !== field ? '' : (this.appointmentSortDir() === 'asc' ? '↑' : '↓');
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

  // ==================== Print Methods ====================

  printableAppointments = computed(() => {
    let apts = this.appointments().filter(a => a.status !== 'CANCELLED');
    if (this.printOnlyUpcoming) {
      const today = new Date().toISOString().split('T')[0];
      apts = apts.filter(a => a.date >= today);
    }
    return apts.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  });

  openPrintModal(): void {
    this.printOnlyUpcoming = true;
    this.selectedForPrint = {};
    this.selectAllForPrint();
    this.showPrintModal = true;
  }

  updatePrintSelection(): void {
    this.selectedForPrint = {};
    this.selectAllForPrint();
  }

  selectAllForPrint(): void {
    this.printableAppointments().forEach(apt => {
      this.selectedForPrint[apt.id] = true;
    });
  }

  deselectAllForPrint(): void {
    this.selectedForPrint = {};
  }

  countSelectedForPrint(): number {
    return Object.values(this.selectedForPrint).filter(v => v).length;
  }

  isPastAppointment(dateStr: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    const date = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return date < today;
  }

  printSelectedAppointments(): void {
    const patientName = this.patient()?.fullName || 'Patient';
    const selectedApts = this.printableAppointments()
      .filter(apt => this.selectedForPrint[apt.id])
      .map(apt => ({
        id: apt.id,
        date: apt.date,
        startTime: apt.startTime,
        endTime: apt.endTime,
        patientName: apt.patientName || patientName,
        therapistName: apt.therapistName || '',
        status: apt.status
      } as PrintableAppointment));

    if (selectedApts.length > 0) {
      this.printService.printAppointments(patientName, selectedApts);
      this.showPrintModal = false;
    }
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
        this.toastService.success('Status aktualisiert');
        const patientId = this.patient()?.id;
        if (patientId) this.loadAppointments(patientId);
      },
      error: (err: any) => {
        const errMsg = err?.error?.error || 'Fehler beim Aktualisieren des Status';
        this.toastService.error(`Status konnte nicht aktualisiert werden: ${errMsg}`);
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
        this.toastService.success('Termin gelöscht');
        this.showDeleteAppointmentModal = false;
        this.appointmentToDeleteId = null;
        const patientId = this.patient()?.id;
        if (patientId) this.loadAppointments(patientId);
      },
      error: (err: any) => {
        this.toastService.error('Fehler beim Löschen des Termins');
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
    const patientId = this.patient()?.id;
    if (patientId) {
      this.loadAppointments(patientId);
    }
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
