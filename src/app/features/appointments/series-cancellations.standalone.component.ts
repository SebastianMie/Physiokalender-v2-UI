import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { AppointmentSeriesService, AppointmentSeries, CancellationDTO } from '../../data-access/api/appointment-series.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-series-cancellations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onClose()" style="position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:10001;">
      <div class="modal modal-cancellations" role="dialog" aria-modal="true" style="max-width:900px; width:min(92%,900px); max-height:80vh; display:flex; flex-direction:column; gap:0.75rem; margin:0 auto;" (click)="$event.stopPropagation()">
        <div class="modal-header-bar">
          <h2>Ausfälle verwalten</h2>
          <button class="btn-close" (click)="onClose()">&times;</button>
        </div>

        <ng-container *ngIf="series">
          <p style="font-weight: bold;" class="modal-sub">Serie: {{ series.patientName }} – {{ weekdayLabel(series.weekday || '') }}</p>

          <div class="bulk-actions" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;">
            <button class="btn btn-secondary" (click)="restoreSelectedCancellations()" [disabled]="!hasAnySelectedCancelled()">Ausgewählte Wiederherstellen</button>
            <div style="margin-left:auto;color:#6B7280;font-size:0.9rem;">Ausgewählt: {{ selectedDates.size }}</div>
          </div>

          <div class="cancellations-table-wrapper table-wrapper" style="max-height:40vh; overflow-y:auto;">
            <table class="appointments-table cancellations-table" style="width:100%;">
              <thead>
                <tr>
                  <th style="width:34px"><input type="checkbox" [checked]="allSelected()" (change)="toggleSelectAll($any($event.target).checked)" /></th>
                  <th>Datum</th>
                  <th>Wochentag</th>
                  <th>Status</th>
                  <th class="col-actions">Aktion</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let occ of cancelledOccurrences">
                  <td><input type="checkbox" [checked]="selectedDates.has(occ.date)" (change)="toggleSelect(occ.date, $any($event.target).checked)" /></td>
                  <td>{{ formatDateDE(occ.date) }}</td>
                  <td>{{ getWeekdayName(occ.date) }}</td>
                  <td>
                    <span class="status-badge status-cancelled">Ausgefallen</span>
                  </td>
                  <td class="col-actions">
                    <button class="btn btn-icon-trash" (click)="restoreCancellationByDate(occ.date)" title="Ausfall entfernen" aria-label="Ausfall entfernen">
                      🗑️
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div *ngIf="cancelledOccurrences.length === 0" class="no-cancellations-message" style="padding:1rem; text-align:center; color:#6B7280;">Keine Ausfälle vorhanden.</div>

          <div style="margin-top:0.75rem;">

            <div class="add-cancellation-row">
             <h4 style="margin:0 0 0.5rem 0;">Ausfall manuell hinzufügen</h4>
              <select [(ngModel)]="newCancellationDate" class="date-select">
                <option value="">Datum wählen...</option>
                <option *ngFor="let d of availableDates" [ngValue]="d">{{ formatDateDE(d) }} ({{ getWeekdayName(d) }})</option>
              </select>
              <button class="btn btn-primary" [disabled]="!newCancellationDate" (click)="saveCancellation()">Hinzufügen</button>
            </div>
            <p *ngIf="availableDates.length === 0" class="no-dates-hint">Keine verfügbaren Termine mehr.</p>
          </div>

          <div class="modal-actions-bar" style="display:flex;justify-content:space-between;align-items:center;">
            <div class="left-actions">
              <button class="btn btn-cancel" (click)="onClose()">Abbrechen</button>
            </div>
            <div class="right-actions">
              <!-- reserved for future right-aligned actions -->
            </div>
          </div>
        </ng-container>
      </div>
    </div>
  `,
})
export class SeriesCancellationsComponent implements OnInit {
  @Input() seriesId: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<AppointmentSeries>();

  series: AppointmentSeries | null = null;
  occurrences: Array<{ date: string; isCancelled: boolean; cancellationId?: number }> = [];
  selectedDates = new Set<string>();
  newCancellationDate = '';
  deleting = signal(false);
  availableDates: string[] = [];

  constructor(private seriesService: AppointmentSeriesService, private toast: ToastService) {}

  ngOnInit(): void {
    if (this.seriesId) this.loadSeries(this.seriesId);
  }

  loadSeries(id: number): void {
    this.seriesService.getById(id).subscribe({
      next: (s) => {
        this.series = s;
        this.buildOccurrences();
        this.refreshAvailableDates();
      },
      error: () => this.toast.show('Fehler beim Laden der Serie', 'error')
    });
  }

  private buildOccurrences(): void {
    this.occurrences = [];
    this.selectedDates.clear();
    if (!this.series) return;

    const weekdayMap: Record<string, number> = { 'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6 };
    let targetDay = weekdayMap[this.series.weekday as string];
    if (typeof targetDay !== 'number' || Number.isNaN(targetDay)) {
      // fallback to start date's weekday if series.weekday is missing/invalid
      targetDay = new Date(this.series.startDate).getDay();
    }
    const today = new Date(); today.setHours(0,0,0,0);

    const start = new Date(this.series.startDate);
    const end = new Date(this.series.endDate);
    const freq = this.series.weeklyFrequency || 1;

    const cancelledMap = new Map<string, number | undefined>();
    (this.series.cancellations || []).forEach(c => cancelledMap.set(c.date.split('T')[0], c.id));

    let current = new Date(start);
    while (current.getDay() !== targetDay) current.setDate(current.getDate() + 1);
    while (current < start) current.setDate(current.getDate() + 7 * freq);

    while (current <= end) {
      const ds = current.toISOString().split('T')[0];
      const isCancelled = cancelledMap.has(ds);
      if (current >= today || isCancelled) {
        this.occurrences.push({ date: ds, isCancelled, cancellationId: cancelledMap.get(ds) });
      }
      current.setDate(current.getDate() + 7 * freq);
    }
  }

  refreshAvailableDates(): void {
    if (!this.series) { this.availableDates = []; return; }
    // availableDates = occurrences that are not cancelled and >= today
    const today = new Date(); today.setHours(0,0,0,0);
    this.availableDates = this.occurrences.filter(o => !o.isCancelled && new Date(o.date) >= today).map(o => o.date);
  }

  // only show cancelled occurrences (chronologically sorted)
  get cancelledOccurrences(): Array<{ date: string; isCancelled: boolean; cancellationId?: number }> {
    return this.occurrences
      .filter(o => o.isCancelled)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  formatDateDE(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('T')[0].split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  getWeekdayName(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const w = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    return w[d.getDay()];
  }

  saveCancellation(): void {
    if (!this.series || !this.newCancellationDate) return;
    const dto: CancellationDTO = { date: this.newCancellationDate };
    this.seriesService.addCancellations(this.series.id, [dto]).subscribe({
      next: (updated) => {
        this.series = updated;
        this.newCancellationDate = '';
        this.buildOccurrences();
        this.refreshAvailableDates();
        this.updated.emit(updated);
        this.toast.show('Ausfall eingetragen', 'success');
      },
      error: () => this.toast.show('Fehler beim Eintragen des Ausfalls', 'error')
    });
  }

  addCancellation(date: string): void {
    if (!this.series) return;
    const dto: CancellationDTO = { date };
    this.seriesService.addCancellations(this.series.id, [dto]).subscribe({
      next: (updated) => {
        this.series = updated;
        this.buildOccurrences();
        this.refreshAvailableDates();
        this.updated.emit(updated);
        this.toast.show('Ausfall eingetragen', 'success');
      },
      error: () => this.toast.show('Fehler beim Eintragen des Ausfalls', 'error')
    });
  }

  removeCancellation(seriesId: number, cancellationId: number): void {
    this.deleting.set(true);
    this.seriesService.deleteCancellation(seriesId, cancellationId).subscribe({
      next: (updated) => {
        this.series = updated;
        this.buildOccurrences();
        this.refreshAvailableDates();
        this.updated.emit(updated);
        this.deleting.set(false);
        this.toast.show('Ausfall entfernt', 'success');
      },
      error: () => { this.deleting.set(false); this.toast.show('Fehler beim Entfernen des Ausfalls', 'error'); }
    });
  }

  // ---- multi-select helpers ----
  toggleSelect(date: string, checked: boolean): void {
    if (checked) this.selectedDates.add(date);
    else this.selectedDates.delete(date);
  }

  toggleSelectAll(checked: boolean): void {
    const list = this.cancelledOccurrences;
    if (checked) list.forEach(o => this.selectedDates.add(o.date));
    else this.selectedDates.clear();
  }

  allSelected(): boolean {
    const list = this.cancelledOccurrences;
    return list.length > 0 && this.selectedDates.size === list.length;
  }

  hasAnySelectableToCancel(): boolean {
    if (!this.series) return false;
    for (const d of this.selectedDates) {
      const occ = this.occurrences.find(o => o.date === d);
      if (occ && !occ.isCancelled) return true;
    }
    return false;
  }

  hasAnySelectedCancelled(): boolean {
    if (!this.series) return false;
    for (const d of this.selectedDates) {
      const occ = this.occurrences.find(o => o.date === d);
      if (occ && occ.isCancelled) return true;
    }
    return false;
  }

  markSelectedCancelled(): void {
    if (!this.series) return;
    const toAdd = Array.from(this.selectedDates).filter(d => {
      const occ = this.occurrences.find(o => o.date === d);
      return occ && !occ.isCancelled;
    }).map(d => ({ date: d } as CancellationDTO));

    if (toAdd.length === 0) return;
    this.seriesService.addCancellations(this.series.id, toAdd).subscribe({
      next: (updated) => {
        this.series = updated;
        this.buildOccurrences();
        this.refreshAvailableDates();
        this.selectedDates.clear();
        this.updated.emit(updated);
        this.toast.show('Ausfälle eingetragen', 'success');
      },
      error: () => this.toast.show('Fehler beim Eintragen der Ausfälle', 'error')
    });
  }

  restoreSelectedCancellations(): void {
    if (!this.series) return;
    const toRestoreIds: number[] = [];
    for (const d of this.selectedDates) {
      const occ = this.occurrences.find(o => o.date === d);
      if (occ && occ.isCancelled && occ.cancellationId) toRestoreIds.push(occ.cancellationId);
    }
    if (toRestoreIds.length === 0) return;

    const calls = toRestoreIds.map(id => this.seriesService.deleteCancellation(this.series!.id, id));
    forkJoin(calls).subscribe({
      next: (results) => {
        // reload series
        this.loadSeries(this.series!.id);
        this.selectedDates.clear();
        this.toast.show('Ausfälle wiederhergestellt', 'success');
      },
      error: () => this.toast.show('Fehler beim Wiederherstellen der Ausfälle', 'error')
    });
  }

  restoreCancellationByDate(date: string): void {
    if (!this.series) return;
    const occ = this.occurrences.find(o => o.date === date && o.cancellationId);
    if (!occ || !occ.cancellationId) return;
    this.seriesService.deleteCancellation(this.series.id, occ.cancellationId).subscribe({
      next: (updated) => {
        this.series = updated;
        this.buildOccurrences();
        this.refreshAvailableDates();
        this.updated.emit(updated);
        this.toast.show('Ausfall wiederhergestellt', 'success');
      },
      error: () => this.toast.show('Fehler beim Wiederherstellen des Ausfalls', 'error')
    });
  }

  onClose(): void {
    try { document.body.classList.remove('modal-open'); } catch (e) { /* noop in SSR */ }
    this.close.emit();
  }

  weekdayLabel(weekday: string): string {
    const map: Record<string,string> = { 'MONDAY':'Montag','TUESDAY':'Dienstag','WEDNESDAY':'Mittwoch','THURSDAY':'Donnerstag','FRIDAY':'Freitag','SATURDAY':'Samstag','SUNDAY':'Sonntag' };
    return map[weekday] || weekday;
  }
}
