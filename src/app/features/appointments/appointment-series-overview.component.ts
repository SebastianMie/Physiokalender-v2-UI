import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AppointmentSeriesService, AppointmentSeries } from '../../data-access/api/appointment-series.service';
import { TherapistService, Therapist } from '../../data-access/api/therapist.service';
import { ToastService } from '../../core/services/toast.service';
import { AppointmentModalComponent } from './appointment-modal.standalone.component';

// Header für die Spalten (Zeit + Therapeuten)
interface TableHeader {
  text: string;
  value: string;
  id: number | null;
}

// Eine Zeile in der Matrix
interface TableRow {
  startTime: string;
  [therapistName: string]: string | AppointmentSeries | undefined;
}

@Component({
  selector: 'app-appointment-series-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, AppointmentModalComponent],
  template: `
    <div class="series-overview-container">
      <!-- Page Header -->
      <div class="page-header">
        <h1>Serien-Terminübersicht</h1>
        <p class="subtitle">Nach Therapeut und Uhrzeit</p>
      </div>

      <!-- Controls -->
      <div class="controls-bar">
        <!-- Weekday Navigation - Centered -->
        <div class="weekday-nav-centered">
          <button class="nav-btn" (click)="previousDay()">← Vorheriger Tag</button>
          <div class="day-display">
            <span class="day-name">{{ currentDayName() }}</span>
          </div>
          <button class="nav-btn" (click)="nextDay()">Nächster Tag →</button>
        </div>
      </div>

      <!-- Table Grid wie im alten Vue-Projekt -->
      <div class="table-wrapper">
        <table class="masterlist-table">
          <thead>
            <tr>
              @for (header of headers(); track header.value) {
                <th class="text-center">
                  @if (header.text === '') {
                    <span></span>
                  } @else {
                    <span class="therapist-header-text">{{ header.text }}</span>
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.startTime; let rowIndex = $index) {
              <tr>
                @for (header of getVisibleHeadersForRow(row); track header.value) {
                  @if (header.text === '') {
                    <!-- Zeit-Spalte -->
                    <td class="time-cell" [class.hour-begin]="rowIndex % 6 === 0">
                      {{ row.startTime }}
                    </td>
                  } @else if (row[header.value] === '') {
                    <!-- Leere Zelle -->
                    <td
                      class="empty-cell"
                      [class.hour-begin]="rowIndex % 6 === 0"
                      (click)="openCreateDialog(header, row.startTime)">
                    </td>
                  } @else if (isAppointment(row[header.value])) {
                    <!-- Termin-Zelle mit rowspan -->
                    @let appointment = getAppointment(row[header.value]);
                    <td
                      class="appointment-cell"
                      [class.hour-begin]="rowIndex % 6 === 0"
                      [attr.rowspan]="calculateRowspan(appointment)"
                      (click)="appointment && editSeries(appointment)">
                      <div class="appointment-content">
                        <div class="patient-name">{{ appointment?.patientName }}</div>
                        <div class="appointment-time">
                          {{ formatTime(appointment?.startTime) }} -
                          {{ formatTime(appointment?.endTime) }}
                        </div>
                        <div class="appointment-tags">
                          @if (appointment?.isHotair) {
                            <span class="tag hotair">HL</span>
                          }
                          @if (appointment?.isUltrasonic) {
                            <span class="tag ultra">US</span>
                          }
                          @if (appointment?.isElectric) {
                            <span class="tag electro">ET</span>
                          }
                        </div>
                      </div>
                    </td>
                  }
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Legend -->
      <div class="legend">
        <div class="legend-item">
          <span class="tag hotair">HL</span> Heißluft
        </div>
        <div class="legend-item">
          <span class="tag ultra">US</span> Ultraschall
        </div>
        <div class="legend-item">
          <span class="tag electro">ET</span> Elektrotherapie
        </div>
      </div>

      <!-- Series Edit Modal -->
      @if (editingSeriesId()) {
        <app-appointment-modal
          [seriesId]="editingSeriesId()"
          (close)="closeEditModal()">
        </app-appointment-modal>
      }
    </div>
  `,
  styles: [`
    .series-overview-container {
      padding: 1.5rem;
      background: #f9fafb;
      min-height: 100vh;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-header h1 {
      font-size: 1.875rem;
      font-weight: 700;
      color: #111827;
      margin: 0;
    }

    .subtitle {
      color: #6b7280;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .controls-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 1.5rem;
      background: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .weekday-nav-centered {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2rem;
    }

    .nav-btn {
      padding: 0.5rem 1rem;
      background: #dbeafe;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .nav-btn:hover:not(:disabled) {
      background: #bfdbfe;
    }

    .day-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      min-width: 150px;
    }

    .day-name {
      font-weight: 700;
      font-size: 1.125rem;
      color: #111827;
    }

    /* Table Styles - wie im alten Vue-Projekt */
    .table-wrapper {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      overflow-x: auto;
      margin-bottom: 1.5rem;
    }

    .masterlist-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .masterlist-table th {
      border-top: 1px solid #2a2f79;
      border-right: 1px solid #2a2f79;
      padding: 0.75rem 0.5rem;
      color: #1d4ed8;
      font-weight: 600;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      text-align: center;
      min-width: 100px;
    }

    .masterlist-table th:first-child {
      border-left: 1px solid #2a2f79;
      border-right: 2px solid #2a2f79;
      border-top-left-radius: 8px;
      width: 70px;
      min-width: 70px;
    }

    .masterlist-table th:last-child {
      border-top-right-radius: 8px;
    }

    .therapist-header-text {
      font-size: 0.875rem;
    }

    .masterlist-table td {
      border-right: 1px solid #2a2f79;
      padding: 0;
      height: 24px;
      vertical-align: top;
    }

    .masterlist-table tr:last-child td {
      border-bottom: 1px solid #2a2f79;
    }

    .masterlist-table tr:last-child td:first-child {
      border-bottom-left-radius: 8px;
    }

    .masterlist-table tr:last-child td:last-child {
      border-bottom-right-radius: 8px;
    }

    .masterlist-table tr td:first-child {
      border-left: 1px solid #2a2f79;
      border-right: 2px solid #2a2f79;
      font-weight: bold;
      text-align: center;
      font-size: 0.75rem;
      color: #374151;
      background: #f9fafb;
    }

    .time-cell {
      padding: 0.25rem !important;
    }

    .hour-begin {
      border-top: 2px ridge #2a2f79 !important;
    }

    .empty-cell {
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .empty-cell:hover {
      background-color: #b4b6d196 !important;
    }

    /* Termin-Zellen */
    .appointment-cell {
      background-color: #b6a0fb;
      cursor: pointer;
      padding: 0.25rem !important;
      vertical-align: top;
    }

    .appointment-cell:hover {
      background-color: #A78BFA;
    }

    .cell-bwo {
      background-color: yellow !important;
    }

    .cell-bwo:hover {
      background-color: #fef08a !important;
    }

    .appointment-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 0.2rem;
    }

    .patient-name {
      font-size: 0.75rem;
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .appointment-time {
      font-size: 0.65rem;
      color: #4b5563;
    }

    .appointment-tags {
      display: flex;
      gap: 0.15rem;
      margin-top: 0.2rem;
      flex-wrap: wrap;
    }

    .tag {
      display: inline-block;
      font-size: 0.55rem;
      padding: 0.1rem 0.25rem;
      border-radius: 3px;
      font-weight: 600;
    }

    .tag.hotair {
      background: #fed7aa;
      color: #92400e;
    }

    .tag.ultra {
      background: #c7d2fe;
      color: #3730a3;
    }

    .tag.electro {
      background: #ddd6fe;
      color: #5b21b6;
    }

    /* Legend */
    .legend {
      display: flex;
      gap: 2rem;
      padding: 1rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #4b5563;
    }
  `]
})
export class AppointmentSeriesOverviewComponent implements OnInit, OnDestroy {
  private appointmentSeriesService = inject(AppointmentSeriesService);
  private therapistService = inject(TherapistService);
  private toastService = inject(ToastService);
  private destroy$ = new Subject<void>();

  // State Signals
  series = signal<AppointmentSeries[]>([]);
  therapists = signal<Therapist[]>([]);
  editingSeriesId = signal<number | null>(null);

  // Day Navigation
  dayOffset = signal(0);

  // Time Slots (alle 10 Minuten wie im alten Projekt)
  private readonly allTimes: string[] = this.generateAllTimes();

  // Computed: Headers (Zeit-Spalte + Therapeuten)
  headers = computed<TableHeader[]>(() => {
    const therapistHeaders = this.visibleTherapists().map(t => ({
      text: t.fullName,
      value: t.fullName,
      id: t.id
    }));

    return [
      { text: '', value: 'startTime', id: null },
      ...therapistHeaders
    ];
  });

  // Computed: Rows (Matrix mit Zeiten und Terminen)
  rows = computed<TableRow[]>(() => {
    return this.createRows();
  });

  // Computed values
  currentDate = computed(() => this.getCurrentDate());
  currentDayName = computed(() => this.getDayNameFromDate(this.currentDate()));

  allActiveSeries = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.series().filter(s => {
      const endDate = new Date(s.endDate);
      endDate.setHours(0, 0, 0, 0);
      return endDate >= today;
    });
  });

  filteredSeriesForDay = computed(() => {
    const date = this.currentDate();
    const dayOfWeek = date.getDay();
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0

    const weekdayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const targetWeekday = weekdayNames[dayIndex];

    const allActive = this.allActiveSeries();

    return allActive.filter(s => {
      const startDate = new Date(s.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(s.endDate);
      endDate.setHours(0, 0, 0, 0);

      const weekdayUpper = this.normalizeWeekday(s.weekday);

      // Must match the weekday
      if (weekdayUpper !== targetWeekday) {
        return false;
      }

      // Navigated date must be >= startDate
      if (date < startDate) {
        return false;
      }

      // Navigated date must be <= endDate
      if (date > endDate) {
        return false;
      }

      // Check interval if weekly frequency > 1
      const frequency = s.weeklyFrequency || 1;
      if (frequency > 1) {
        const diffTime = date.getTime() - startDate.getTime();
        const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        if (diffWeeks % frequency !== 0) {
          return false;
        }
      }

      return true;
    });
  });

  visibleTherapists = computed(() => {
    return this.therapists().sort((a, b) => a.fullName.localeCompare(b.fullName));
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    this.therapistService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (therapists) => {
          const active = (therapists || []).filter(t => t.isActive);
          this.therapists.set(active);
        },
        error: () => this.toastService.error('Fehler beim Laden der Therapeuten')
      });

    this.appointmentSeriesService.getActiveSeries()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (series) => this.series.set(series || []),
        error: () => this.toastService.error('Fehler beim Laden der Serien')
      });
  }

  // Generiere alle Zeiten von 7:00 bis 20:50 in 10-Minuten-Schritten
  private generateAllTimes(): string[] {
    const times: string[] = [];
    for (let hour = 7; hour <= 20; hour++) {
      for (let min = 0; min < 60; min += 10) {
        if (hour === 20 && min > 50) break;
        times.push(`${hour}:${min.toString().padStart(2, '0')}`);
      }
    }
    return times;
  }

  // Erstelle die Zeilen-Matrix wie im alten Vue-Projekt
  private createRows(): TableRow[] {
    const rows: TableRow[] = [];
    const headers = this.headers();
    const seriesForDay = this.filteredSeriesForDay();

    // Für jeden Zeitslot eine Zeile erstellen
    for (const time of this.allTimes) {
      const row: TableRow = { startTime: time };

      // Für jeden Therapeuten prüfen
      for (const header of headers) {
        if (header.text === '') continue; // Zeit-Spalte überspringen

        // Prüfen ob bereits ein laufender Termin existiert
        if (this.hasOngoingAppointment(rows, header.value, time)) {
          // Diese Zelle wird durch rowspan überdeckt - nicht in row eintragen
          continue;
        }

        // Termin suchen der genau zu dieser Zeit startet
        const appointment = seriesForDay.find(s => {
          if (s.therapistId !== header.id) return false;
          const startTimeNorm = this.normalizeTime(s.startTime);
          return startTimeNorm === time;
        });

        if (appointment && appointment.patientName?.trim()) {
          row[header.value] = appointment;
        } else {
          row[header.value] = '';
        }
      }

      rows.push(row);
    }

    return rows;
  }

  // Prüft ob ein Termin aus einer vorherigen Zeile noch läuft
  private hasOngoingAppointment(existingRows: TableRow[], therapistName: string, currentTime: string): boolean {
    const currentTimeIndex = this.timeToIndex(currentTime);

    for (const row of existingRows) {
      const cell = row[therapistName];
      if (this.isAppointment(cell)) {
        const appointment = cell as AppointmentSeries;
        const startIndex = this.timeToIndex(this.normalizeTime(appointment.startTime));
        const endIndex = this.timeToIndex(this.normalizeTime(appointment.endTime));

        if (startIndex < currentTimeIndex && endIndex > currentTimeIndex) {
          return true;
        }
      }
    }
    return false;
  }

  // Berechnet die Anzahl der Zeilen die ein Termin überspannt
  calculateRowspan(appointment: AppointmentSeries | undefined): number {
    if (!appointment) return 1;

    const startIndex = this.timeToIndex(this.normalizeTime(appointment.startTime));
    const endIndex = this.timeToIndex(this.normalizeTime(appointment.endTime));

    // Jede Zeile = 10 Minuten
    return Math.max(1, endIndex - startIndex);
  }

  // Konvertiert Zeit in Index (10-Minuten-Schritte, Start bei 7:00)
  private timeToIndex(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours - 7) * 6 + Math.floor(minutes / 10);
  }

  // Normalisiert Zeit von "HH:mm:ss" zu "H:mm"
  private normalizeTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  // Gibt nur die sichtbaren Header für eine Zeile zurück (ohne laufende Termine)
  getVisibleHeadersForRow(row: TableRow): TableHeader[] {
    return this.headers().filter(header => {
      if (header.text === '') return true; // Zeit-Spalte immer anzeigen
      return row[header.value] !== undefined;
    });
  }

  // Type Guard für Appointments
  isAppointment(value: unknown): value is AppointmentSeries {
    return value !== null &&
           value !== undefined &&
           typeof value === 'object' &&
           'patientName' in (value as object);
  }

  // Cast-Helper für das Template
  getAppointment(value: unknown): AppointmentSeries | undefined {
    if (this.isAppointment(value)) {
      return value;
    }
    return undefined;
  }

  formatTime(timeStr: string | undefined): string {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  }

  private getCurrentDate(): Date {
    const today = new Date();
    const date = new Date(today);
    date.setDate(date.getDate() + this.dayOffset());
    return date;
  }

  private getDayNameFromDate(date: Date): string {
    const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const names = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    return names[dayIndex];
  }

  previousDay(): void {
    this.dayOffset.update(v => v - 1);
  }

  nextDay(): void {
    this.dayOffset.update(v => v + 1);
  }

  openCreateDialog(header: TableHeader, startTime: string): void {
    // TODO: Implement create dialog with pre-filled therapist and time
    console.log('Create appointment for', header.text, 'at', startTime);
  }

  private normalizeWeekday(weekday: string | undefined): string {
    if (!weekday) return 'UNKNOWN';

    const normalized = weekday.toLowerCase().trim();
    const weekdayMap: Record<string, string> = {
      // German
      'montag': 'MONDAY',
      'dienstag': 'TUESDAY',
      'mittwoch': 'WEDNESDAY',
      'donnerstag': 'THURSDAY',
      'freitag': 'FRIDAY',
      'samstag': 'SATURDAY',
      'sonntag': 'SUNDAY',
      // English
      'monday': 'MONDAY',
      'tuesday': 'TUESDAY',
      'wednesday': 'WEDNESDAY',
      'thursday': 'THURSDAY',
      'friday': 'FRIDAY',
      'saturday': 'SATURDAY',
      'sunday': 'SUNDAY'
    };

    return weekdayMap[normalized] || weekday.toUpperCase();
  }

  editSeries(series: AppointmentSeries): void {
    this.editingSeriesId.set(series.id);
  }

  closeEditModal(): void {
    this.editingSeriesId.set(null);
    this.loadData();
  }

}
