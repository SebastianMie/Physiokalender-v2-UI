import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { AppointmentService, Appointment, PageResponse, AppointmentPageParams, AppointmentExtendedPageParams } from '../../data-access/api/appointment.service';
import { AppointmentSeriesService, AppointmentSeries, CancellationDTO, UpdateAppointmentSeriesRequest } from '../../data-access/api/appointment-series.service';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { PatientService } from '../../data-access/api/patient.service';
import { ToastService } from '../../core/services/toast.service';
import { AppointmentCacheService } from '../../core/services/appointment-cache.service';

@Component({
  selector: 'app-appointment-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="overview-container">
      <div class="page-header">
        <h1>Terminübersicht</h1>
        <div class="view-tabs">
          <button class="view-tab" [class.active]="viewMode() === 'single'" (click)="setViewMode('single')">Einzeltermine</button>
          <button class="view-tab" [class.active]="viewMode() === 'series'" (click)="setViewMode('series')">Serientermine</button>
        </div>
        <span class="result-count">{{ viewMode() === 'single' ? totalElements() + ' Termine' : filteredSeries().length + ' Serien' }}</span>
      </div>

      <div class="overview-layout">
        <!-- Filter Sidebar LEFT -->
        <aside class="filter-sidebar">
          <div class="filter-header">
            <h3>Filter</h3>
            @if (hasActiveFilters()) {
              <button class="btn-reset" (click)="resetFilters()">Zurücksetzen</button>
            }
          </div>

          @if (viewMode() === 'single') {
            <!-- Date Range -->
            <div class="filter-group">
              <h4>Zeitraum</h4>
              <div class="date-range">
                <label>Von</label>
                <input type="date" [(ngModel)]="filterDateFrom" (change)="applyFilters()" />
                <label>Bis</label>
                <input type="date" [(ngModel)]="filterDateTo" (change)="applyFilters()" />
              </div>
              <div class="quick-dates">
                <button class="quick-btn" (click)="setQuickDate('today')">Heute</button>
                <button class="quick-btn" (click)="setQuickDate('week')">Diese Woche</button>
                <button class="quick-btn" (click)="setQuickDate('month')">Dieser Monat</button>
                <button class="quick-btn" (click)="setQuickDate('all')">Alle</button>
              </div>
            </div>
          }

          <!-- Therapeut -->
          <div class="filter-group">
            <h4>Therapeut</h4>
            <div class="filter-options scrollable">
              @for (t of therapists(); track t.id) {
                <label class="filter-option">
                  <input type="checkbox" [checked]="filterTherapistIds.has(t.id)" (change)="toggleTherapistFilter(t.id)" />
                  <span>{{ t.fullName }}</span>
                </label>
              }
            </div>
          </div>

          @if (viewMode() === 'single') {
            <!-- Behandlungsart -->
            <div class="filter-group">
              <h4>Behandlung</h4>
              <label class="filter-option">
                <input type="checkbox" [checked]="filterTreatments.has('hotair')" (change)="toggleTreatment('hotair')" />
                <span class="tag hotair">HL</span> Heißluft
              </label>
              <label class="filter-option">
                <input type="checkbox" [checked]="filterTreatments.has('ultra')" (change)="toggleTreatment('ultra')" />
                <span class="tag ultra">US</span> Ultraschall
              </label>
              <label class="filter-option">
                <input type="checkbox" [checked]="filterTreatments.has('electro')" (change)="toggleTreatment('electro')" />
                <span class="tag electro">ET</span> Elektrotherapie
              </label>
            </div>

            <!-- Status -->
            <div class="filter-group">
              <h4>Status</h4>
              @for (s of allStatuses; track s.value) {
                <label class="filter-option">
                  <input type="checkbox" [checked]="filterStatuses.has(s.value)" (change)="toggleStatus(s.value)" />
                  <span class="status-badge" [class]="'status-' + s.value.toLowerCase()">{{ s.label }}</span>
                </label>
              }
            </div>

            <!-- BWO -->
            <div class="filter-group">
              <h4>Sonstiges</h4>
              <label class="filter-option">
                <input type="checkbox" [(ngModel)]="filterBWO" (change)="applyFilters()" />
                <span>Nur BWO</span>
              </label>
            </div>
          }

          @if (viewMode() === 'series') {
            <!-- Series Status -->
            <div class="filter-group">
              <h4>Serien-Status</h4>
              @for (s of seriesStatuses; track s.value) {
                <label class="filter-option">
                  <input type="checkbox" [checked]="filterSeriesStatuses.has(s.value)" (change)="toggleSeriesStatus(s.value)" />
                  <span class="status-badge" [class]="'status-' + s.value.toLowerCase()">{{ s.label }}</span>
                </label>
              }
            </div>
          }
        </aside>

        <!-- Main Table -->
        <div class="table-section">
          <div class="search-bar">
            <input type="text" [ngModel]="searchTerm" (input)="onSearchInput($event)"
              placeholder="Patient, Therapeut oder Kommentar suchen..." class="search-input" />
            @if (searchTerm) {
              <button class="search-clear" (click)="searchTerm = ''; applyFilters()">&times;</button>
            }

            <!-- Time + Type filters (like patient-detail) -->
            <div class="apt-filters">
              <div class="filter-tabs">
                <button [class.active]="appointmentFilter() === 'upcoming'" (click)="setAppointmentFilter('upcoming')">Kommende</button>
                <button [class.active]="appointmentFilter() === 'past'" (click)="setAppointmentFilter('past')">Vergangene</button>
                <button [class.active]="appointmentFilter() === 'all'" (click)="setAppointmentFilter('all')">Alle</button>
              </div>
              <div class="filter-tabs type-filter">
                <button [class.active]="appointmentTypeFilter() === 'all'" (click)="setAppointmentTypeFilter('all')">Alle</button>
                <button [class.active]="appointmentTypeFilter() === 'series'" (click)="setAppointmentTypeFilter('series')">Serie</button>
                <button [class.active]="appointmentTypeFilter() === 'single'" (click)="setAppointmentTypeFilter('single')">Einzel</button>
              </div>
            </div>
          </div>

          @if (loading()) {
            <div class="table-loading-overlay">
              <div class="loading-spinner"></div>
              <span>Termine werden geladen...</span>
            </div>
          } @else if (viewMode() === 'single') {
            <!-- SINGLE APPOINTMENTS VIEW -->
            @if (filteredAppointments().length === 0) {
              <div class="empty-state">
                <p>Keine Termine gefunden.</p>
                @if (hasActiveFilters()) {
                  <button class="btn-link" (click)="resetFilters()">Filter zurücksetzen</button>
                }
              </div>
            } @else {
              <div class="table-wrapper">
                <table class="appointments-table">
                  <thead>
                    <tr>
                      <th class="col-date sortable" (click)="toggleSort('date')">
                        Datum <span class="sort-icon">{{ sortField === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th class="col-time sortable" (click)="toggleSort('time')">
                        Zeit <span class="sort-icon">{{ sortField === 'time' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th class="col-patient sortable" (click)="toggleSort('patient')">
                        Patient <span class="sort-icon">{{ sortField === 'patient' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th class="col-therapist sortable" (click)="toggleSort('therapist')">
                        Therapeut <span class="sort-icon">{{ sortField === 'therapist' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th class="col-type">Behandlung</th>
                      <th class="col-status">Status</th>
                      <th class="col-comment">Kommentar</th>
                      <th class="col-actions-apt">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (apt of paginatedAppointments(); track apt.id) {
                      <tr class="apt-row"
                          [class.cancelled]="apt.status === 'CANCELLED'"
                          [class.completed]="apt.status === 'COMPLETED'">
                        <td class="col-date">{{ formatDateDE(apt.date) }}</td>
                        <td class="col-time">{{ formatTime(apt.startTime) }}–{{ formatTime(apt.endTime) }} Uhr</td>
                        <td class="col-patient">
                          <a [routerLink]="['/dashboard/patients', apt.patientId]" class="link-blue">{{ apt.patientName || 'Kein Patient' }}</a>
                          @if (apt.isBWO) { <span class="tag bwo">BWO</span> }
                        </td>
                        <td class="col-therapist">
                          <a [routerLink]="['/dashboard/therapists', apt.therapistId]">{{ apt.therapistName }}</a>
                        </td>
                        <td class="col-type">
                          <div class="treatment-tags">
                            @if (apt.isHotair) { <span class="tag hotair">HL</span> }
                            @if (apt.isUltrasonic) { <span class="tag ultra">US</span> }
                            @if (apt.isElectric) { <span class="tag electro">ET</span> }
                            @if (!apt.isHotair && !apt.isUltrasonic && !apt.isElectric) { <span class="tag default">KG</span> }
                          </div>
                        </td>
                        <td class="col-status">
                          <span class="status-badge" [class]="'status-' + apt.status.toLowerCase()">{{ statusLabel(apt.status) }}</span>
                        </td>
                        <td class="col-comment">{{ apt.comment || '–' }}</td>
                        <td class="col-actions-apt">
                          <div class="action-btns">
                            <button class="action-btn" title="Im Kalender anzeigen" (click)="navigateToDay(apt.date)">&#128197;</button>
                            <button class="action-btn" title="Termin bearbeiten" (click)="navigateToEdit(apt)">&#9998;</button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              @if (totalPages() > 1) {
                <div class="pagination">
                  <button class="page-btn" [disabled]="currentPage() === 1" (click)="goToPage(currentPage() - 1)">‹</button>
                  @for (p of pageNumbers(); track p) {
                    <button class="page-btn" [class.active]="p === currentPage()" (click)="goToPage(p)">{{ p }}</button>
                  }
                  <button class="page-btn" [disabled]="currentPage() === totalPages()" (click)="goToPage(currentPage() + 1)">›</button>
                  <span class="page-info">{{ currentPage() }} / {{ totalPages() }}</span>
                </div>
              }
            }
          } @else {
            <!-- SERIES VIEW -->
            @if (filteredSeries().length === 0) {
              <div class="empty-state">
                <p>Keine Serientermine gefunden.</p>
                @if (hasActiveFilters()) {
                  <button class="btn-link" (click)="resetFilters()">Filter zurücksetzen</button>
                }
              </div>
            } @else {
              <div class="table-wrapper">
                <table class="appointments-table">
                  <thead>
                    <tr>
                      <th class="sortable" (click)="toggleSeriesSort('patient')">
                        Patient <span class="sort-icon">{{ seriesSortField === 'patient' ? (seriesSortDir === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th class="sortable" (click)="toggleSeriesSort('therapist')">
                        Therapeut <span class="sort-icon">{{ seriesSortField === 'therapist' ? (seriesSortDir === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th class="sortable" (click)="toggleSeriesSort('weekday')">
                        Wochentag <span class="sort-icon">{{ seriesSortField === 'weekday' ? (seriesSortDir === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th class="sortable" (click)="toggleSeriesSort('time')">
                        Uhrzeit <span class="sort-icon">{{ seriesSortField === 'time' ? (seriesSortDir === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th class="sortable" (click)="toggleSeriesSort('startDate')">
                        Zeitraum <span class="sort-icon">{{ seriesSortField === 'startDate' ? (seriesSortDir === 'asc' ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th>Intervall</th>
                      <th>Status</th>
                      <th>Ausfälle</th>
                      <th class="col-actions-apt">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (s of paginatedSeries(); track s.id) {
                      <tr class="apt-row clickable-row" [class.cancelled]="s.status === 'CANCELLED'" (click)="openSeriesEditModal(s)" title="Klicken zum Bearbeiten">
                        <td (click)="$event.stopPropagation()">
                          <a [routerLink]="['/dashboard/patients', s.patientId]" class="link-blue">{{ s.patientName || 'Kein Patient' }}</a>
                        </td>
                        <td>
                          <a [routerLink]="['/dashboard/therapists', s.therapistId]" class="link-gray">{{ s.therapistName }}</a>
                        </td>
                        <td>{{ weekdayLabel(s.weekday) }}</td>
                        <td class="col-time">{{ formatSeriesTime(s.startTime) }}–{{ formatSeriesTime(s.endTime) }} Uhr</td>
                        <td class="col-date">{{ formatDateDE(s.startDate) }} – {{ formatDateDE(s.endDate) }}</td>
                        <td>{{ (s.weeklyFrequency != null) ? (s.weeklyFrequency === 1 ? 'Wöchentlich' : 'Alle ' + s.weeklyFrequency + ' Wo.') : '–' }}</td>
                        <td>
                          <span class="status-badge" [class]="'status-' + s.status.toLowerCase()">{{ seriesStatusLabel(s.status) }}</span>
                        </td>
                        <td>
                          @if (s.cancellations && s.cancellations.length > 0) {
                            <span class="cancel-count" title="Ausfälle anzeigen" (click)="toggleCancellationView(s)">
                              {{ s.cancellations.length }} Ausf.
                            </span>
                          } @else {
                            <span class="no-cancellations">–</span>
                          }
                        </td>
                        <td class="col-actions-apt" (click)="$event.stopPropagation()">
                          <div class="action-btns">
                            <button class="action-btn" title="Nächsten Termin im Kalender anzeigen" (click)="navigateToSeriesDay(s)">&#128197;</button>
                            <button class="action-btn" title="Ausfall eintragen" (click)="openCancellationModal(s)">&#10006;</button>
                            <button class="action-btn" title="Serie löschen" (click)="confirmDeleteSeries(s)">&#128465;</button>
                          </div>
                        </td>
                      </tr>
                      @if (expandedSeriesId === s.id && s.cancellations && s.cancellations.length > 0) {
                        <tr class="cancellation-row">
                          <td colspan="9">
                            <div class="cancellation-list">
                              <strong>Ausfälle:</strong>
                              @for (c of s.cancellations; track c.date) {
                                <span class="cancellation-chip">{{ formatDateDE(c.date) }}</span>
                              }
                            </div>
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>

              @if (totalSeriesPages() > 1) {
                <div class="pagination">
                  <button class="page-btn" [disabled]="currentSeriesPage() === 1" (click)="goToSeriesPage(currentSeriesPage() - 1)">‹</button>
                  @for (p of seriesPageNumbers(); track p) {
                    <button class="page-btn" [class.active]="p === currentSeriesPage()" (click)="goToSeriesPage(p)">{{ p }}</button>
                  }
                  <button class="page-btn" [disabled]="currentSeriesPage() === totalSeriesPages()" (click)="goToSeriesPage(currentSeriesPage() + 1)">›</button>
                  <span class="page-info">{{ currentSeriesPage() }} / {{ totalSeriesPages() }}</span>
                </div>
              }
            }
          }
        </div>
      </div>
    </div>

    <!-- Cancellation Modal -->
    @if (showCancellationModal()) {
      <div class="modal-overlay" (click)="closeCancellationModal()">
        <div class="modal modal-cancellations" (click)="$event.stopPropagation()">
          <div class="modal-header-bar">
            <h2>Ausfälle verwalten</h2>
            <button class="btn-close" (click)="closeCancellationModal()">&times;</button>
          </div>
          <p class="modal-sub">Serie: {{ cancellationSeries()?.patientName }} – {{ weekdayLabel(cancellationSeries()?.weekday || '') }}</p>

          <!-- Existing cancellations table -->
          @if (cancellationSeries()?.cancellations && cancellationSeries()!.cancellations!.length > 0) {
            <div class="cancellations-table-wrapper">
              <table class="cancellations-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Wochentag</th>
                    <th class="col-actions">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of cancellationSeries()!.cancellations!; track c.id || c.date) {
                    <tr>
                      <td>{{ formatDateDE(c.date) }}</td>
                      <td>{{ getWeekdayName(c.date) }}</td>
                      <td class="col-actions">
                        <button class="btn-remove-cancellation" title="Ausfall entfernen (Termin wiederherstellen)" (click)="removeCancellation(cancellationSeries()!.id, c.id!)" [disabled]="deletingCancellation()">
                          &#128465;
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="no-cancellations-message">Keine Ausfälle vorhanden.</p>
          }

          <!-- Add new cancellation -->
          <div class="add-cancellation-section">
            <h4>Neuen Ausfall eintragen</h4>
            <div class="add-cancellation-row">
              <select [(ngModel)]="newCancellationDate" class="date-select">
                <option value="">Datum wählen...</option>
                @for (d of availableCancellationDates(); track d) {
                  <option [ngValue]="d">{{ formatDateDE(d) }} ({{ getWeekdayName(d) }})</option>
                }
              </select>
              <button class="btn btn-primary" [disabled]="!newCancellationDate" (click)="saveCancellation()">Hinzufügen</button>
            </div>
            @if (availableCancellationDates().length === 0) {
              <p class="no-dates-hint">Keine verfügbaren Termine mehr.</p>
            }
          </div>

          <div class="modal-actions-bar">
            <button class="btn-secondary" (click)="closeCancellationModal()">Schließen</button>
          </div>
        </div>
      </div>
    }

    <!-- Delete Series Confirmation -->
    @if (showDeleteSeriesModal()) {
      <div class="modal-overlay" (click)="showDeleteSeriesModal.set(false)">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <h2>Serie löschen?</h2>
          <p>Möchten Sie die Serie von "{{ seriesToDelete()?.patientName }}" wirklich löschen?</p>
          <div class="modal-actions-bar">
            <button class="btn-secondary" (click)="showDeleteSeriesModal.set(false)">Abbrechen</button>
            <button class="btn-danger" (click)="deleteSeries()">Löschen</button>
          </div>
        </div>
      </div>
    }

    <!-- Series Edit Modal -->
    @if (showSeriesEditModal() && editingSeries()) {
      <div class="modal-overlay" (click)="closeSeriesEditModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header-bar">
            <h2>Serie bearbeiten</h2>
            <button class="btn-close" (click)="closeSeriesEditModal()">&times;</button>
          </div>

          <div class="series-info-banner" style="margin-bottom: 1rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>Änderungen werden auf alle zukünftigen Termine dieser Serie angewendet.</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="font-weight: 600; color: #6B7280; font-size: 0.8rem;">Patient</label>
              <p style="margin: 0.25rem 0 0 0; color: #374151; font-weight: 500;">{{ editingSeries()?.patientName }}</p>
            </div>
            <div>
              <label style="font-weight: 600; color: #6B7280; font-size: 0.8rem;">Therapeut</label>
              <p style="margin: 0.25rem 0 0 0; color: #374151;">{{ editingSeries()?.therapistName }}</p>
            </div>
          </div>

          <form (ngSubmit)="saveSeriesEdit()">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label>Beginn</label>
                <input type="time" [(ngModel)]="seriesEditForm.startTime" name="startTime" />
              </div>
              <div class="form-group">
                <label>Ende</label>
                <input type="time" [(ngModel)]="seriesEditForm.endTime" name="endTime" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label>Enddatum</label>
                <input type="date" [(ngModel)]="seriesEditForm.endDate" name="endDate" />
              </div>
              <div class="form-group">
                <label>Intervall</label>
                <select [(ngModel)]="seriesEditForm.weeklyFrequency" name="weeklyFrequency">
                  <option [ngValue]="1">Jede Woche</option>
                  <option [ngValue]="2">Alle 2 Wochen</option>
                  <option [ngValue]="3">Alle 3 Wochen</option>
                  <option [ngValue]="4">Alle 4 Wochen</option>
                </select>
              </div>
            </div>

            <div style="display: flex; gap: 1.5rem; margin-bottom: 1rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" [(ngModel)]="seriesEditForm.isHotair" name="isHotair" />
                Heißluft
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" [(ngModel)]="seriesEditForm.isUltrasonic" name="isUltrasonic" />
                Ultraschall
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" [(ngModel)]="seriesEditForm.isElectric" name="isElectric" />
                Elektrotherapie
              </label>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label>Kommentar</label>
              <textarea [(ngModel)]="seriesEditForm.comment" name="comment" rows="2" placeholder="Optionale Bemerkung..."></textarea>
            </div>

            <div class="modal-actions-bar">
              <button type="button" class="btn-secondary" (click)="closeSeriesEditModal()">Abbrechen</button>
              <button type="submit" class="btn btn-primary" [disabled]="savingSeriesEdit()">
                {{ savingSeriesEdit() ? 'Speichern...' : 'Speichern' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Patient Detail Modal -->
    @if (showPatientDetail() && selectedPatient()) {
      <div class="modal-overlay" (click)="closePatientDetail()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header-bar">
            <h2>{{ selectedPatient()?.firstName }} {{ selectedPatient()?.lastName }}</h2>
            <button class="btn-close" (click)="closePatientDetail()">&times;</button>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
            <div>
              <label style="font-weight: 600; color: #6B7280; font-size: 0.8rem;">E-Mail:</label>
              <p style="margin: 0.25rem 0 0 0; color: #374151;">{{ selectedPatient()?.email || '–' }}</p>
            </div>
            <div>
              <label style="font-weight: 600; color: #6B7280; font-size: 0.8rem;">Telefon:</label>
              <p style="margin: 0.25rem 0 0 0; color: #374151;">{{ selectedPatient()?.telefon || '–' }}</p>
            </div>
            <div>
              <label style="font-weight: 600; color: #6B7280; font-size: 0.8rem;">Adresse:</label>
              <p style="margin: 0.25rem 0 0 0; color: #374151;">{{ selectedPatient()?.street }} {{ selectedPatient()?.houseNumber }}, {{ selectedPatient()?.postalCode }} {{ selectedPatient()?.city }}</p>
            </div>
            <div>
              <label style="font-weight: 600; color: #6B7280; font-size: 0.8rem;">BWO:</label>
              <p style="margin: 0.25rem 0 0 0; color: #374151;">{{ selectedPatient()?.isBWO ? 'Ja' : 'Nein' }}</p>
            </div>
          </div>
          <div class="modal-actions-bar">
            <button class="btn-secondary" (click)="closePatientDetail()">Schließen</button>
            <button class="btn btn-primary" (click)="navigateToPatient(selectedPatient()!.id); closePatientDetail()">Zum Patienten</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .overview-container { display: flex; flex-direction: column; height: 100%; background: #F9FAFB; }
    .page-header { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; background: white; border-bottom: 1px solid #E5E7EB; }
    .page-header h1 { margin: 0; font-size: 1.25rem; color: #111827; }
    .result-count { font-size: 0.8rem; color: #6B7280; background: #E5E7EB; padding: 0.2rem 0.6rem; border-radius: 12px; }
    .view-tabs { display: flex; gap: 0; border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; }
    .view-tab { padding: 0.4rem 1rem; border: none; background: #F9FAFB; cursor: pointer; font-size: 0.8rem; font-weight: 500; color: #6B7280; transition: all 0.15s; }
    .view-tab:first-child { border-right: 1px solid #E5E7EB; }
    .view-tab.active { background: #2563EB; color: white; }
    .view-tab:hover:not(.active) { background: #EFF6FF; color: #2563EB; }
    .overview-layout { display: flex; flex: 1; overflow: hidden; }

    /* Filter Sidebar LEFT */
    .filter-sidebar { width: 250px; flex-shrink: 0; background: white; border-right: 1px solid #E5E7EB; overflow-y: auto; padding: 1rem; }
    .filter-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .filter-header h3 { margin: 0; font-size: 0.9rem; color: #111827; }
    .btn-reset { border: none; background: none; color: #3B82F6; cursor: pointer; font-size: 0.75rem; }
    .btn-reset:hover { text-decoration: underline; }
    .filter-group { margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid #F3F4F6; }
    .filter-group:last-child { border-bottom: none; }
    .filter-group h4 { margin: 0 0 0.5rem; font-size: 0.75rem; color: #6B7280; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
    .date-range { display: flex; flex-direction: column; gap: 0.35rem; }
    .date-range label { font-size: 0.7rem; color: #9CA3AF; }
    .date-range input { padding: 0.35rem 0.5rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.8rem; outline: none; }
    .date-range input:focus { border-color: #3B82F6; }
    .quick-dates { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.5rem; }
    .quick-btn { padding: 0.2rem 0.5rem; border: 1px solid #E5E7EB; background: #F9FAFB; border-radius: 4px; font-size: 0.65rem; cursor: pointer; color: #6B7280; }
    .quick-btn:hover { background: #EFF6FF; color: #3B82F6; border-color: #BFDBFE; }
    .filter-options { display: flex; flex-direction: column; gap: 0.15rem; }
    .filter-options.scrollable { max-height: 160px; overflow-y: auto; }
    .filter-option { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; padding: 0.2rem 0.25rem; border-radius: 4px; font-size: 0.75rem; color: #374151; transition: background 0.1s; }
    .filter-option:hover { background: #F3F4F6; }
    .filter-option input[type="checkbox"] { width: 14px; height: 14px; accent-color: #3B82F6; flex-shrink: 0; }

    /* Main Table */
    .table-section { flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 1rem; gap: 0.75rem; }
    .search-bar { position: relative; }
    .apt-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid #F3F4F6; }
    .filter-tabs { display: flex; gap: 0.25rem; }
    .filter-tabs button { background: none; border: 1px solid #E5E7EB; padding: 0.25rem 0.5rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: #6B7280; }
    .filter-tabs button.active { background: #E6F0FF; color: #2563EB; border-color: #3B82F6; }
    .filter-tabs.type-filter { margin-left: auto; }
    .search-input { width: 100%; padding: 0.6rem 2rem 0.6rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 0.875rem; outline: none; background: white; box-sizing: border-box; }
    .search-input:focus { border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .search-clear { position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); border: none; background: none; font-size: 1.25rem; cursor: pointer; color: #9CA3AF; }
    .search-clear:hover { color: #374151; }
    .sort-bar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .sort-label { font-size: 0.75rem; color: #6B7280; }
    .sort-btn { padding: 0.25rem 0.5rem; border: 1px solid #E5E7EB; background: white; border-radius: 4px; font-size: 0.7rem; cursor: pointer; color: #6B7280; transition: all 0.15s; }
    .sort-btn:hover { background: #F3F4F6; }
    .sort-btn.active { background: #EFF6FF; border-color: #3B82F6; color: #2563EB; font-weight: 500; }
    .loading { padding: 3rem; text-align: center; color: #6B7280; }
    .empty-state { padding: 3rem; text-align: center; color: #6B7280; }
    .btn-link { border: none; background: none; color: #3B82F6; cursor: pointer; font-size: 0.875rem; text-decoration: underline; }
    .table-wrapper { flex: 1; overflow: auto; border: 1px solid #E5E7EB; border-radius: 8px; background: white; }
    .appointments-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
    .appointments-table thead { position: sticky; top: 0; z-index: 1; }
    .appointments-table th { background: #F9FAFB; padding: 0.35rem 0.5rem; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #E5E7EB; white-space: nowrap; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .appointments-table th.sortable { cursor: pointer; user-select: none; transition: background 0.15s; }
    .appointments-table th.sortable:hover { background: #EFF6FF; color: #2563EB; }
    .sort-icon { font-size: 0.6rem; color: #9CA3AF; margin-left: 0.15rem; }
    .appointments-table th.sortable:hover .sort-icon { color: #2563EB; }
    .appointments-table td { padding: 0.25rem 0.5rem; border-bottom: 1px solid #F3F4F6; color: #374151; vertical-align: middle; height: 24px; }
    .apt-row { transition: background 0.1s; }
    .apt-row:hover { background: #F0F7FF; }
    .apt-row.cancelled { opacity: 0.5; }
    .apt-row.completed td { color: #6B7280; }
    .apt-row.clickable-row { cursor: pointer; }
    .apt-row.clickable-row:hover { background: #EFF6FF; }
    .col-date { white-space: nowrap; }
    .col-time { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .col-patient { min-width: 100px; }
    .col-patient a, .link-blue { color: #3B82F6; text-decoration: none; font-weight: 500; cursor: pointer; }
    .col-patient a:hover, .link-blue:hover { text-decoration: underline; }
    .col-therapist { min-width: 100px; }
    .col-therapist a, .link-gray { color: #6B7280; text-decoration: none; }
    .col-therapist a:hover, .link-gray:hover { text-decoration: underline; color: #3B82F6; }
    .col-type { width: 70px; }
    .col-status { width: 75px; }
    .col-comment { max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #9CA3AF; font-size: 0.65rem; }
    .col-actions-apt { width: 70px; white-space: nowrap; }
    .treatment-tags { display: flex; gap: 2px; }
    .tag { display: inline-block; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.6rem; font-weight: 600; }
    .tag.hotair { background: #FEE2E2; color: #991B1B; }
    .tag.ultra { background: #EDE9FE; color: #5B21B6; }
    .tag.electro { background: #D1FAE5; color: #065F46; }
    .tag.default { background: #E5E7EB; color: #6B7280; }
    .tag.bwo { background: #FEF3C7; color: #92400E; font-size: 0.55rem; margin-left: 0.25rem; }
    .tag.series { background: #EDE9FE; color: #5B21B6; }
    .tag.single { background: #E5E7EB; color: #6B7280; }
    .status-badge { font-size: 0.6rem; padding: 0.1rem 0.35rem; border-radius: 3px; font-weight: 500; white-space: nowrap; }
    .status-scheduled { background: #DBEAFE; color: #1E40AF; }
    .status-confirmed { background: #D1FAE5; color: #065F46; }
    .status-cancelled { background: #FEE2E2; color: #991B1B; }
    .status-completed { background: #E5E7EB; color: #374151; }
    .status-no_show { background: #FEF3C7; color: #92400E; }
    .status-active { background: #D1FAE5; color: #065F46; }
    .status-paused { background: #FEF3C7; color: #92400E; }

    /* Action buttons */
    .action-btns { display: flex; gap: 0.25rem; }
    .action-btn { width: 32px; height: 32px; border: 1px solid #E5E7EB; background: white; border-radius: 4px; cursor: pointer; font-size: 1rem; line-height: 1; display: flex; align-items: center; justify-content: center; transition: all 0.15s; font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .action-btn:hover { background: #EFF6FF; border-color: #3B82F6; }

    /* Cancellation display */
    .cancel-count { color: #DC2626; font-size: 0.75rem; font-weight: 500; cursor: pointer; text-decoration: underline; }
    .cancel-count:hover { color: #991B1B; }
    .no-cancellations { color: #9CA3AF; }
    .cancellation-row td { background: #FEF2F2; padding: 0.5rem 0.6rem; }
    .cancellation-list { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; font-size: 0.75rem; }
    .cancellation-chip { background: #FEE2E2; color: #991B1B; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 500; }
    .existing-cancellations { margin-top: 1rem; }
    .existing-cancellations label { font-size: 0.8rem; color: #6B7280; margin-bottom: 0.35rem; display: block; }
    .cancellation-chips { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.25rem; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 450px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .modal-sm { max-width: 400px; }
    .modal h2 { margin: 0 0 1rem 0; color: #2563EB; font-size: 1.15rem; }
    .modal p { color: #6B7280; margin-bottom: 1rem; font-size: 0.875rem; }
    .modal-header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .modal-header-bar h2 { margin: 0; }
    .btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6B7280; }
    .btn-close:hover { color: #111827; }
    .modal-sub { font-size: 0.8rem; color: #6B7280; margin: 0 0 1rem 0; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; color: #374151; font-size: 0.875rem; }
    .form-group input[type="date"] { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; box-sizing: border-box; }
    .form-group input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .modal-actions-bar { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
    .btn-primary { background: #2563EB; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-primary:hover { background: #1D4ED8; }
    .btn-primary:disabled { opacity: 0.5; cursor: default; }
    .btn-secondary { background: #E5E7EB; color: #374151; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-secondary:hover { background: #D1D5DB; }
    .btn-danger { background: #EF4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-danger:hover { background: #DC2626; }

    /* Cancellations modal */
    .modal-cancellations { max-width: 550px; }
    .cancellations-table-wrapper { max-height: 250px; overflow-y: auto; border: 1px solid #E5E7EB; border-radius: 8px; margin-bottom: 1rem; }
    .cancellations-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .cancellations-table th { background: #F9FAFB; padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB; font-size: 0.75rem; }
    .cancellations-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #F3F4F6; color: #374151; }
    .cancellations-table .col-actions { width: 50px; text-align: center; }
    .btn-remove-cancellation { border: 1px solid #FCA5A5; background: #FEF2F2; color: #DC2626; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .btn-remove-cancellation:hover { background: #FEE2E2; border-color: #DC2626; }
    .btn-remove-cancellation:disabled { opacity: 0.5; cursor: not-allowed; }
    .no-cancellations-message { color: #9CA3AF; font-size: 0.85rem; text-align: center; padding: 1rem; }
    .add-cancellation-section { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 1rem; }
    .add-cancellation-section h4 { margin: 0 0 0.75rem; font-size: 0.85rem; color: #374151; }
    .add-cancellation-row { display: flex; gap: 0.5rem; }
    .add-cancellation-row .date-input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; }
    .add-cancellation-row .date-select { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; background: white; }
    .add-cancellation-row .btn-primary { flex-shrink: 0; }
    .no-dates-hint { color: #9CA3AF; font-size: 0.75rem; margin-top: 0.5rem; text-align: center; }

    .pagination { display: flex; align-items: center; gap: 0.25rem; padding: 0.5rem 0; justify-content: center; }
    .page-btn { min-width: 28px; height: 28px; border: 1px solid #E5E7EB; background: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem; color: #374151; display: flex; align-items: center; justify-content: center; }
    .page-btn:hover:not(:disabled) { background: #F3F4F6; }
    .page-btn:disabled { opacity: 0.4; cursor: default; }
    .page-btn.active { background: #3B82F6; color: white; border-color: #3B82F6; }
    .page-info { font-size: 0.7rem; color: #9CA3AF; margin-left: 0.5rem; }
  `]
})
export class AppointmentOverviewComponent implements OnInit, OnDestroy {
  private appointmentService = inject(AppointmentService);
  private seriesService = inject(AppointmentSeriesService);
  private therapistService = inject(TherapistService);
  private patientService = inject(PatientService);
  private toastService = inject(ToastService);
  private cacheService = inject(AppointmentCacheService);
  private router = inject(Router);

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  loading = signal(true);
  viewMode = signal<'single' | 'series'>('single');

  // Server-side pagination state
  serverPage = signal<PageResponse<Appointment> | null>(null);

  // Single appointments (from server pagination)
  paginatedAppointments = computed(() => this.serverPage()?.content ?? []);
  totalElements = computed(() => this.serverPage()?.totalElements ?? 0);
  totalPages = computed(() => this.serverPage()?.totalPages ?? 1);
  currentPage = computed(() => (this.serverPage()?.number ?? 0) + 1); // Convert 0-indexed to 1-indexed

  // Series
  allSeries = signal<AppointmentSeries[]>([]);
  filteredSeries = signal<AppointmentSeries[]>([]);

  therapists = signal<Therapist[]>([]);

  // Search (with debounce)
  searchTerm = '';
  private readonly SEARCH_DEBOUNCE_MS = 300;

  // Sorting (single appointments) - server-side
  sortField: 'date' | 'patient' | 'therapist' | 'time' = 'date';
  sortDir: 'asc' | 'desc' = 'desc';

  // Sorting (series) - client-side
  seriesSortField: 'patient' | 'therapist' | 'weekday' | 'time' | 'startDate' = 'startDate';
  seriesSortDir: 'asc' | 'desc' = 'desc';

  // Pagination - single (server-side)
  pageSize = 50;
  requestedPage = signal(0); // 0-indexed for server

  // Pagination - series (client-side)
  currentSeriesPage = signal(1);

  // Filters
  filterDateFrom = '';
  filterDateTo = '';
  filterTherapistIds = new Set<number>();
  filterTreatments = new Set<string>();
  filterStatuses = new Set<string>();
  filterSeriesStatuses = new Set<string>();
  filterBWO = false;
  // time / type filters (like in Patient-Detail)
  appointmentFilter = signal<'upcoming' | 'past' | 'all'>('all');
  appointmentTypeFilter = signal<'all' | 'series' | 'single'>('all');

  // Cancellation modal
  showCancellationModal = signal(false);
  cancellationSeries = signal<AppointmentSeries | null>(null);
  newCancellationDate = '';
  deletingCancellation = signal(false);

  // Computed: available dates for adding cancellations (future occurrences not yet cancelled)
  availableCancellationDates = computed(() => {
    const series = this.cancellationSeries();
    if (!series) return [];
    return this.calculateSeriesOccurrences(series);
  });

  // Delete series modal
  showDeleteSeriesModal = signal(false);
  seriesToDelete = signal<AppointmentSeries | null>(null);

  // Series edit modal
  showSeriesEditModal = signal(false);
  editingSeries = signal<AppointmentSeries | null>(null);
  seriesEditForm = {
    startTime: '',
    endTime: '',
    endDate: '',
    weeklyFrequency: 1,
    comment: '',
    isHotair: false,
    isUltrasonic: false,
    isElectric: false
  };
  savingSeriesEdit = signal(false);

  // Patient detail modal
  showPatientDetail = signal(false);
  selectedPatient = signal<any>(null);

  // Expanded series row for cancellations
  expandedSeriesId: number | null = null;

  allStatuses = [
    { value: 'SCHEDULED', label: 'Geplant' },
    { value: 'CONFIRMED', label: 'Bestätigt' },
    { value: 'COMPLETED', label: 'Abgeschlossen' },
    { value: 'CANCELLED', label: 'Storniert' },
    { value: 'NO_SHOW', label: 'Nicht erschienen' }
  ];

  seriesStatuses = [
    { value: 'ACTIVE', label: 'Aktiv' },
    { value: 'PAUSED', label: 'Pausiert' },
    { value: 'CANCELLED', label: 'Storniert' },
    { value: 'COMPLETED', label: 'Abgeschlossen' }
  ];

  totalSeriesPages = computed(() => Math.max(1, Math.ceil(this.filteredSeries().length / this.pageSize)));

  paginatedSeries = computed(() => {
    const start = (this.currentSeriesPage() - 1) * this.pageSize;
    return this.filteredSeries().slice(start, start + this.pageSize);
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  seriesPageNumbers = computed(() => {
    const total = this.totalSeriesPages();
    const current = this.currentSeriesPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  ngOnInit(): void {
    this.setupSearchDebounce();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Setup debounced search to reduce API calls during typing.
   */
  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      takeUntil(this.destroy$),
      debounceTime(this.SEARCH_DEBOUNCE_MS),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm = term;
      this.requestedPage.set(0); // Reset to first page on search
      this.applyFilters(); // Use applyFilters to handle both single and series viewMode
    });
  }

  setViewMode(mode: 'single' | 'series'): void {
    this.viewMode.set(mode);
    this.resetFilters();
    if (mode === 'series' && this.allSeries().length === 0) {
      this.loadSeries();
    }
  }

  loadData(): void {
    this.loading.set(true);
    this.therapistService.getAll().subscribe({
      next: (t) => this.therapists.set(t.filter(x => x.isActive && x.id != null && x.fullName))
    });
    // Fetch paginated appointments from server
    this.fetchAppointments();
  }

  /**
   * Fetch appointments from server with current filters and pagination.
   * Uses server-side filtering and sorting for optimal performance.
   */
  private fetchAppointments(): void {
    this.loading.set(true);

    const baseParams: AppointmentPageParams = {
      page: this.requestedPage(),
      size: this.pageSize,
      sortBy: this.sortField,
      sortDir: this.sortDir,
      dateFrom: this.filterDateFrom || undefined,
      dateTo: this.filterDateTo || undefined,
      therapistId: this.getSelectedTherapistId(),
      status: this.getSelectedStatus(),
      search: this.searchTerm || undefined
    };

    // Prefer server-side extended API when time/type filters are active; otherwise keep using cacheService
    const timeFilter = this.appointmentFilter() === 'all' ? undefined : (this.appointmentFilter() as 'upcoming' | 'past');
    const appointmentType = this.appointmentTypeFilter() === 'all' ? undefined : (this.appointmentTypeFilter() as 'series' | 'single');

    if (timeFilter || appointmentType) {
      const extParams: AppointmentExtendedPageParams = {
        ...baseParams,
        timeFilter,
        appointmentType
      };

      this.appointmentService.getPaginatedExtended(extParams).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (pageResult) => {
          this.serverPage.set(pageResult);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toastService.show('Fehler beim Laden der Termine', 'error');
        }
      });

    } else {
      this.cacheService.getPaginated(baseParams).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (pageResult) => {
          this.serverPage.set(pageResult);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toastService.show('Fehler beim Laden der Termine', 'error');
        }
      });
    }
  }

  /**
   * Get the first selected therapist ID for server-side filter.
   * Note: For multiple therapists, client-side filtering is applied.
   */
  private getSelectedTherapistId(): number | undefined {
    if (this.filterTherapistIds.size === 1) {
      return Array.from(this.filterTherapistIds)[0];
    }
    return undefined;
  }

  /**
   * Get the first selected status for server-side filter.
   * Note: For multiple statuses, client-side filtering is applied.
   */
  private getSelectedStatus(): string | undefined {
    if (this.filterStatuses.size === 1) {
      return Array.from(this.filterStatuses)[0];
    }
    return undefined;
  }

  loadSeries(): void {
    this.seriesService.getAll().subscribe({
      next: (series) => {
        this.allSeries.set(series || []);
        this.applyFilters();
      },
      error: () => {
        this.toastService.show('Fehler beim Laden der Serientermine', 'error');
      }
    });
  }

  // ================== Filtering ==================

  applyFilters(): void {
    if (this.viewMode() === 'single') {
      this.applyAppointmentFilters();
    } else {
      this.applySeriesFilters();
    }
  }

  /**
   * Apply appointment filters - triggers server-side fetch with new parameters.
   */
  private applyAppointmentFilters(): void {
    // Reset to first page when filters change
    this.requestedPage.set(0);
    // Fetch with new filters from server
    this.fetchAppointments();
  }

  /**
   * Handle search input - debounced to reduce API calls.
   */
  onSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchSubject.next(term);
  }

  /**
   * Get filtered appointments - applies client-side filters that aren't supported server-side.
   * (e.g., multiple therapists, treatment types, BWO filter)
   */
  filteredAppointments = computed(() => {
    let result = this.paginatedAppointments();

    // Apply client-side filters for multi-select and treatment types
    if (this.filterTherapistIds.size > 1) {
      result = result.filter(a => this.filterTherapistIds.has(a.therapistId));
    }

    if (this.filterTreatments.size > 0) {
      result = result.filter(a => {
        if (this.filterTreatments.has('hotair') && a.isHotair) return true;
        if (this.filterTreatments.has('ultra') && a.isUltrasonic) return true;
        if (this.filterTreatments.has('electro') && a.isElectric) return true;
        return false;
      });
    }

    if (this.filterStatuses.size > 1) {
      result = result.filter(a => this.filterStatuses.has(a.status));
    }

    if (this.filterBWO) {
      result = result.filter(a => a.isBWO);
    }

    // appointment type filter (client-side fallback)
    if (this.appointmentTypeFilter() === 'series') {
      result = result.filter(a => a.createdBySeriesAppointment || !!a.appointmentSeriesId);
    } else if (this.appointmentTypeFilter() === 'single') {
      result = result.filter(a => !(a.createdBySeriesAppointment || !!a.appointmentSeriesId));
    }

    // time filter (client-side fallback)
    if (this.appointmentFilter() === 'past') {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(a => (a.date || '').split('T')[0] < today);
    } else if (this.appointmentFilter() === 'upcoming') {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(a => (a.date || '').split('T')[0] >= today);
    }

    return result;
  });

  private applySeriesFilters(): void {
    let result = [...this.allSeries()];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(s =>
        s.patientName?.toLowerCase().includes(term) ||
        s.therapistName?.toLowerCase().includes(term) ||
        (s.comment && s.comment.toLowerCase().includes(term))
      );
    }

    if (this.filterTherapistIds.size > 0) {
      result = result.filter(s => this.filterTherapistIds.has(s.therapistId));
    }

    if (this.filterSeriesStatuses.size > 0) {
      result = result.filter(s => this.filterSeriesStatuses.has(s.status));
    }

    // Sort series
    const weekdayOrder: Record<string, number> = {
      'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4,
      'FRIDAY': 5, 'SATURDAY': 6, 'SUNDAY': 7
    };
    result.sort((a, b) => {
      let cmp = 0;
      switch (this.seriesSortField) {
        case 'patient':
          cmp = (a.patientName || '').localeCompare(b.patientName || '');
          break;
        case 'therapist':
          cmp = (a.therapistName || '').localeCompare(b.therapistName || '');
          break;
        case 'weekday':
          cmp = (weekdayOrder[a.weekday] || 0) - (weekdayOrder[b.weekday] || 0);
          break;
        case 'time':
          cmp = (a.startTime || '').localeCompare(b.startTime || '');
          break;
        case 'startDate':
          cmp = (a.startDate || '').localeCompare(b.startDate || '');
          break;
      }
      return this.seriesSortDir === 'asc' ? cmp : -cmp;
    });

    this.filteredSeries.set(result);
    this.currentSeriesPage.set(1);
  }

  // ================== Filter Toggles ==================

  toggleTherapistFilter(id: number): void {
    if (this.filterTherapistIds.has(id)) this.filterTherapistIds.delete(id);
    else this.filterTherapistIds.add(id);
    this.applyFilters();
  }

  toggleTreatment(type: string): void {
    if (this.filterTreatments.has(type)) this.filterTreatments.delete(type);
    else this.filterTreatments.add(type);
    this.applyFilters();
  }

  toggleStatus(status: string): void {
    if (this.filterStatuses.has(status)) this.filterStatuses.delete(status);
    else this.filterStatuses.add(status);
    this.applyFilters();
  }

  toggleSeriesStatus(status: string): void {
    if (this.filterSeriesStatuses.has(status)) this.filterSeriesStatuses.delete(status);
    else this.filterSeriesStatuses.add(status);
    this.applyFilters();
  }

  /**
   * Time filter (kommend / vergangen / alle) — server-side via getPaginatedExtended when active
   */
  setAppointmentFilter(filter: 'upcoming' | 'past' | 'all'): void {
    this.appointmentFilter.set(filter);
    this.requestedPage.set(0);
    this.applyFilters();
  }

  /**
   * Appointment type filter (serie / einzel / alle)
   */
  setAppointmentTypeFilter(filter: 'all' | 'series' | 'single'): void {
    this.appointmentTypeFilter.set(filter);
    this.requestedPage.set(0);
    this.applyFilters();
  }

  // ================== Sort ==================

  toggleSort(field: 'date' | 'patient' | 'therapist' | 'time'): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = field === 'date' ? 'desc' : 'asc';
    }
    this.applyFilters();
  }

  toggleSeriesSort(field: 'patient' | 'therapist' | 'weekday' | 'time' | 'startDate'): void {
    if (this.seriesSortField === field) {
      this.seriesSortDir = this.seriesSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.seriesSortField = field;
      this.seriesSortDir = field === 'startDate' ? 'desc' : 'asc';
    }
    this.applyFilters();
  }

  // ================== Quick Dates ==================

  setQuickDate(range: 'today' | 'week' | 'month' | 'all'): void {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    switch (range) {
      case 'today':
        this.filterDateFrom = fmt(today);
        this.filterDateTo = fmt(today);
        break;
      case 'week': {
        const day = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        this.filterDateFrom = fmt(monday);
        this.filterDateTo = fmt(friday);
        break;
      }
      case 'month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.filterDateFrom = fmt(start);
        this.filterDateTo = fmt(end);
        break;
      }
      case 'all':
        this.filterDateFrom = '';
        this.filterDateTo = '';
        break;
    }
    this.applyFilters();
  }

  // ================== Pagination ==================

  /**
   * Navigate to a specific page - fetches data from server.
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.requestedPage.set(page - 1); // Convert to 0-indexed for server
      this.fetchAppointments();
    }
  }

  goToSeriesPage(page: number): void {
    if (page >= 1 && page <= this.totalSeriesPages()) this.currentSeriesPage.set(page);
  }

  // ================== Series Navigation ==================

  // Navigate to the next occurrence of a series in the calendar
  navigateToSeriesDay(series: AppointmentSeries): void {
    const weekdayMap: Record<string, number> = {
      'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
      'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
    };

    const targetDay = weekdayMap[series.weekday];
    const today = new Date();
    const todayDay = today.getDay();
    let daysUntilNext = (targetDay - todayDay + 7) % 7;
    if (daysUntilNext === 0) daysUntilNext = 0; // Today is that weekday

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntilNext);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    this.router.navigate(['/dashboard/calendar'], { queryParams: { date: fmt(nextDate) } });
  }

  // Navigate to the next occurrence of a series and open it in edit (series) mode
  navigateToEditSeries(series: AppointmentSeries): void {
    const nextDateStr = this.getNextSeriesOccurrence(series);
    if (!nextDateStr) {
      this.toastService.show('Keine zukünftigen Termine in dieser Serie', 'info');
      return;
    }
    // Find the appointment ID for this date - we need to get the appointment from backend
    // For now navigate to the date with editSeriesMode flag
    this.router.navigate(['/dashboard/calendar'], {
      queryParams: { date: nextDateStr, editSeriesId: series.id }
    });
  }

  // Get the next occurrence date for a series (from today onwards)
  private getNextSeriesOccurrence(series: AppointmentSeries): string | null {
    const weekdayMap: Record<string, number> = {
      'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
      'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
    };

    const targetDay = weekdayMap[series.weekday];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(series.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(series.endDate);
    endDate.setHours(0, 0, 0, 0);
    const frequency = series.weeklyFrequency || 1;

    // Calculate the first occurrence from the start date
    let current = new Date(startDate);

    // Move to the first matching weekday on or after startDate
    let daysToAdd = (targetDay - current.getDay() + 7) % 7;
    current.setDate(current.getDate() + daysToAdd);

    // Now iterate by frequency (weeks) to find first occurrence >= today
    while (current <= endDate) {
      if (current >= today) {
        return current.toISOString().split('T')[0];
      }
      // Move forward by frequency weeks
      current.setDate(current.getDate() + frequency * 7);
    }

    return null;
  }

  // Calculate all future occurrences of a series (for cancellation dropdown)
  private calculateSeriesOccurrences(series: AppointmentSeries): string[] {
    const weekdayMap: Record<string, number> = {
      'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
      'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
    };

    const targetDay = weekdayMap[series.weekday];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(series.startDate);
    const endDate = new Date(series.endDate);
    const frequency = series.weeklyFrequency || 1;

    // Get existing cancellation dates
    const cancelledDates = new Set(
      (series.cancellations || []).map(c => c.date.split('T')[0])
    );

    const dates: string[] = [];

    // Find the first occurrence on or after today
    let current = new Date(startDate);
    // Align to target weekday
    while (current.getDay() !== targetDay) {
      current.setDate(current.getDate() + 1);
    }

    // If starting date is before series start, move forward
    while (current < startDate) {
      current.setDate(current.getDate() + 7 * frequency);
    }

    // Generate all dates from today to end
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      // Only include dates from today onwards that are not cancelled
      if (current >= today && !cancelledDates.has(dateStr)) {
        dates.push(dateStr);
      }
      current.setDate(current.getDate() + 7 * frequency);
    }

    return dates;
  }

  // ================== Actions (single appointments) ==================

  navigateToDay(dateStr: string): void {
    const date = this.extractDate(dateStr);
    this.router.navigate(['/dashboard/calendar'], { queryParams: { date } });
  }

  navigateToEdit(apt: Appointment): void {
    const date = this.extractDate(apt.date);
    this.router.navigate(['/dashboard/calendar'], { queryParams: { date, editId: apt.id } });
  }

  // ================== Series Actions ==================

  toggleCancellationView(series: AppointmentSeries): void {
    this.expandedSeriesId = this.expandedSeriesId === series.id ? null : series.id;
  }

  openCancellationModal(series: AppointmentSeries): void {
    this.cancellationSeries.set(series);
    this.newCancellationDate = '';
    this.showCancellationModal.set(true);
  }

  closeCancellationModal(): void {
    this.showCancellationModal.set(false);
    this.cancellationSeries.set(null);
  }

  saveCancellation(): void {
    const series = this.cancellationSeries();
    if (!series || !this.newCancellationDate) return;

    const cancellation: CancellationDTO = { date: this.newCancellationDate };
    this.seriesService.addCancellations(series.id, [cancellation]).subscribe({
      next: (updated) => {
        this.toastService.show('Ausfall eingetragen', 'success');
        // Update the series in the list and in the modal
        this.allSeries.update(list =>
          list.map(s => s.id === updated.id ? updated : s)
        );
        this.cancellationSeries.set(updated);
        this.newCancellationDate = '';
        this.applyFilters();
      },
      error: () => {
        this.toastService.show('Fehler beim Eintragen des Ausfalls', 'error');
      }
    });
  }

  removeCancellation(seriesId: number, cancellationId: number): void {
    this.deletingCancellation.set(true);
    this.seriesService.deleteCancellation(seriesId, cancellationId).subscribe({
      next: (updated) => {
        this.toastService.show('Ausfall entfernt', 'success');
        // Update the series in the list and in the modal
        this.allSeries.update(list =>
          list.map(s => s.id === updated.id ? updated : s)
        );
        this.cancellationSeries.set(updated);
        this.applyFilters();
        this.deletingCancellation.set(false);
      },
      error: () => {
        this.toastService.show('Fehler beim Entfernen des Ausfalls', 'error');
        this.deletingCancellation.set(false);
      }
    });
  }

  getWeekdayName(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const weekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return weekdays[date.getDay()];
  }

  confirmDeleteSeries(series: AppointmentSeries): void {
    this.seriesToDelete.set(series);
    this.showDeleteSeriesModal.set(true);
  }

  openSeriesEditModal(series: AppointmentSeries): void {
    this.editingSeries.set(series);
    // Populate form with current values
    this.seriesEditForm = {
      startTime: series.startTime ? series.startTime.substring(0, 5) : '',
      endTime: series.endTime ? series.endTime.substring(0, 5) : '',
      endDate: series.endDate ? series.endDate.split('T')[0] : '',
      weeklyFrequency: series.weeklyFrequency || 1,
      comment: series.comment || '',
      isHotair: series.isHotair || false,
      isUltrasonic: series.isUltrasonic || false,
      isElectric: series.isElectric || false
    };
    this.showSeriesEditModal.set(true);
  }

  closeSeriesEditModal(): void {
    this.showSeriesEditModal.set(false);
    this.editingSeries.set(null);
  }

  saveSeriesEdit(): void {
    const series = this.editingSeries();
    if (!series) return;

    this.savingSeriesEdit.set(true);

    // Build the update request - use a reference date for times
    const refDate = new Date().toISOString().split('T')[0];
    const request: UpdateAppointmentSeriesRequest = {
      startTime: this.seriesEditForm.startTime ? `${refDate}T${this.seriesEditForm.startTime}:00.000` : undefined,
      endTime: this.seriesEditForm.endTime ? `${refDate}T${this.seriesEditForm.endTime}:00.000` : undefined,
      endDate: this.seriesEditForm.endDate ? `${this.seriesEditForm.endDate}T00:00:00.000` : undefined,
      weeklyFrequency: this.seriesEditForm.weeklyFrequency,
      comment: this.seriesEditForm.comment || undefined,
      isHotair: this.seriesEditForm.isHotair,
      isUltrasonic: this.seriesEditForm.isUltrasonic,
      isElectric: this.seriesEditForm.isElectric
    };

    this.seriesService.update(series.id, request).subscribe({
      next: () => {
        this.toastService.show('Serie aktualisiert', 'success');
        this.loadSeries(); // Reload series list
        this.closeSeriesEditModal();
        this.savingSeriesEdit.set(false);
      },
      error: () => {
        this.toastService.show('Fehler beim Speichern der Serie', 'error');
        this.savingSeriesEdit.set(false);
      }
    });
  }

  deleteSeries(): void {
    const series = this.seriesToDelete();
    if (!series) return;

    this.seriesService.delete(series.id).subscribe({
      next: () => {
        this.toastService.show('Serie gelöscht', 'success');
        this.allSeries.update(list => list.filter(s => s.id !== series.id));
        this.applyFilters();
        this.showDeleteSeriesModal.set(false);
        this.seriesToDelete.set(null);
      },
      error: () => {
        this.toastService.show('Fehler beim Löschen der Serie', 'error');
      }
    });
  }

  showPatientDetailModal(patientId: number, patientName: string): void {
    // Fetch patient details from PatientService
    this.patientService.getById(patientId).subscribe({
      next: (patient) => {
        this.selectedPatient.set(patient);
        this.showPatientDetail.set(true);
      },
      error: () => {
        this.toastService.show('Fehler beim Laden des Patienten', 'error');
      }
    });
  }

  closePatientDetail(): void {
    this.showPatientDetail.set(false);
    this.selectedPatient.set(null);
  }

  navigateToPatient(id: number): void {
    this.router.navigate(['/dashboard/patients', id]);
  }

  // ================== Helpers ==================

  hasActiveFilters(): boolean {
    return !!(
      this.searchTerm ||
      this.filterDateFrom ||
      this.filterDateTo ||
      this.filterTherapistIds.size > 0 ||
      this.filterTreatments.size > 0 ||
      this.filterStatuses.size > 0 ||
      this.filterSeriesStatuses.size > 0 ||
      this.filterBWO
    );
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filterTherapistIds.clear();
    this.filterTreatments.clear();
    this.filterStatuses.clear();
    this.filterSeriesStatuses.clear();
    this.filterBWO = false;
    this.applyFilters();
  }

  formatTime(timeStr: string): string {
    if (!timeStr) return '';
    if (timeStr.includes('T')) return timeStr.split('T')[1].substring(0, 5);
    return timeStr.substring(0, 5);
  }

  formatSeriesTime(timeStr: string): string {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  }

  formatDateDE(dateStr: string): string {
    if (!dateStr) return '';
    const d = this.extractDate(dateStr);
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return d;
  }

  extractDate(dateStr: string): string {
    if (!dateStr) return '';
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    return dateStr.substring(0, 10);
  }

  extractTime(timeStr: string): string {
    if (!timeStr) return '';
    if (timeStr.includes('T')) return timeStr.split('T')[1].substring(0, 5);
    return timeStr.substring(0, 5);
  }

  statusLabel(status: string): string {
    const found = this.allStatuses.find(s => s.value === status);
    return found?.label || status;
  }

  seriesStatusLabel(status: string): string {
    const found = this.seriesStatuses.find(s => s.value === status);
    return found?.label || status;
  }

  weekdayLabel(weekday: string): string {
    const map: Record<string, string> = {
      'MONDAY': 'Montag', 'TUESDAY': 'Dienstag', 'WEDNESDAY': 'Mittwoch',
      'THURSDAY': 'Donnerstag', 'FRIDAY': 'Freitag', 'SATURDAY': 'Samstag', 'SUNDAY': 'Sonntag'
    };
    return map[weekday] || weekday;
  }
}
