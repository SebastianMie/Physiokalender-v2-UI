import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AppointmentService, Appointment } from '../../data-access/api/appointment.service';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { ToastService } from '../../core/services/toast.service';

interface ConflictRow {
  therapistId: number;
  therapistName: string;
  date: string;
  appointments: Appointment[]; // conflicting appointments (2+)
}

@Component({
  standalone: true,
  selector: 'app-admin-statistics',
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="stats-container">
      <div class="header-row">
        <h1>📊 Statistik · Terminprüfung</h1>
        <div class="controls">
          <label>Von <input type="date" [(ngModel)]="from" [disabled]="scanAll" /></label>
          <label>Bis <input type="date" [(ngModel)]="to" [disabled]="scanAll" /></label>
          <label class="scan-all"><input type="checkbox" [(ngModel)]="scanAll" /> Gesamten Bestand scannen</label>
          <button class="btn-check" (click)="runCheck()" [disabled]="loading()">Prüfen</button>
        </div>
      </div>

      <div *ngIf="loading()" class="loading">Prüfung läuft...</div>

      <div *ngIf="!loading()">
        <div class="overview-layout">
          <!-- Filter Sidebar (facetted search style) -->
          <aside class="filter-sidebar">
            <div class="filter-header">
              <h3>Filter</h3>
              <button class="btn-reset" *ngIf="hasActiveFilters()" (click)="resetFilters()">Zurücksetzen</button>
            </div>

            <div class="filter-group">
              <h4>Suche</h4>
              <input type="text" placeholder="Suche nach Patient, Therapeut, Kommentar..." [(ngModel)]="searchTerm" (input)="applyFilters()" />
            </div>

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

            <div class="filter-group">
              <h4>Behandlung</h4>
              <label class="filter-option"><input type="checkbox" [checked]="filterTreatments.has('hotair')" (change)="toggleTreatment('hotair')" /> <span class="tag hotair">HL</span> Heißluft</label>
              <label class="filter-option"><input type="checkbox" [checked]="filterTreatments.has('ultra')" (change)="toggleTreatment('ultra')" /> <span class="tag ultra">US</span> Ultraschall</label>
              <label class="filter-option"><input type="checkbox" [checked]="filterTreatments.has('electro')" (change)="toggleTreatment('electro')" /> <span class="tag electro">ET</span> Elektro</label>
              <label class="filter-option"><input type="checkbox" [checked]="filterTreatments.has('bwo')" (change)="toggleTreatment('bwo')" /> BWO</label>
            </div>

            <div class="filter-group">
              <h4>Status</h4>
              <label class="filter-option"><input type="checkbox" [checked]="filterStatuses.has('SCHEDULED')" (change)="toggleStatus('SCHEDULED')" /> Geplant</label>
              <label class="filter-option"><input type="checkbox" [checked]="filterStatuses.has('CONFIRMED')" (change)="toggleStatus('CONFIRMED')" /> Bestätigt</label>
              <label class="filter-option"><input type="checkbox" [checked]="filterStatuses.has('COMPLETED')" (change)="toggleStatus('COMPLETED')" /> Abgeschlossen</label>
              <label class="filter-option"><input type="checkbox" [checked]="filterStatuses.has('NO_SHOW')" (change)="toggleStatus('NO_SHOW')" /> Nichterscheinen</label>
            </div>

          </aside>

          <!-- Main content -->
          <div class="main-content">
            <div class="summary">
              Geprüfte Termine: <strong>{{ scannedCount() }}</strong>
              · Gefundene Konfliktgruppen: <strong>{{ visibleConflicts().length }}</strong>
            </div>

            <div *ngIf="visibleConflicts().length === 0" class="empty-state">Keine Termin‑Konflikte mit den aktuellen Filtern gefunden.</div>

            <div *ngIf="visibleConflicts().length > 0" class="conflict-list">
              <table class="conflict-table">
                <thead>
                  <tr>
                    <th>Therapeut</th>
                    <th>Datum</th>
                    <th>Konkurrierende Termine</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of visibleConflicts(); track c.therapistId) {
                    <tr>
                      <td>{{ c.therapistName }}</td>
                      <td>{{ c.date | date:'dd.MM.yyyy' }}</td>
                      <td>
                        @for (a of c.appointments; track a.id) {
                          <div class="conf-apt">
                            <a [routerLink]="['/dashboard/patients', a.patientId]" (click)="$event.stopPropagation()">{{ a.patientName || ('Patient ' + a.patientId) }}</a>
                            — {{ formatTimeDot(a.startTime) }}–{{ formatTimeDot(a.endTime) }}
                            <span class="tag">{{ a.createdBySeriesAppointment || a.appointmentSeriesId ? 'Serie' : 'Einzel' }}</span>
                            <span class="status">{{ a.status }}</span>
                            <button class="btn-link-small" (click)="openInCalendar(a); $event.stopPropagation()">Zum Termin</button>
                          </div>
                        }
                      </td>
                      <td>
                        <button class="btn-link" (click)="gotoCalendar(c.date)">Zum Kalender</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stats-container { padding: 1.25rem; }
    .header-row { display:flex; align-items:center; gap:1rem; justify-content:space-between; }
    .controls { display:flex; gap:0.5rem; align-items:center; }
    .scan-all { font-size:0.85rem; color:#374151; display:flex; align-items:center; gap:0.35rem; }
    .btn-check { padding:0.4rem 0.8rem; background:#2563EB; color:white; border:none; border-radius:6px; cursor:pointer; }

    .overview-layout { display:flex; gap:1rem; margin-top:1rem; }
    .filter-sidebar { width:260px; background:white; border:1px solid #E5E7EB; padding:0.75rem; border-radius:6px; flex-shrink:0; }
    .filter-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem; }
    .filter-header h3 { margin:0; font-size:0.9rem; }
    .btn-reset { background:none; border:none; color:#2563EB; cursor:pointer; font-size:0.85rem; }
    .filter-group { margin-bottom:0.75rem; }
    .filter-group h4 { margin:0 0 0.25rem 0; font-size:0.75rem; color:#6B7280; text-transform:uppercase; letter-spacing:0.04em; font-weight:600; }
    .filter-options { display:flex; flex-direction:column; gap:0.25rem; max-height:200px; overflow:auto; }
    .filter-option { display:flex; align-items:center; gap:0.5rem; font-size:0.875rem; cursor:pointer; }
    .filter-option input { width:14px; height:14px; }

    .main-content { flex:1; }
    .summary { margin:0 0 1rem 0; color:#6B7280; }
    .conflict-table { width:100%; border-collapse:collapse; }
    .conflict-table th, .conflict-table td { padding:0.35rem 0.5rem; border-bottom:1px solid #F3F4F6; text-align:left; vertical-align:top; }
    .conf-apt { display:flex; gap:0.5rem; align-items:center; font-size:0.85rem; margin-bottom:0.125rem; }
    .conf-apt .tag { background:#E5E7EB; padding:0.1rem 0.4rem; border-radius:6px; font-size:0.7rem; color:#374151; margin-left:0.5rem; }
    .conf-apt .status { color:#9CA3AF; margin-left:0.5rem; font-size:0.75rem; }
    .btn-link-small { background:none; border:none; color:#2563EB; cursor:pointer; font-size:0.75rem; margin-left:0.4rem; }
    .btn-link { background:none; border:none; color:#2563EB; cursor:pointer; font-size:0.9rem; }
    .empty-state { padding:1rem; color:#6B7280; }
  `]
})
export class StatisticsComponent implements OnInit {
  private appointmentService = inject(AppointmentService);
  private therapistService = inject(TherapistService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  // date range / scan
  from = this.getDefaultFrom();
  to = this.getDefaultTo();
  scanAll = false;

  // state
  loading = signal(false);
  scannedCount = signal(0);
  conflicts = signal<ConflictRow[]>([]);
  visibleConflicts = signal<ConflictRow[]>([]);

  // filters (facetted)
  therapists = signal<Therapist[]>([]);
  filterTherapistIds = new Set<number>();
  filterTreatments = new Set<string>();
  filterStatuses = new Set<string>();
  searchTerm = '';

  ngOnInit(): void {
    // load therapists for filter list
    this.therapistService.getAll().subscribe({ next: (t) => this.therapists.set((t || []).filter(x => x.isActive)), error: () => this.therapists.set([]) });
  }

  getDefaultFrom(): string { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; }
  getDefaultTo(): string { const d = new Date(); return d.toISOString().split('T')[0]; }

  runCheck(): void {
    this.loading.set(true);
    this.conflicts.set([]);
    this.visibleConflicts.set([]);
    this.scannedCount.set(0);

    const onError = (err: any) => { console.error('Statistics check failed', err); this.toastService.error('Prüfung fehlgeschlagen'); this.loading.set(false); };

    const processAppointments = (apts: Appointment[] | null | undefined) => {
      const filtered = (apts || []).filter(a => a.status !== 'CANCELLED');
      this.scannedCount.set(filtered.length);

      const groups = new Map<string, Appointment[]>();
      filtered.forEach(a => {
        const key = `${a.therapistId}|${a.date}`;
        const arr = groups.get(key) || [];
        arr.push(a);
        groups.set(key, arr);
      });

      const conflictsFound: ConflictRow[] = [];
      groups.forEach((list) => {
        if (list.length < 2) return;
        list.sort((x, y) => x.startTime.localeCompare(y.startTime));

        for (let i = 0; i < list.length; i++) {
          const base = list[i];
          const overlaps = [base];
          for (let j = i + 1; j < list.length; j++) {
            const a = list[j];
            if (a.startTime < base.endTime) overlaps.push(a);
          }
          if (overlaps.length > 1) conflictsFound.push({ therapistId: base.therapistId, therapistName: base.therapistName, date: base.date, appointments: overlaps });
        }
      });

      this.conflicts.set(conflictsFound);
      this.applyFilters(); // populate visibleConflicts according to active filters
      this.loading.set(false);
    };

    if (this.scanAll) {
      this.appointmentService.getAll().subscribe({ next: processAppointments, error: onError });
    } else {
      if (!this.from || !this.to) { this.loading.set(false); return; }
      this.appointmentService.getByDateRange(this.from, this.to).subscribe({ next: processAppointments, error: onError });
    }
  }

  // ========== filtering (client-side facetted) ==========
  hasActiveFilters(): boolean {
    return this.filterTherapistIds.size > 0 || this.filterTreatments.size > 0 || this.filterStatuses.size > 0 || (this.searchTerm.trim().length > 0);
  }

  resetFilters(): void {
    this.filterTherapistIds.clear();
    this.filterTreatments.clear();
    this.filterStatuses.clear();
    this.searchTerm = '';
    this.applyFilters();
  }

  toggleTherapistFilter(id: number): void { if (this.filterTherapistIds.has(id)) this.filterTherapistIds.delete(id); else this.filterTherapistIds.add(id); this.applyFilters(); }
  toggleTreatment(name: string): void { if (this.filterTreatments.has(name)) this.filterTreatments.delete(name); else this.filterTreatments.add(name); this.applyFilters(); }
  toggleStatus(s: string): void { if (this.filterStatuses.has(s)) this.filterStatuses.delete(s); else this.filterStatuses.add(s); this.applyFilters(); }

  applyFilters(): void {
    const term = (this.searchTerm || '').toLowerCase().trim();
    let rows = this.conflicts();

    // filter by therapist groups
    if (this.filterTherapistIds.size > 0) rows = rows.filter(r => this.filterTherapistIds.has(r.therapistId));

    // filter appointments inside each conflict-group by treatments/status
    rows = rows.map(r => ({ ...r, appointments: r.appointments.filter(a => {
      // treatment filter
      if (this.filterTreatments.size > 0) {
        const has = (this.filterTreatments.has('hotair') && a.isHotair) || (this.filterTreatments.has('ultra') && a.isUltrasonic) || (this.filterTreatments.has('electro') && a.isElectric) || (this.filterTreatments.has('bwo') && a.isBWO);
        if (!has) return false;
      }
      // status filter
      if (this.filterStatuses.size > 0 && !this.filterStatuses.has(a.status)) return false;
      // search term
      if (term) {
        const hay = `${a.patientName || ''} ${a.therapistName || ''} ${a.comment || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    }) }));

    // drop groups that have no appointments after inner filtering
    rows = rows.filter(r => r.appointments.length > 0);

    this.visibleConflicts.set(rows);
  }

  // Helper: format time as "HH:mm" (accepts "HH:mm:ss", "HH:mm" or ISO datetime)
  formatTimeDot(time: string): string {
    if (!time) return '';
    let t = time;
    if (t.includes('T')) t = t.split('T')[1];
    const parts = t.split(':');
    const hh = parts[0].padStart(2, '0');
    const mm = (parts[1] || '00').padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // ========== navigation helpers ==========
  gotoCalendar(date: string): void { this.router.navigate(['/dashboard/calendar'], { queryParams: { date } }); }
  openInCalendar(a: Appointment): void { this.router.navigate(['/dashboard/calendar'], { queryParams: { date: a.date, editId: a.id } }); }
}
