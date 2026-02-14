import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Therapist {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  telefon: string;
  activeSince: string | null;
  activeUntil: string | null;
  isActive: boolean;
}

export interface CreateTherapistRequest {
  firstName: string;
  lastName: string;
  email: string;
  telefon?: string;
  userName?: string;
  password?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TherapistService {
  private apiUrl = '/api/therapists';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Therapist[]> {
    return this.http.get<Therapist[]>(this.apiUrl);
  }

  getById(id: number): Observable<Therapist> {
    return this.http.get<Therapist>(`${this.apiUrl}/${id}`);
  }

  create(therapist: CreateTherapistRequest): Observable<Therapist> {
    return this.http.post<Therapist>(this.apiUrl, therapist);
  }

  update(id: number, therapist: Partial<CreateTherapistRequest>): Observable<Therapist> {
    return this.http.put<Therapist>(`${this.apiUrl}/${id}`, therapist);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
