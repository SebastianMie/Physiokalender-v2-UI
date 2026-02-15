import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, of, tap, shareReplay, catchError, finalize, debounceTime, switchMap, BehaviorSubject } from 'rxjs';
import { AppointmentService, Appointment, PageResponse, AppointmentPageParams } from '../../data-access/api/appointment.service';

export interface CachedPageResult {
  data: PageResponse<Appointment>;
  timestamp: number;
  params: string; // JSON stringified params for cache key
}

export interface CacheStats {
  totalCachedPages: number;
  lastUpdated: Date | null;
  isPreloading: boolean;
}

/**
 * AppointmentCacheService provides intelligent caching for appointment data.
 *
 * Features:
 * - Server-side pagination with local caching
 * - Debounced search to reduce API calls
 * - Cache invalidation on data changes
 * - Preloading support for login
 * - Loading state management
 */
@Injectable({
  providedIn: 'root'
})
export class AppointmentCacheService {
  private appointmentService = inject(AppointmentService);

  // Cache configuration
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly DEBOUNCE_MS = 300; // 300ms debounce for search
  private readonly PRELOAD_PAGE_SIZE = 50;

  // Page cache: key = JSON params, value = cached result
  private pageCache = new Map<string, CachedPageResult>();

  // Loading state
  private _isLoading = signal(false);
  public isLoading = this._isLoading.asReadonly();

  // Preloading state
  private _isPreloading = signal(false);
  public isPreloading = this._isPreloading.asReadonly();

  // Search subject for debouncing
  private searchSubject = new Subject<AppointmentPageParams>();
  private searchResult$ = new BehaviorSubject<PageResponse<Appointment> | null>(null);

  // Cache invalidation trigger
  private invalidateSubject = new Subject<void>();

  // Current request params (for comparison)
  private currentParams = signal<AppointmentPageParams | null>(null);

  constructor() {
    this.setupSearchDebounce();
    this.setupInvalidation();
  }

  /**
   * Get paginated appointments with caching.
   * Uses server-side filtering for optimal performance.
   */
  getPaginated(params: AppointmentPageParams): Observable<PageResponse<Appointment>> {
    const cacheKey = this.createCacheKey(params);
    const cached = this.pageCache.get(cacheKey);

    // Check if cache is valid
    if (cached && this.isCacheValid(cached)) {
      return of(cached.data);
    }

    // Fetch from server
    this._isLoading.set(true);
    return this.appointmentService.getPaginated(params).pipe(
      tap(result => {
        this.pageCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          params: cacheKey
        });
      }),
      catchError(error => {
        console.error('Error fetching paginated appointments:', error);
        throw error;
      }),
      finalize(() => this._isLoading.set(false))
    );
  }

  /**
   * Debounced search - use this for user input.
   * Reduces API calls during typing.
   */
  searchDebounced(params: AppointmentPageParams): void {
    this.currentParams.set(params);
    this.searchSubject.next(params);
  }

  /**
   * Get the observable for debounced search results.
   */
  getSearchResults(): Observable<PageResponse<Appointment> | null> {
    return this.searchResult$.asObservable();
  }

  /**
   * Preload initial appointment data after login.
   * Can be called to warm the cache for faster initial display.
   */
  preloadData(): void {
    if (this._isPreloading()) return;

    this._isPreloading.set(true);

    // Preload first page with default sorting (most recent first)
    const preloadParams: AppointmentPageParams = {
      page: 0,
      size: this.PRELOAD_PAGE_SIZE,
      sortBy: 'date',
      sortDir: 'desc'
    };

    this.appointmentService.getPaginated(preloadParams).pipe(
      tap(result => {
        const cacheKey = this.createCacheKey(preloadParams);
        this.pageCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          params: cacheKey
        });
        console.log(`[AppointmentCache] Preloaded ${result.numberOfElements} appointments`);
      }),
      catchError(error => {
        console.warn('[AppointmentCache] Preload failed:', error);
        return of(null);
      }),
      finalize(() => this._isPreloading.set(false))
    ).subscribe();
  }

  /**
   * Invalidate the entire cache.
   * Call this after creating, updating, or deleting appointments.
   */
  invalidateCache(): void {
    this.invalidateSubject.next();
  }

  /**
   * Clear all cached data.
   */
  clearCache(): void {
    this.pageCache.clear();
    this.searchResult$.next(null);
    console.log('[AppointmentCache] Cache cleared');
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): CacheStats {
    let lastUpdated: Date | null = null;

    this.pageCache.forEach(cached => {
      const timestamp = new Date(cached.timestamp);
      if (!lastUpdated || timestamp > lastUpdated) {
        lastUpdated = timestamp;
      }
    });

    return {
      totalCachedPages: this.pageCache.size,
      lastUpdated,
      isPreloading: this._isPreloading()
    };
  }

  /**
   * Check if a specific page is cached.
   */
  isPageCached(params: AppointmentPageParams): boolean {
    const cacheKey = this.createCacheKey(params);
    const cached = this.pageCache.get(cacheKey);
    return cached !== undefined && this.isCacheValid(cached);
  }

  // ============ Private Methods ============

  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(this.DEBOUNCE_MS),
      switchMap(params => {
        this._isLoading.set(true);
        return this.getPaginated(params).pipe(
          catchError(error => {
            console.error('Search error:', error);
            return of({
              content: [],
              pageable: { pageNumber: 0, pageSize: 50 },
              totalElements: 0,
              totalPages: 0,
              first: true,
              last: true,
              number: 0,
              size: 50,
              numberOfElements: 0,
              empty: true
            } as PageResponse<Appointment>);
          }),
          finalize(() => this._isLoading.set(false))
        );
      })
    ).subscribe(result => {
      this.searchResult$.next(result);
    });
  }

  private setupInvalidation(): void {
    this.invalidateSubject.subscribe(() => {
      this.clearCache();

      // Re-fetch current view if params exist
      const current = this.currentParams();
      if (current) {
        this.searchDebounced(current);
      }
    });
  }

  private createCacheKey(params: AppointmentPageParams): string {
    // Create a normalized cache key from params
    const normalized = {
      page: params.page ?? 0,
      size: params.size ?? 50,
      sortBy: params.sortBy ?? 'date',
      sortDir: params.sortDir ?? 'desc',
      dateFrom: params.dateFrom ?? '',
      dateTo: params.dateTo ?? '',
      therapistId: params.therapistId ?? null,
      status: params.status ?? '',
      search: params.search ?? ''
    };
    return JSON.stringify(normalized);
  }

  private isCacheValid(cached: CachedPageResult): boolean {
    return Date.now() - cached.timestamp < this.CACHE_TTL_MS;
  }
}
