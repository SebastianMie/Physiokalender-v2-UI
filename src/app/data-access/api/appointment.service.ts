import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Appointment {
  id: number;
  therapistId: number;
  therapistName: string;
  patientId: number;
  patientName: string;
  date: string;          // "2024-01-15"
  startTime: string;     // "2024-01-15T09:00:00" or "09:00:00"
  endTime: string;       // "2024-01-15T10:00:00" or "10:00:00"
  comment?: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  isHotair: boolean;
  isUltrasonic: boolean;
  isElectric: boolean;
  isBWO: boolean;
  createdBySeriesAppointment: boolean;
  appointmentSeriesId?: number;
  createdAt: string;
}

export interface CreateAppointmentRequest {
  therapistId: number;
  patientId: number;
  date: string;        // ISO timestamp, e.g. "2024-01-15T00:00:00.000Z"
  startTime: string;   // ISO timestamp, e.g. "2024-01-15T09:00:00.000Z"
  endTime: string;     // ISO timestamp, e.g. "2024-01-15T10:00:00.000Z"
  comment?: string;
  isHotair?: boolean;
  isUltrasonic?: boolean;
  isElectric?: boolean;
}

export interface MoveAppointmentRequest {
  newDate: string;
  newStartTime: string;
  newEndTime?: string;
  newTherapistId?: number;
  force?: boolean;
}

export interface AppointmentStatusUpdateRequest {
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  reason?: string; // Optional reason for status change
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: ConflictInfo[];
  suggestions: SlotSuggestion[];
}

export interface ConflictInfo {
  type: string;
  message: string;
  conflictingAppointmentId?: number;
}

export interface SlotSuggestion {
  date: string;
  startTime: string;
  endTime: string;
  therapistId: number;
  therapistName: string;
}

export interface AppointmentSaveResult {
  appointment: Appointment;
  conflictCheck: ConflictCheckResult;
  saved: boolean;
}

export interface PageResponse<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
  };
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  number: number;
  size: number;
  numberOfElements: number;
  empty: boolean;
}

export interface AppointmentPageParams {
  page?: number;
  size?: number;
  sortBy?: 'date' | 'time' | 'patient' | 'therapist';
  sortDir?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
  therapistId?: number;
  status?: string;
  search?: string;
}

export interface AppointmentExtendedPageParams extends AppointmentPageParams {
  patientId?: number;
  appointmentType?: 'series' | 'single';  // null = all
  timeFilter?: 'upcoming' | 'past';  // null = all
}

@Injectable({
  providedIn: 'root',
})
export class AppointmentService {
  private http = inject(HttpClient);

  private readonly apiUrl = '/api/appointments';

  getAll(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(this.apiUrl);
  }

  /**
   * Get paginated appointments with server-side filtering and sorting.
   * Supports lazy loading for large datasets.
   */
  getPaginated(params: AppointmentPageParams): Observable<PageResponse<Appointment>> {
    let httpParams = new HttpParams();

    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.therapistId) httpParams = httpParams.set('therapistId', params.therapistId.toString());
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<PageResponse<Appointment>>(`${this.apiUrl}/paginated`, { params: httpParams });
  }

  /**
   * Get paginated appointments with extended filtering (including appointment type and time filter).
   * Used for therapist detail view and patient detail view with faceted search.
   */
  getPaginatedExtended(params: AppointmentExtendedPageParams): Observable<PageResponse<Appointment>> {
    let httpParams = new HttpParams();

    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.therapistId) httpParams = httpParams.set('therapistId', params.therapistId.toString());
    if (params.patientId) httpParams = httpParams.set('patientId', params.patientId.toString());
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.appointmentType) httpParams = httpParams.set('appointmentType', params.appointmentType);
    if (params.timeFilter) httpParams = httpParams.set('timeFilter', params.timeFilter);

    return this.http.get<PageResponse<Appointment>>(`${this.apiUrl}/paginated-extended`, { params: httpParams });
  }

  getById(id: number): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.apiUrl}/${id}`);
  }

  getByTherapist(therapistId: number, from?: string, to?: string): Observable<Appointment[]> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<Appointment[]>(`${this.apiUrl}/therapist/${therapistId}`, { params });
  }

  getByPatient(patientId: number, from?: string, to?: string): Observable<Appointment[]> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<Appointment[]>(`${this.apiUrl}/patient/${patientId}`, { params });
  }

  getByDate(date: string): Observable<Appointment[]> {
    const params = new HttpParams().set('date', date);
    return this.http.get<Appointment[]>(`${this.apiUrl}/date`, { params });
  }

  getByDateRange(from: string, to: string): Observable<Appointment[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<Appointment[]>(`${this.apiUrl}/range`, { params });
  }

  create(appointment: CreateAppointmentRequest, forceOnConflict = false): Observable<AppointmentSaveResult> {
    const params = new HttpParams().set('forceOnConflict', forceOnConflict.toString());
    return this.http.post<AppointmentSaveResult>(this.apiUrl, appointment, { params });
  }

  update(id: number, appointment: Partial<CreateAppointmentRequest>, forceOnConflict = false): Observable<AppointmentSaveResult> {
    const params = new HttpParams().set('forceOnConflict', forceOnConflict.toString());
    return this.http.put<AppointmentSaveResult>(`${this.apiUrl}/${id}`, appointment, { params });
  }

  move(id: number, request: MoveAppointmentRequest, forceOnConflict = false): Observable<AppointmentSaveResult> {
    const params = new HttpParams().set('forceOnConflict', forceOnConflict.toString());
    return this.http.post<AppointmentSaveResult>(`${this.apiUrl}/${id}/move`, request, { params });
  }

  cancel(id: number, reason?: string): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.apiUrl}/${id}/cancel`, { reason });
  }

  /**
   * Update appointment status with optional reason.
   * PATCH /api/appointments/{id}/status
   */
  updateStatus(id: number, statusUpdate: AppointmentStatusUpdateRequest): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.apiUrl}/${id}/status`, statusUpdate);
  }

  checkConflicts(draft: CreateAppointmentRequest): Observable<ConflictCheckResult> {
    return this.http.post<ConflictCheckResult>(`${this.apiUrl}/check-conflicts`, draft);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
