import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  telefon: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  dateOfBirth: string | null;
  insuranceType: string | null;
  isActive: boolean;
  notes: string | null;
  activeSince: string | null;
  activeUntil: string | null;
  isBWO: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreatePatientRequest {
  firstName: string;
  lastName: string;
  email?: string;
  telefon?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  isBWO?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PatientService {
  private apiUrl = '/api/patients';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Patient[]> {
    return this.http.get<Patient[]>(this.apiUrl);
  }

  getById(id: number): Observable<Patient> {
    return this.http.get<Patient>(`${this.apiUrl}/${id}`);
  }

  create(patient: CreatePatientRequest): Observable<Patient> {
    return this.http.post<Patient>(this.apiUrl, patient);
  }

  update(id: number, patient: Partial<CreatePatientRequest>): Observable<Patient> {
    return this.http.put<Patient>(`${this.apiUrl}/${id}`, patient);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
