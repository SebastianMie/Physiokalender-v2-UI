import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface OpeningHour {
  day: string;
  dayIndex: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface PracticeSettings {
  defaultAppointmentDuration: string;
  calendarStartTime: string;
  calendarEndTime: string;
}

const OPENING_HOURS_KEY = 'physio_opening_hours';
const SETTINGS_KEY = 'physio_settings';

@Injectable({
  providedIn: 'root',
})
export class PracticeSettingsService {
  private openingHoursSubject = new BehaviorSubject<OpeningHour[]>([]);
  public openingHours$ = this.openingHoursSubject.asObservable();

  private settingsSubject = new BehaviorSubject<PracticeSettings>({
    defaultAppointmentDuration: '30',
    calendarStartTime: '07:00',
    calendarEndTime: '20:00'
  });
  public settings$ = this.settingsSubject.asObservable();

  private readonly defaultDays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load settings from localStorage
   */
  private loadFromStorage(): void {
    // Load opening hours
    const storedHours = localStorage.getItem(OPENING_HOURS_KEY);
    if (storedHours) {
      try {
        const parsed = JSON.parse(storedHours);
        this.openingHoursSubject.next(parsed);
      } catch {
        this.initDefaultOpeningHours();
      }
    } else {
      this.initDefaultOpeningHours();
    }

    // Load general settings
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        this.settingsSubject.next({
          ...this.settingsSubject.value,
          ...parsed
        });
      } catch {
        // Keep defaults
      }
    }
  }

  /**
   * Initialize default opening hours (Mon-Fri open 8-18, Sat-Sun closed)
   */
  private initDefaultOpeningHours(): void {
    const hours: OpeningHour[] = this.defaultDays.map((day, index) => ({
      day,
      dayIndex: index,
      isOpen: index < 5, // Mon-Fri open by default
      openTime: '08:00',
      closeTime: '18:00'
    }));
    this.openingHoursSubject.next(hours);
  }

  /**
   * Get the current opening hours (synchronous)
   */
  getOpeningHours(): OpeningHour[] {
    return this.openingHoursSubject.value;
  }

  /**
   * Get the current settings (synchronous)
   */
  getSettings(): PracticeSettings {
    return this.settingsSubject.value;
  }

  /**
   * Save opening hours to localStorage and update the subject
   */
  saveOpeningHours(hours: OpeningHour[]): void {
    localStorage.setItem(OPENING_HOURS_KEY, JSON.stringify(hours));
    this.openingHoursSubject.next(hours);
  }

  /**
   * Save general settings to localStorage and update the subject
   */
  saveSettings(settings: PracticeSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    this.settingsSubject.next(settings);
  }

  /**
   * Check if a specific day (0 = Monday, ..., 6 = Sunday) is open
   * Note: JavaScript Date.getDay() returns 0 = Sunday, 1 = Monday, etc.
   * So we convert: jsDay 0 (Sun) -> dayIndex 6, jsDay 1 (Mon) -> dayIndex 0, etc.
   */
  isDayOpen(jsDay: number): boolean {
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
    const hours = this.openingHoursSubject.value;
    const dayConfig = hours.find(h => h.dayIndex === dayIndex);
    return dayConfig?.isOpen ?? true;
  }

  /**
   * Get the opening hours for a specific day
   */
  getOpeningHoursForDay(jsDay: number): OpeningHour | undefined {
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
    return this.openingHoursSubject.value.find(h => h.dayIndex === dayIndex);
  }

  /**
   * Get all days that are open (returns array of dayIndex values 0-6)
   */
  getOpenDays(): number[] {
    return this.openingHoursSubject.value
      .filter(h => h.isOpen)
      .map(h => h.dayIndex);
  }

  /**
   * Check if there are any open days
   */
  hasOpenDays(): boolean {
    return this.openingHoursSubject.value.some(h => h.isOpen);
  }

  /**
   * Convert dayIndex (0=Mon, 6=Sun) to JS Date.getDay() format (0=Sun, 6=Sat)
   */
  dayIndexToJsDay(dayIndex: number): number {
    return dayIndex === 6 ? 0 : dayIndex + 1;
  }
}
