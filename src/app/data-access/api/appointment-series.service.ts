import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AppointmentSeries {
  id: number;
  therapistId: number;
  therapistName: string;
  patientId: number;
  patientName: string;
  startTime: string;        // "HH:mm:ss"
  endTime: string;           // "HH:mm:ss"
  startDate: string;         // "2024-01-15"
  endDate: string;           // "2024-06-15"
  weeklyFrequency: number;   // 1 = every week, 2 = every 2 weeks, etc.
  weekday: string;           // "MONDAY", "TUESDAY", ... or 1-7
  comment?: string;
  status: 'ACTIVE' | 'CANCELLED' | 'COMPLETED' | 'PAUSED';
  cancellations?: CancellationDTO[];
  isHotair?: boolean;
  isUltrasonic?: boolean;
  isElectric?: boolean;
}

export interface CreateAppointmentSeriesRequest {
  therapistId: number;
  patientId: number;
  startTime: string;         // ISO timestamp
  endTime: string;           // ISO timestamp
  startDate: string;         // ISO timestamp
  endDate: string;           // ISO timestamp
  weeklyFrequency: number;
  weekday: string;
  comment?: string;
  isHotair?: boolean;
  isUltrasonic?: boolean;
  isElectric?: boolean;
}

export interface CancellationDTO {
  id?: number;
  date: string;              // ISO date
}

export interface UpdateAppointmentSeriesRequest {
  startTime?: string;        // ISO timestamp
  endTime?: string;          // ISO timestamp
  comment?: string;
  isHotair?: boolean;
  isUltrasonic?: boolean;
  isElectric?: boolean;
  endDate?: string;          // ISO date string (YYYY-MM-DD) or ISO timestamp
  weeklyFrequency?: number;  // 1, 2, 3, or 4 weeks
}

@Injectable({
  providedIn: 'root',
})
export class AppointmentSeriesService {
  private http = inject(HttpClient);
  private readonly apiUrl = '/api/appointmentseries';

  getAll(): Observable<AppointmentSeries[]> {
    return this.http.get<AppointmentSeries[]>(this.apiUrl);
  }

  getById(id: number): Observable<AppointmentSeries> {
    return this.http.get<AppointmentSeries>(`${this.apiUrl}/${id}`);
  }

  create(series: CreateAppointmentSeriesRequest): Observable<string> {
    return this.http.post(this.apiUrl, series, { responseType: 'text' });
  }

  update(id: number, series: UpdateAppointmentSeriesRequest): Observable<AppointmentSeries> {
    return this.http.put<AppointmentSeries>(`${this.apiUrl}/${id}`, series);
  }

  addCancellations(seriesId: number, cancellations: CancellationDTO[]): Observable<AppointmentSeries> {
    return this.http.post<AppointmentSeries>(`${this.apiUrl}/${seriesId}/cancellations`, cancellations);
  }

  deleteCancellation(seriesId: number, cancellationId: number): Observable<AppointmentSeries> {
    return this.http.delete<AppointmentSeries>(`${this.apiUrl}/${seriesId}/cancellations/${cancellationId}`);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
