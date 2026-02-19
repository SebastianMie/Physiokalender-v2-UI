import { Component, OnInit, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Patient, PatientService, PageResponse, PatientPageParams } from '../../data-access/api/patient.service';
import { AppointmentService, Appointment } from '../../data-access/api/appointment.service';
import { AppointmentSeriesService, AppointmentSeries } from '../../data-access/api/appointment-series.service';
import { ToastService } from '../../core/services/toast.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil, finalize } from 'rxjs';

type SortField = 'firstName' | 'lastName' | 'fullName' | 'email' | 'telefon' | 'city' | 'isBWO';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="header">
        <h1>Patienten-Verwaltung</h1>
        <button class="btn btn-primary" (click)="openCreateModal()">+ Neuer Patient</button>
      </div>

      <div class="card">
        <div class="search-bar">
          <input type="text" placeholder="Suchen..." [value]="searchTerm()" (input)="onSearchInput($event)" class="search-input" />
          <div class="pagination-controls">
            <select [(ngModel)]="itemsPerPageValue" (change)="onItemsPerPageChange()" class="items-per-page-select">
              <option [value]="10">10 pro Seite</option>
              <option [value]="25">25 pro Seite</option>
              <option [value]="50">50 pro Seite</option>
              <option [value]="100">100 pro Seite</option>
            </select>
          </div>
        </div>
        <div class="table-wrapper">
          @if (loading()) {
            <div class="loading-overlay">
              <div class="loading-spinner"></div>
              <span>Laden...</span>
            </div>
          }
          <table class="table-compact">
            <thead>
              <tr>
                <th class="sortable" (click)="sort('fullName')">Name {{ getSortIcon('fullName') }}</th>
                <th class="sortable" (click)="sort('email')">E-Mail {{ getSortIcon('email') }}</th>
                <th class="sortable" (click)="sort('telefon')">Telefon {{ getSortIcon('telefon') }}</th>
                <th class="sortable" (click)="sort('city')">Ort {{ getSortIcon('city') }}</th>
                <th class="sortable" (click)="sort('isBWO')">BWO {{ getSortIcon('isBWO') }}</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              @for (patient of serverPatients(); track patient.id) {
                <tr class="row-compact row-clickable" (click)="showPatientDetail(patient)">
                  <td class="name-cell">{{ patient.fullName || patient.firstName + ' ' + patient.lastName }}</td>
                  <td title="{{ patient.email || '' }}">{{ patient.email ? (patient.email.length > 25 ? patient.email.substring(0, 22) + '...' : patient.email) : '-' }}</td>
                  <td>{{ patient.telefon || '-' }}</td>
                  <td>{{ patient.city || '-' }}</td>
                  <td><span [class]="patient.isBWO ? 'badge badge-info' : 'badge badge-inactive'">{{ patient.isBWO ? 'Ja' : 'Nein' }}</span></td>
                  <td class="col-actions" (click)="$event.stopPropagation()">
                    <button class="btn-edit" title="Bearbeiten" (click)="editPatient(patient)">&#9998;</button>
                    <button class="btn-icon-trash" title="Löschen" (click)="confirmDelete(patient)">🗑️</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty">Keine Patienten gefunden</td></tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pagination-footer">
          <span class="pagination-info">{{ paginationStart() }}-{{ paginationEnd() }} von {{ totalElements() }}</span>
          <div class="pagination-buttons">
            <button [disabled]="currentPage() === 0 || loading()" (click)="previousPage()" class="btn-pagination">←</button>
            <span class="page-number">Seite {{ currentPage() + 1 }} / {{ totalPages() || 1 }}</span>
            <button [disabled]="currentPage() >= totalPages() - 1 || loading()" (click)="nextPage()" class="btn-pagination">→</button>
          </div>
        </div>
      </div>

      @if (showModal) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal modal-lg" (click)="$event.stopPropagation()">
            <h2>{{ editingId ? 'Patient bearbeiten' : 'Neuer Patient' }}</h2>
            <form (ngSubmit)="savePatient()">
              <div class="form-row">
                <div class="form-group"><label>Vorname *</label><input type="text" [(ngModel)]="formData.firstName" name="firstName" required /></div>
                <div class="form-group"><label>Nachname *</label><input type="text" [(ngModel)]="formData.lastName" name="lastName" required /></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>E-Mail</label><input type="email" [(ngModel)]="formData.email" name="email" /></div>
                <div class="form-group"><label>Telefon</label><input type="tel" [(ngModel)]="formData.telefon" name="telefon" /></div>
              </div>
              <hr class="divider" /><p class="section-label">Adresse</p>
              <div class="form-row">
                <div class="form-group flex-3"><label>Straße</label><input type="text" [(ngModel)]="formData.street" name="street" /></div>
                <div class="form-group flex-1"><label>Hausnr.</label><input type="text" [(ngModel)]="formData.houseNumber" name="houseNumber" /></div>
              </div>
              <div class="form-row">
                <div class="form-group flex-1"><label>PLZ</label><input type="text" [(ngModel)]="formData.postalCode" name="postalCode" /></div>
                <div class="form-group flex-3"><label>Ort</label><input type="text" [(ngModel)]="formData.city" name="city" /></div>
              </div>
              <hr class="divider" />
              <div class="form-group checkbox-group"><label><input type="checkbox" [(ngModel)]="formData.isBWO" name="isBWO" /> BWO Patient</label></div>
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeModal()">Abbrechen</button>
                <button type="submit" class="btn btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (showPatientDetailModal && selectedPatient()) {
        <div class="modal-overlay" (click)="closePatientDetailModal()">
          <div class="modal modal-detail" (click)="$event.stopPropagation()">
            <div class="detail-header">
              <h2>{{ selectedPatient()?.firstName }} {{ selectedPatient()?.lastName }}</h2>
              <button class="btn-close" (click)="closePatientDetailModal()">×</button>
            </div>

            <div class="detail-layout">
              <!-- LEFT: Patient Data -->
              <div class="detail-left">
                <h3>Stammdaten</h3>
                <form (ngSubmit)="savePatientFromDetail()" class="detail-form">
                  <div class="form-group">
                    <label>Vorname</label>
                    <input type="text" [(ngModel)]="detailFormData.firstName" name="firstName" />
                  </div>
                  <div class="form-group">
                    <label>Nachname</label>
                    <input type="text" [(ngModel)]="detailFormData.lastName" name="lastName" />
                  </div>
                  <div class="form-group">
                    <label>E-Mail</label>
                    <input type="email" [(ngModel)]="detailFormData.email" name="email" />
                  </div>
                  <div class="form-group">
                    <label>Telefon</label>
                    <input type="tel" [(ngModel)]="detailFormData.telefon" name="telefon" />
                  </div>

                  <hr class="divider" />
                  <p class="section-label">Adresse</p>

                  <div class="form-group">
                    <label>Straße</label>
                    <input type="text" [(ngModel)]="detailFormData.street" name="street" />
                  </div>
                  <div class="form-group">
                    <label>Hausnummer</label>
                    <input type="text" [(ngModel)]="detailFormData.houseNumber" name="houseNumber" />
                  </div>
                  <div class="form-group">
                    <label>PLZ</label>
                    <input type="text" [(ngModel)]="detailFormData.postalCode" name="postalCode" />
                  </div>
                  <div class="form-group">
                    <label>Ort</label>
                    <input type="text" [(ngModel)]="detailFormData.city" name="city" />
                  </div>

                  <hr class="divider" />
                  <div class="form-group checkbox-group">
                    <label>
                      <input type="checkbox" [(ngModel)]="detailFormData.isBWO" name="isBWO" />
                      BWO Patient
                    </label>
                  </div>

                  <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Speichern</button>
                    <button type="button" class="btn btn-danger" (click)="deletePatientFromDetail()">Löschen</button>
                  </div>
                </form>
              </div>

              <!-- RIGHT: Appointments -->
              <div class="detail-right">
                <div class="appointments-tabs">
                  <button class="tab" [class.active]="appointmentViewMode === 'single'" (click)="appointmentViewMode = 'single'">
                    Einzeltermine ({{ patientAppointments().length }})
                  </button>
                  <button class="tab" [class.active]="appointmentViewMode === 'series'" (click)="appointmentViewMode = 'series'">
                    Serientermine ({{ patientSeries().length }})
                  </button>
                </div>

                @if (appointmentViewMode === 'single') {
                  <div class="appointments-scroll">
                    @if (patientAppointments().length === 0) {
                      <p class="empty-message">Keine Einzeltermine</p>
                    } @else {
                      <table class="appointments-mini-table">
                        <thead>
                          <tr>
                            <th>Datum</th>
                            <th>Zeit</th>
                            <th>Therapeut</th>
                            <th>Tratment</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (apt of patientAppointments() | slice:0:50; track apt.id) {
                            <tr class="apt-row-clickable" (click)="viewAppointmentDetail(apt)">
                              <td>{{ apt.date | date:'dd.MM.yyyy' }}</td>
                              <td>{{ apt.startTime }}-{{ apt.endTime }}</td>
                              <td>{{ apt.therapistName }}</td>
                              <td>
                                <div class="treatment-tags-mini">
                                  @if (apt.isHotair) { <span class="tag-mini hl">HL</span> }
                                  @if (apt.isUltrasonic) { <span class="tag-mini us">US</span> }
                                  @if (apt.isElectric) { <span class="tag-mini et">ET</span> }
                                  @if (!apt.isHotair && !apt.isUltrasonic && !apt.isElectric) { <span class="tag-mini kg">KG</span> }
                                </div>
                              </td>
                              <td><span class="status-mini" [class]="'status-' + apt.status.toLowerCase()">{{ apt.status }}</span></td>
                            </tr>
                          }
                        </tbody>
                      </table>
                      @if (patientAppointments().length > 50) {
                        <p class="more-appointments">+ {{ patientAppointments().length - 50 }} weitere Termine</p>
                      }
                    }
                  </div>
                }

                @if (appointmentViewMode === 'series') {
                  <div class="appointments-scroll">
                    @if (patientSeries().length === 0) {
                      <p class="empty-message">Keine Serientermine</p>
                    } @else {
                      <table class="appointments-mini-table">
                        <thead>
                          <tr>
                            <th>Wochentag</th>
                            <th>Zeit</th>
                            <th>Therapeut</th>
                            <th>Behandlung</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (series of patientSeries(); track series.id) {
                            <tr class="series-row-clickable" (click)="navigateToSeriesCalendar(series)">
                              <td>{{ weekdayName(series.weekday) }}</td>
                              <td>{{ series.startTime }}-{{ series.endTime }}</td>
                              <td>{{ series.therapistName }}</td>
                              <td>
                                <div class="treatment-tags-mini">
                                  @if (series.isHotair ?? false) { <span class="tag-mini hl">HL</span> }
                                  @if (series.isUltrasonic ?? false) { <span class="tag-mini us">US</span> }
                                  @if (series.isElectric ?? false) { <span class="tag-mini et">ET</span> }
                                  @if (!(series.isHotair ?? false) && !(series.isUltrasonic ?? false) && !(series.isElectric ?? false)) { <span class="tag-mini kg">KG</span> }
                                </div>
                              </td>
                              <td><span class="status-mini" [class]="'status-' + series.status.toLowerCase()">{{ series.status }}</span></td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      @if (showDeleteModal) {
        <div class="modal-overlay" (click)="showDeleteModal = false">
          <div class="modal modal-sm" (click)="$event.stopPropagation()">
            <h2>Patient löschen?</h2>
            <p>Möchten Sie "{{ patientToDelete?.fullName || patientToDelete?.firstName + ' ' + patientToDelete?.lastName }}" wirklich löschen?</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showDeleteModal = false">Abbrechen</button>
              <button class="btn-danger" (click)="deletePatient()">Löschen</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { padding: 1.5rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    h1 { margin: 0; color: #1F2937; font-size: 1.5rem; }
    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: column; }
    .search-bar { padding: 1rem; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .search-input { flex: 1; max-width: 300px; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; box-sizing: border-box; }
    .search-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .pagination-controls { display: flex; align-items: center; gap: 0.75rem; }
    .items-per-page-select { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; background: white; cursor: pointer; }
    .items-per-page-select:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .table-wrapper { overflow-y: auto; flex: 1; max-height: calc(100vh - 350px); position: relative; }
    .loading-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.8); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 20; gap: 0.5rem; }
    .loading-spinner { width: 32px; height: 32px; border: 3px solid #E5E7EB; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .table-compact { width: 100%; border-collapse: collapse; }
    .table-compact th { background: #F9FAFB; padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB; font-size: 0.875rem; position: sticky; top: 0; z-index: 10; }
    .table-compact td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #E5E7EB; color: #1F2937; font-size: 0.875rem; height: 28px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sortable { cursor: pointer; user-select: none; }
    .sortable:hover { background: #F3F4F6; }
    .row-compact { height: 28px; }
    .row-clickable { cursor: pointer; transition: background-color 0.15s; }
    .row-clickable:hover { background: #F9FAFB; }
    .name-cell { font-weight: 500; }
    .badge { padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 500; white-space: nowrap; display: inline-block; }
    .badge-info { background: #DBEAFE; color: #1E40AF; }
    .badge-inactive { background: #E5E7EB; color: #6B7280; }
    .col-actions { width: 70px; text-align: right; }
    .btn-edit { background: none; border: none; cursor: pointer; padding: 0.2rem 0.4rem; font-size: 0.875rem; opacity: 0.4; transition: opacity 0.2s; }
    .btn-edit:hover { opacity: 1; }
    .btn-delete { background: none; border: none; cursor: pointer; padding: 0.2rem 0.4rem; font-size: 0.875rem; opacity: 0.4; transition: opacity 0.2s; }
    .btn-delete:hover { opacity: 1; }
    .pagination-footer { padding: 0.75rem 1rem; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center; background: #F9FAFB; font-size: 0.875rem; color: #6B7280; }
    .pagination-info { font-weight: 500; }
    .pagination-buttons { display: flex; align-items: center; gap: 0.75rem; }
    .btn-pagination { background: white; border: 1px solid #D1D5DB; padding: 0.4rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .btn-pagination:disabled { opacity: 0.5; cursor: not-allowed; background: #F3F4F6; }
    .btn-pagination:not(:disabled):hover { background: #F3F4F6; }
    .page-number { font-size: 0.875rem; color: #374151; font-weight: 500; min-width: 100px; text-align: center; }
    .btn-primary { background: #2563EB; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-primary:hover { background: #1D4ED8; }
    .btn-secondary { background: #E5E7EB; color: #374151; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-secondary:hover { background: #D1D5DB; }
    .btn-danger { background: #EF4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-danger:hover { background: #DC2626; }
    .empty { text-align: center; color: #9CA3AF; padding: 2rem; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 500px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .modal-lg { max-width: 700px; }
    .modal-sm { max-width: 400px; }
    .modal h2 { margin: 0 0 1.5rem 0; color: #1F2937; font-size: 1.25rem; }
    .modal p { color: #6B7280; margin-bottom: 1.5rem; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
    .detail-item { display: flex; flex-direction: column; }
    .detail-item label { font-weight: 600; color: #374151; margin-bottom: 0.25rem; font-size: 0.875rem; }
    .detail-item span { color: #6B7280; word-break: break-word; }
    .form-group { margin-bottom: 1rem; }
    .form-row { display: flex; gap: 1rem; }
    .form-row .form-group { flex: 1; }
    .flex-1 { flex: 1 !important; }
    .flex-3 { flex: 3 !important; }
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; color: #374151; font-size: 0.875rem; }
    .form-group input[type="text"], .form-group input[type="email"], .form-group input[type="tel"] { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; box-sizing: border-box; }
    .form-group input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .checkbox-group label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .checkbox-group input[type="checkbox"] { width: 1rem; height: 1rem; }
    .divider { border: none; border-top: 1px solid #E5E7EB; margin: 1rem 0; }
    .section-label { font-size: 0.875rem; color: #6B7280; margin-bottom: 0.75rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
    .modal-detail { max-width: 90vw; max-height: 90vh; width: 100%; height: 100%; display: flex; flex-direction: column; padding: 0; }
    .detail-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid #E5E7EB; }
    .detail-header h2 { margin: 0; font-size: 1.25rem; color: #1F2937; }
    .btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6B7280; padding: 0; width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center; }
    .btn-close:hover { color: #111827; }
    .detail-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; flex: 1; overflow: hidden; padding: 1.5rem; }
    .detail-left { display: flex; flex-direction: column; overflow-y: auto; padding-right: 1rem; }
    .detail-left h3 { margin: 0 0 1rem 0; color: #111827; font-size: 0.95rem; font-weight: 600; }
    .detail-form { display: flex; flex-direction: column; gap: 0.75rem; }
    .detail-form .form-group label { display: block; font-weight: 500; color: #374151; font-size: 0.8rem; margin-bottom: 0.25rem; }
    .detail-form .form-group input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; }
    .detail-form .form-group input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .divider-detail { border: none; border-top: 1px solid #E5E7EB; margin-top: 1rem; }
    .section-label-detail { font-size: 0.8rem; color: #6B7280; margin-top: 1rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .form-actions-detail { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
    .detail-right { display: flex; flex-direction: column; border-left: 1px solid #E5E7EB; padding-left: 1.5rem; overflow: hidden; }
    .appointments-tabs { display: flex; gap: 0; margin-bottom: 1rem; }
    .tab { padding: 0.5rem 1rem; border: none; background: #F3F4F6; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 500; font-size: 0.85rem; color: #6B7280; transition: all 0.2s; }
    .tab:hover { background: #E5E7EB; }
    .tab.active { background: white; border-bottom-color: #2563EB; color: #2563EB; }
    .appointments-scroll { flex: 1; overflow-y: auto; }
    .appointments-mini-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
    .appointments-mini-table th { background: #F9FAFB; padding: 0.4rem; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB; white-space: nowrap; }
    .appointments-mini-table td { padding: 0.3rem 0.4rem; border-bottom: 1px solid #E5E7EB; color: #374151; }
    .apt-row-clickable { cursor: pointer; transition: background-color 0.1s; }
    .apt-row-clickable:hover { background: #F3F4F6; }
    .series-row-clickable { cursor: pointer; transition: background-color 0.1s; }
    .series-row-clickable:hover { background: #F3F4F6; }
    .treatment-tags-mini { display: flex; gap: 4px; }
    .tag-mini { display: inline-block; padding: 0.1rem 0.3rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; white-space: nowrap; }
    .tag-mini.hl { background: #FEE2E2; color: #991B1B; }
    .tag-mini.us { background: #EDE9FE; color: #5B21B6; }
    .tag-mini.et { background: #D1FAE5; color: #065F46; }
    .tag-mini.kg { background: #E5E7EB; color: #6B7280; }
    .status-mini { display: inline-block; padding: 0.15rem 0.4rem; border-radius: 3px; font-weight: 500; font-size: 0.65rem; white-space: nowrap; }
    .status-scheduled { background: #DBEAFE; color: #1E40AF; }
    .status-confirmed { background: #D1FAE5; color: #065F46; }
    .status-cancelled { background: #FEE2E2; color: #991B1B; }
    .status-completed { background: #E5E7EB; color: #374151; }
    .status-no_show { background: #FEF3C7; color: #92400E; }
    .status-active { background: #D1FAE5; color: #065F46; }
    .status-paused { background: #FEF3C7; color: #92400E; }
    .empty-message { text-align: center; color: #9CA3AF; padding: 1rem; }
    .more-appointments { text-align: center; color: #3B82F6; font-size: 0.8rem; cursor: pointer; padding: 0.5rem; font-weight: 500; }
  `]
})
export class PatientListComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private patientService = inject(PatientService);
  private appointmentService = inject(AppointmentService);
  private appointmentSeriesService = inject(AppointmentSeriesService);
  private toastService = inject(ToastService);

  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();

  // Server-side pagination state
  private serverPage = signal<PageResponse<Patient> | null>(null);
  loading = signal(false);
  searchTerm = signal('');
  sortField = signal<SortField>('fullName');
  sortDirection = signal<SortDirection>('asc');
  itemsPerPage = signal(25);
  itemsPerPageValue: number = 25;
  currentPage = signal(0);  // 0-indexed for server

  // Search debounce
  private searchSubject = new Subject<string>();

  // Computed from server response
  serverPatients = computed(() => this.serverPage()?.content || []);
  totalElements = computed(() => this.serverPage()?.totalElements || 0);
  totalPages = computed(() => this.serverPage()?.totalPages || 0);
  paginationStart = computed(() => {
    const page = this.serverPage();
    if (!page || page.empty) return 0;
    return page.number * page.size + 1;
  });
  paginationEnd = computed(() => {
    const page = this.serverPage();
    if (!page || page.empty) return 0;
    return page.number * page.size + page.numberOfElements;
  });

  selectedPatient = signal<Patient | null>(null);
  showPatientDetailModal = false;
  showModal = false;
  showDeleteModal = false;
  editingId: number | null = null;
  patientToDelete: Patient | null = null;
  formData = { firstName: '', lastName: '', email: '', telefon: '', isBWO: false, street: '', houseNumber: '', postalCode: '', city: '' };

  // Detail modal properties
  appointmentViewMode: 'single' | 'series' = 'single';
  detailFormData = { firstName: '', lastName: '', email: '', telefon: '', street: '', houseNumber: '', postalCode: '', city: '', isBWO: false };
  allAppointments = signal<Appointment[]>([]);
  allSeries = signal<AppointmentSeries[]>([]);

  patientAppointments = computed(() => {
    const id = this.selectedPatient()?.id;
    return id ? this.allAppointments().filter(a => a.patientId === id && !(a.createdBySeriesAppointment || a.appointmentSeriesId)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
  });

  patientSeries = computed(() => {
    const id = this.selectedPatient()?.id;
    if (!id) return [];
    return this.allSeries()
      .filter(s => s.patientId === id)
      .sort((a, b) => {
        const aDay = this.weekdayToNumber(a.weekday);
        const bDay = this.weekdayToNumber(b.weekday);
        return aDay - bDay;
      });
  });

  constructor() {
    // Setup debounced search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.currentPage.set(0);
      this.fetchPatients();
    });
  }

  ngOnInit() {
    this.fetchPatients();
    this.loadAppointments();
    this.loadAppointmentSeries();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Fetch patients from server with current filters
   */
  fetchPatients() {
    this.loading.set(true);

    const params: PatientPageParams = {
      page: this.currentPage(),
      size: this.itemsPerPage(),
      sortBy: this.sortField(),
      sortDir: this.sortDirection(),
      search: this.searchTerm() || undefined
    };

    this.patientService.getPaginated(params).pipe(
      finalize(() => this.loading.set(false)),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => this.serverPage.set(response),
      error: () => this.toastService.error('Fehler beim Laden')
    });
  }

  /**
   * Handle search input with debounce
   */
  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  loadAppointments() {
    this.appointmentService.getAll().subscribe({
      next: (data) => {
        this.allAppointments.set(data);
      },
      error: () => this.toastService.error('Fehler beim Laden von Terminen')
    });
  }

  loadAppointmentSeries() {
    this.appointmentSeriesService.getAll().subscribe({
      next: (data) => {
        this.allSeries.set(data);
      },
      error: () => this.toastService.error('Fehler beim Laden von Serientermine')
    });
  }

  onItemsPerPageChange() {
    this.itemsPerPage.set(this.itemsPerPageValue);
    this.currentPage.set(0);
    this.fetchPatients();
  }

  previousPage() {
    if (this.currentPage() > 0) {
      this.currentPage.set(this.currentPage() - 1);
      this.fetchPatients();
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.set(this.currentPage() + 1);
      this.fetchPatients();
    }
  }

  sort(field: SortField) {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.currentPage.set(0);
    this.fetchPatients();
  }

  getSortIcon(field: SortField): string {
    return this.sortField() !== field ? '' : this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  showPatientDetail(patient: Patient) {
    this.router.navigate(['/dashboard/patients', patient.id]);
  }

  closePatientDetailModal() {
    this.showPatientDetailModal = false;
    this.selectedPatient.set(null);
    this.appointmentViewMode = 'single';
  }

  savePatientFromDetail() {
    const patient = this.selectedPatient();
    if (!patient) return;

    const data: any = {
      firstName: this.detailFormData.firstName,
      lastName: this.detailFormData.lastName,
      email: this.detailFormData.email || null,
      telefon: this.detailFormData.telefon || null,
      isBWO: this.detailFormData.isBWO,
      street: this.detailFormData.street || null,
      houseNumber: this.detailFormData.houseNumber || null,
      postalCode: this.detailFormData.postalCode || null,
      city: this.detailFormData.city || null
    };

    this.patientService.update(patient.id, data).subscribe({
      next: () => {
        this.toastService.success('Patient aktualisiert');
        this.fetchPatients();
      },
      error: () => this.toastService.error('Fehler beim Speichern')
    });
  }

  deletePatientFromDetail() {
    const patient = this.selectedPatient();
    if (!patient) return;

    if (confirm(`Wirklich ${patient.firstName} ${patient.lastName} löschen?`)) {
      this.patientService.delete(patient.id).subscribe({
        next: () => {
          this.toastService.success('Patient gelöscht');
          this.closePatientDetailModal();
          this.fetchPatients();
        },
        error: () => this.toastService.error('Fehler beim Löschen')
      });
    }
  }

  viewAppointmentDetail(apt: Appointment) {
    this.router.navigate(['/dashboard/appointments', apt.id]);
  }

  navigateToSeriesCalendar(series: AppointmentSeries) {
    this.router.navigate(['/dashboard/calendar'], {
      queryParams: { seriesId: series.id, weekday: series.weekday }
    });
  }

  weekdayName(weekday: string | number): string {
    // Handle numeric weekdays (1-7)
    if (typeof weekday === 'number') {
      const weekdays = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      return weekdays[weekday] || '';
    }
    // Handle string weekday names (MONDAY, TUESDAY, etc.)
    const dayMap: { [key: string]: string } = {
      'MONDAY': 'Montag',
      'TUESDAY': 'Dienstag',
      'WEDNESDAY': 'Mittwoch',
      'THURSDAY': 'Donnerstag',
      'FRIDAY': 'Freitag',
      'SATURDAY': 'Samstag',
      'SUNDAY': 'Sonntag'
    };
    return dayMap[weekday?.toUpperCase()] || '';
  }

  weekdayToNumber(weekday: string | number): number {
    if (typeof weekday === 'number') return weekday;
    const dayMap: { [key: string]: number } = {
      'MONDAY': 1,
      'TUESDAY': 2,
      'WEDNESDAY': 3,
      'THURSDAY': 4,
      'FRIDAY': 5,
      'SATURDAY': 6,
      'SUNDAY': 7
    };
    return dayMap[weekday?.toUpperCase()] || 0;
  }

  openCreateModal() {
    this.editingId = null;
    this.formData = { firstName: '', lastName: '', email: '', telefon: '', isBWO: false, street: '', houseNumber: '', postalCode: '', city: '' };
    this.showModal = true;
  }

  editPatient(p: Patient) {
    this.editingId = p.id;
    this.formData = {
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      email: p.email || '',
      telefon: p.telefon || '',
      isBWO: p.isBWO ?? false,
      street: p.street || '',
      houseNumber: p.houseNumber || '',
      postalCode: p.postalCode || '',
      city: p.city || ''
    };
    this.showModal = true;
  }

  confirmDelete(p: Patient) {
    this.patientToDelete = p;
    this.showDeleteModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingId = null;
  }

  savePatient() {
    const data: any = {
      firstName: this.formData.firstName,
      lastName: this.formData.lastName,
      email: this.formData.email || null,
      telefon: this.formData.telefon || null,
      isBWO: this.formData.isBWO,
      street: this.formData.street || null,
      houseNumber: this.formData.houseNumber || null,
      postalCode: this.formData.postalCode || null,
      city: this.formData.city || null
    };
    const obs = this.editingId ? this.patientService.update(this.editingId, data) : this.patientService.create(data);
    obs.subscribe({
      next: () => {
        this.toastService.success(this.editingId ? 'Aktualisiert' : 'Erstellt');
        this.fetchPatients();
        this.closeModal();
      },
      error: () => this.toastService.error('Fehler')
    });
  }

  deletePatient() {
    if (this.patientToDelete) {
      this.patientService.delete(this.patientToDelete.id).subscribe({
        next: () => {
          this.toastService.success('Gelöscht');
          this.fetchPatients();
          this.showDeleteModal = false;
          this.patientToDelete = null;
        },
        error: () => this.toastService.error('Fehler')
      });
    }
  }
}
