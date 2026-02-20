import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs';
import { of } from 'rxjs';

interface Holiday {
  date: string;
  name: string;
  recurring: boolean;
}

/**
 * Service für Holiday/Feiertag-Verwaltung
 * Lädt Feiertage von der Backend API und bietet zentrale Funktionen für Verwaltung
 */
@Injectable({
  providedIn: 'root'
})
export class HolidayService {
  private holidays$ = signal<Holiday[]>([]);
  private readonly API_URL = '/api/holidays';

  constructor(private http: HttpClient) {
    this.loadHolidaysFromAPI();
  }

  /**
   * Lädt Feiertage von der Backend API
   */
  private loadHolidaysFromAPI(): void {
    this.http.get<any>(this.API_URL)
      .pipe(
        catchError(error => {
          console.error('Fehler beim Laden der Feiertage von API:', error);
          return of([]);
        })
      )
      .subscribe(data => {
        // Handle both array and wrapped response
        let holidays: Holiday[] = [];
        if (Array.isArray(data)) {
          holidays = data;
        } else if (data && Array.isArray(data.holidays)) {
          holidays = data.holidays;
        }
        this.holidays$.set(holidays);
      });
  }

  /**
   * Gibt alle Feiertags-Daten als Signal zurück
   */
  getHolidaysSignal() {
    return this.holidays$;
  }

  /**
   * Gibt alle Feiertags-Daten zurück
   */
  getHolidays(): Holiday[] {
    return this.holidays$();
  }

  /**
   * Gibt nur die Daten (YYYY-MM-DD) als Array zurück
   */
  getHolidayDates(): string[] {
    return this.getHolidays().map(h => h.date);
  }

  /**
   * Prüft ob ein bestimmtes Datum ein Feiertag ist
   */
  isHoliday(dateStr: string): boolean {
    return this.getHolidayDates().includes(dateStr);
  }

  /**
   * Filtert ein Array von Daten und entfernt Feiertage
   */
  filterOutHolidays(dates: string[]): string[] {
    const holidays = this.getHolidayDates();
    return dates.filter(d => !holidays.includes(d));
  }

  /**
   * Gibt den Namen eines Feiertags zurück, wenn datiert on ist, sonst null
   */
  getHolidayName(dateStr: string): string | null {
    const holiday = this.getHolidays().find(h => h.date === dateStr);
    return holiday?.name || null;
  }
}
