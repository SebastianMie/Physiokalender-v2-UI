import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Appointment {
  id: number;
  patientId: number;
  patientName: string;
  therapistId: number;
  therapistName: string;
  treatmentTypeId: number;
  treatmentTypeName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  notes?: string;
  isBWO: boolean;
  isHomeVisit: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentRequest {
  patientId: number;
  therapistId: number;
  treatmentTypeId: number;
  date: string;
  startTime: string;
  endTime?: string;
  notes?: string;
  isBWO?: boolean;
  isHomeVisit?: boolean;
}

export interface MoveAppointmentRequest {
  newDate: string;
  newStartTime: string;
  newEndTime?: string;
  newTherapistId?: number;
  force?: boolean;
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

@Injectable({
  providedIn: 'root',
})
export class AppointmentService {
  private http = inject(HttpClient);

  private readonly apiUrl = '/api/appointments';

  getAll(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(this.apiUrl);
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

  create(appointment: CreateAppointmentRequest, force = false): Observable<AppointmentSaveResult> {
    const params = new HttpParams().set('force', force.toString());
    return this.http.post<AppointmentSaveResult>(this.apiUrl, appointment, { params });
  }

  update(id: number, appointment: Partial<CreateAppointmentRequest>, force = false): Observable<AppointmentSaveResult> {
    const params = new HttpParams().set('force', force.toString());
    return this.http.put<AppointmentSaveResult>(`${this.apiUrl}/${id}`, appointment, { params });
  }

  move(id: number, request: MoveAppointmentRequest): Observable<AppointmentSaveResult> {
    return this.http.post<AppointmentSaveResult>(`${this.apiUrl}/${id}/move`, request);
  }

  cancel(id: number, reason?: string): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.apiUrl}/${id}/cancel`, { reason });
  }

  checkConflicts(draft: CreateAppointmentRequest): Observable<ConflictCheckResult> {
    return this.http.post<ConflictCheckResult>(`${this.apiUrl}/check-conflicts`, draft);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
