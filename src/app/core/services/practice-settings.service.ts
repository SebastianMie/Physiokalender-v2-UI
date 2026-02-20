import { Injectable, signal, computed, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppSettingClientService, AppSetting } from '../../data-access/api/app-setting.service';

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

const SETTINGS_KEY = 'physio_settings';

@Injectable({
  providedIn: 'root',
})
export class PracticeSettingsService {
  private appSettingService = inject(AppSettingClientService);

  private openingHoursSubject = new BehaviorSubject<OpeningHour[]>([]);
  public openingHours$ = this.openingHoursSubject.asObservable();

  private settingsSubject = new BehaviorSubject<PracticeSettings>({
    defaultAppointmentDuration: '30',
    calendarStartTime: '07:00',
    calendarEndTime: '20:00'
  });
  public settings$ = this.settingsSubject.asObservable();

  private readonly defaultDays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  private readonly dayKeys = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  constructor() {
    this.loadFromBackend();
  }

  /**
   * Load opening hours from backend app settings
   */
  private loadFromBackend(): void {
    this.appSettingService.getSettingsByCategory('OPENING_HOURS').subscribe({
      next: (settings) => {
        this.buildOpeningHoursFromSettings(settings);
        this.loadGeneralSettings();
      },
      error: (err) => {
        console.error('Error loading opening hours from backend:', err);
        this.initDefaultOpeningHours();
        this.loadGeneralSettings();
      }
    });
  }

  /**
   * Convert app settings to OpeningHour objects
   */
  private buildOpeningHoursFromSettings(settings: AppSetting[]): void {
    const hours: OpeningHour[] = this.defaultDays.map((day, index) => {
      const dayKey = this.dayKeys[index];

      // Find active setting for this day
      const activeSetting = settings.find(s => s.key === dayKey + '_ACTIVE');
      const isOpen = activeSetting?.value === 'true';

      // Find open/close times
      const openSetting = settings.find(s => s.key === dayKey + '_OPEN_TIME');
      const closeSetting = settings.find(s => s.key === dayKey + '_CLOSE_TIME');

      return {
        day,
        dayIndex: index,
        isOpen,
        openTime: openSetting?.value || '08:00',
        closeTime: closeSetting?.value || '18:00'
      };
    });

    this.openingHoursSubject.next(hours);
  }

  /**
   * Load general settings from localStorage (will be moved to backend later if needed)
   */
  private loadGeneralSettings(): void {
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
   * Save opening hours to backend and update the subject
   */
  saveOpeningHours(hours: OpeningHour[]): void {
    const settingsToSave: AppSetting[] = [];

    hours.forEach(hour => {
      const dayKey = this.dayKeys[hour.dayIndex];

      // Save active status
      settingsToSave.push({
        key: dayKey + '_ACTIVE',
        value: String(hour.isOpen),
        category: 'OPENING_HOURS',
        description: `Is ${hour.day} an open day`
      });

      // Save open time if day is active
      if (hour.isOpen) {
        settingsToSave.push({
          key: dayKey + '_OPEN_TIME',
          value: hour.openTime,
          category: 'OPENING_HOURS',
          description: `${hour.day} opening time`
        });

        settingsToSave.push({
          key: dayKey + '_CLOSE_TIME',
          value: hour.closeTime,
          category: 'OPENING_HOURS',
          description: `${hour.day} closing time`
        });
      }
    });

    // Save to backend
    this.appSettingService.saveSettings(settingsToSave).subscribe({
      next: () => {
        this.openingHoursSubject.next(hours);
        console.log('Opening hours saved to backend');
      },
      error: (err) => {
        console.error('Error saving opening hours:', err);
      }
    });
  }

  /**
   * Save general settings to localStorage
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
