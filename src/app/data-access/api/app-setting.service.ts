import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface AppSetting {
  id?: number;
  key: string;
  value: string;
  category?: string;
  description?: string;
}

/**
 * Service for managing application settings/configuration.
 * Communicates with backend API to load and save settings.
 */
@Injectable({
  providedIn: 'root'
})
export class AppSettingClientService {
  private http = inject(HttpClient);
  private readonly apiUrl = '/api/settings';

  private settingsCache = new BehaviorSubject<Map<string, string>>(new Map());
  public settings$ = this.settingsCache.asObservable();

  /**
   * Load all settings in a category from backend
   */
  getSettingsByCategory(category: string): Observable<AppSetting[]> {
    return this.http.get<AppSetting[]>(`${this.apiUrl}/category/${category}`)
      .pipe(
        tap(settings => {
          const map = new Map(this.settingsCache.value);
          settings.forEach(s => map.set(s.key, s.value));
          this.settingsCache.next(map);
        })
      );
  }

  /**
   * Get a single setting from backend
   */
  getSetting(key: string): Observable<{ key: string; value: string }> {
    return this.http.get<{ key: string; value: string }>(`${this.apiUrl}/${key}`);
  }

  /**
   * Get a setting value from cache (if loaded)
   */
  getCachedValue(key: string): string | undefined {
    return this.settingsCache.value.get(key);
  }

  /**
   * Save multiple settings to backend
   */
  saveSettings(settings: AppSetting[]): Observable<AppSetting[]> {
    return this.http.post<AppSetting[]>(`${this.apiUrl}/batch`, settings)
      .pipe(
        tap(saved => {
          const map = new Map(this.settingsCache.value);
          saved.forEach(s => map.set(s.key, s.value));
          this.settingsCache.next(map);
        })
      );
  }

  /**
   * Save a single setting to backend
   */
  saveSetting(setting: AppSetting): Observable<AppSetting> {
    return this.http.post<AppSetting>(`${this.apiUrl}`, setting)
      .pipe(
        tap(saved => {
          const map = new Map(this.settingsCache.value);
          map.set(saved.key, saved.value);
          this.settingsCache.next(map);
        })
      );
  }
}
