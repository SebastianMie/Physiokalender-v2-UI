import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';
import { PracticeSettingsService, OpeningHour } from '../../core/services/practice-settings.service';

interface Holiday {
  id: number;
  name: string;
  date: string;
  recurring: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h1>Stammdaten & Einstellungen</h1>

      <!-- Opening Hours Section -->
      <div class="card">
        <div class="card-header">
          <h2>Öffnungszeiten</h2>
          <span class="subtitle">Praxis-Öffnungszeiten einstellen</span>
        </div>
        <div class="card-body">
          <div class="opening-hours-grid">
            @for (day of openingHours(); track day.dayIndex) {
              <div class="day-row">
                <div class="day-name">{{ day.day }}</div>
                <label class="toggle">
                  <input type="checkbox" [(ngModel)]="day.isOpen" />
                  <span class="slider"></span>
                </label>
                @if (day.isOpen) {
                  <div class="time-inputs">
                    <input type="time" [(ngModel)]="day.openTime" class="time-input" />
                    <span class="time-separator">bis</span>
                    <input type="time" [(ngModel)]="day.closeTime" class="time-input" />
                  </div>
                } @else {
                  <span class="closed-text">Geschlossen</span>
                }
              </div>
            }
          </div>
          <div class="actions">
            <button class="btn btn-primary" (click)="saveOpeningHours()">Öffnungszeiten speichern</button>
          </div>
        </div>
      </div>

      <!-- Holidays Section -->
      <div class="card">
        <div class="card-header">
          <h2>Feiertage & Betriebsferien</h2>
          <button class="btn-sm" (click)="openHolidayModal()">+ Hinzufügen</button>
        </div>
        <div class="card-body">
          @if (holidays().length === 0) {
            <p class="empty-text">Keine Feiertage definiert</p>
          } @else {
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Datum</th>
                  <th>Jährlich</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (holiday of holidays(); track holiday.id) {
                  <tr>
                    <td>{{ holiday.name }}</td>
                    <td>{{ formatDate(holiday.date) }}</td>
                    <td>
                      <span [class]="holiday.recurring ? 'badge badge-success' : 'badge badge-neutral'">
                        {{ holiday.recurring ? 'Ja' : 'Nein' }}
                      </span>
                    </td>
                    <td class="col-actions">
                      <button class="btn-delete" (click)="deleteHoliday(holiday)">🗑️</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>

      <!-- General Settings -->
      <div class="card">
        <div class="card-header">
          <h2>Allgemeine Einstellungen</h2>
        </div>
        <div class="card-body">
          <div class="settings-grid">
            <div class="setting-row">
              <div class="setting-info">
                <label>Standard-Terminlänge</label>
                <span class="setting-desc">Standarddauer für neue Termine</span>
              </div>
              <select [(ngModel)]="defaultAppointmentDuration" class="setting-select">
                <option value="15">15 Minuten</option>
                <option value="20">20 Minuten</option>
                <option value="30">30 Minuten</option>
                <option value="45">45 Minuten</option>
                <option value="60">60 Minuten</option>
              </select>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <label>Kalender-Startzeit</label>
                <span class="setting-desc">Erste angezeigte Stunde im Kalender</span>
              </div>
              <input type="time" [(ngModel)]="calendarStartTime" class="time-input" />
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <label>Kalender-Endzeit</label>
                <span class="setting-desc">Letzte angezeigte Stunde im Kalender</span>
              </div>
              <input type="time" [(ngModel)]="calendarEndTime" class="time-input" />
            </div>
          </div>
          <div class="actions">
            <button class="btn btn-primary" (click)="saveGeneralSettings()">Einstellungen speichern</button>
          </div>
        </div>
      </div>

      <!-- Holiday Modal -->
      @if (showHolidayModal) {
        <div class="modal-overlay" (click)="closeHolidayModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>{{ editingHoliday ? 'Feiertag bearbeiten' : 'Neuer Feiertag' }}</h2>
            <form (ngSubmit)="saveHoliday()">
              <div class="form-group">
                <label>Name *</label>
                <input type="text" [(ngModel)]="holidayForm.name" name="name" required placeholder="z.B. Weihnachten" />
              </div>
              <div class="form-group">
                <label>Datum *</label>
                <input type="date" [(ngModel)]="holidayForm.date" name="date" required />
              </div>
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" [(ngModel)]="holidayForm.recurring" name="recurring" />
                  Jedes Jahr wiederholen
                </label>
              </div>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closeHolidayModal()">Abbrechen</button>
                <button type="submit" class="btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { padding: 1.5rem; max-width: 900px; }
    h1 { margin: 0 0 1.5rem 0; color: #1F2937; font-size: 1.5rem; }
    .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; overflow: hidden; }
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid #E5E7EB; background: #F9FAFB; }
    .card-header h2 { margin: 0; font-size: 1rem; color: #1F2937; font-weight: 600; }
    .subtitle { font-size: 0.75rem; color: #6B7280; display: block; margin-top: 0.25rem; }
    .card-body { padding: 1.5rem; }

    /* Opening Hours */
    .opening-hours-grid { display: flex; flex-direction: column; gap: 0.75rem; }
    .day-row { display: flex; align-items: center; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid #F3F4F6; }
    .day-row:last-child { border-bottom: none; }
    .day-name { width: 100px; font-weight: 500; color: #374151; }
    .toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; inset: 0; background: #D1D5DB; border-radius: 24px; transition: 0.2s; }
    .slider::before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s; }
    .toggle input:checked + .slider { background: #2563EB; }
    .toggle input:checked + .slider::before { transform: translateX(20px); }
    .time-inputs { display: flex; align-items: center; gap: 0.5rem; }
    .time-input { padding: 0.375rem 0.5rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; }
    .time-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .time-separator { color: #6B7280; font-size: 0.875rem; }
    .closed-text { color: #9CA3AF; font-size: 0.875rem; font-style: italic; }

    /* Table */
    .table { width: 100%; border-collapse: collapse; }
    .table th { text-align: left; padding: 0.5rem; font-size: 0.75rem; color: #6B7280; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #E5E7EB; }
    .table td { padding: 0.75rem 0.5rem; border-bottom: 1px solid #F3F4F6; color: #1F2937; }
    .col-actions { width: 50px; text-align: right; }
    .btn-delete { background: none; border: none; cursor: pointer; opacity: 0.4; transition: opacity 0.2s; }
    .btn-delete:hover { opacity: 1; }
    .badge { padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
    .badge-success { background: #D1FAE5; color: #065F46; }
    .badge-neutral { background: #E5E7EB; color: #6B7280; }
    .empty-text { color: #9CA3AF; text-align: center; padding: 2rem; margin: 0; }

    /* Settings Grid */
    .settings-grid { display: flex; flex-direction: column; gap: 1rem; }
    .setting-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #F3F4F6; }
    .setting-row:last-child { border-bottom: none; }
    .setting-info label { display: block; font-weight: 500; color: #374151; margin-bottom: 0.125rem; }
    .setting-desc { font-size: 0.75rem; color: #9CA3AF; }
    .setting-select { padding: 0.375rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; background: white; }
    .setting-select:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }

    /* Actions */
    .actions { margin-top: 1.5rem; display: flex; justify-content: flex-end; }
    .btn-primary { background: #2563EB; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-primary:hover { background: #1D4ED8; }
    .btn-secondary { background: #E5E7EB; color: #374151; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-secondary:hover { background: #D1D5DB; }
    .btn-sm { background: #2563EB; color: white; border: none; padding: 0.375rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 500; }
    .btn-sm:hover { background: #1D4ED8; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .modal h2 { margin: 0 0 1.5rem 0; color: #1F2937; font-size: 1.25rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; color: #374151; font-size: 0.875rem; }
    .form-group input[type="text"], .form-group input[type="date"] { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; box-sizing: border-box; }
    .form-group input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .checkbox-group label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: normal; }
    .checkbox-group input[type="checkbox"] { width: 1rem; height: 1rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
  `]
})
export class SettingsComponent implements OnInit {
  openingHours = signal<OpeningHour[]>([]);
  holidays = signal<Holiday[]>([]);

  defaultAppointmentDuration = '30';
  calendarStartTime = '07:00';
  calendarEndTime = '20:00';

  showHolidayModal = false;
  editingHoliday: Holiday | null = null;
  holidayForm = { name: '', date: '', recurring: true };
  private nextHolidayId = 1;

  constructor(
    private toast: ToastService,
    private practiceSettings: PracticeSettingsService
  ) {}

  ngOnInit() {
    this.loadOpeningHours();
    this.loadHolidays();
    this.loadGeneralSettings();
  }

  loadOpeningHours() {
    const hours = this.practiceSettings.getOpeningHours();
    this.openingHours.set(hours);
  }

  loadGeneralSettings() {
    const settings = this.practiceSettings.getSettings();
    this.defaultAppointmentDuration = settings.defaultAppointmentDuration;
    this.calendarStartTime = settings.calendarStartTime;
    this.calendarEndTime = settings.calendarEndTime;
  }

  loadHolidays() {
    // Load from localStorage or use defaults
    const stored = localStorage.getItem('physio_holidays');
    if (stored) {
      const parsed = JSON.parse(stored);
      this.holidays.set(parsed);
      this.nextHolidayId = Math.max(...parsed.map((h: Holiday) => h.id), 0) + 1;
    } else {
      // Default German holidays
      const defaults: Holiday[] = [
        { id: 1, name: 'Neujahr', date: '2025-01-01', recurring: true },
        { id: 2, name: 'Karfreitag', date: '2025-04-18', recurring: false },
        { id: 3, name: 'Ostermontag', date: '2025-04-21', recurring: false },
        { id: 4, name: 'Tag der Arbeit', date: '2025-05-01', recurring: true },
        { id: 5, name: 'Christi Himmelfahrt', date: '2025-05-29', recurring: false },
        { id: 6, name: 'Pfingstmontag', date: '2025-06-09', recurring: false },
        { id: 7, name: 'Tag der Deutschen Einheit', date: '2025-10-03', recurring: true },
        { id: 8, name: 'Weihnachten', date: '2025-12-25', recurring: true },
        { id: 9, name: '2. Weihnachtstag', date: '2025-12-26', recurring: true }
      ];
      this.holidays.set(defaults);
      this.nextHolidayId = 10;
    }
  }

  saveOpeningHours() {
    this.practiceSettings.saveOpeningHours(this.openingHours());
    this.toast.success('Öffnungszeiten gespeichert');
  }

  openHolidayModal() {
    this.editingHoliday = null;
    this.holidayForm = { name: '', date: '', recurring: true };
    this.showHolidayModal = true;
  }

  closeHolidayModal() {
    this.showHolidayModal = false;
    this.editingHoliday = null;
  }

  saveHoliday() {
    if (!this.holidayForm.name || !this.holidayForm.date) {
      this.toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    const updated = [...this.holidays()];
    if (this.editingHoliday) {
      const idx = updated.findIndex(h => h.id === this.editingHoliday!.id);
      if (idx >= 0) {
        updated[idx] = { ...this.editingHoliday, ...this.holidayForm };
      }
    } else {
      updated.push({
        id: this.nextHolidayId++,
        name: this.holidayForm.name,
        date: this.holidayForm.date,
        recurring: this.holidayForm.recurring
      });
    }

    this.holidays.set(updated);
    localStorage.setItem('physio_holidays', JSON.stringify(updated));
    this.toast.success(this.editingHoliday ? 'Feiertag aktualisiert' : 'Feiertag hinzugefügt');
    this.closeHolidayModal();
  }

  deleteHoliday(holiday: Holiday) {
    const updated = this.holidays().filter(h => h.id !== holiday.id);
    this.holidays.set(updated);
    localStorage.setItem('physio_holidays', JSON.stringify(updated));
    this.toast.success('Feiertag gelöscht');
  }

  saveGeneralSettings() {
    this.practiceSettings.saveSettings({
      defaultAppointmentDuration: this.defaultAppointmentDuration,
      calendarStartTime: this.calendarStartTime,
      calendarEndTime: this.calendarEndTime
    });
    this.toast.success('Einstellungen gespeichert');
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
