import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Absence {
  id: number;
  therapistId: number;
  date: string | null;
  endDate: string | null;
  weekday: string | null;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  absenceType: 'SPECIAL' | 'RECURRING';
}

export interface CreateAbsenceRequest {
  therapistId: number;
  date?: string;
  endDate?: string;
  weekday?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  absenceType: 'SPECIAL' | 'RECURRING';
}

@Injectable({
  providedIn: 'root',
})
export class AbsenceService {
  private apiUrl = '/api/absences';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Absence[]> {
    return this.http.get<Absence[]>(this.apiUrl);
  }

  getById(id: number): Observable<Absence> {
    return this.http.get<Absence>(`${this.apiUrl}/${id}`);
  }

  getByTherapist(therapistId: number): Observable<Absence[]> {
    return this.http.get<Absence[]>(`${this.apiUrl}/therapist/${therapistId}/date`);
  }

  create(absence: CreateAbsenceRequest): Observable<Absence> {
    return this.http.post<Absence>(this.apiUrl, absence);
  }

  update(id: number, absence: Partial<CreateAbsenceRequest>): Observable<Absence> {
    return this.http.put<Absence>(`${this.apiUrl}/${id}`, absence);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
