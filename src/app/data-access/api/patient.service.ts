import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  dateOfBirth?: string;
  insuranceType?: string;
  notes?: string;
  isActive?: boolean;
  isBWO?: boolean;
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

export interface PatientPageParams {
  page?: number;
  size?: number;
  sortBy?: 'firstName' | 'lastName' | 'fullName' | 'email' | 'telefon' | 'city' | 'isBWO';
  sortDir?: 'asc' | 'desc';
  search?: string;
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

  /**
   * Get paginated patients with server-side filtering and sorting.
   */
  getPaginated(params: PatientPageParams): Observable<PageResponse<Patient>> {
    let httpParams = new HttpParams();

    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.isBWO !== undefined) httpParams = httpParams.set('isBWO', params.isBWO.toString());

    return this.http.get<PageResponse<Patient>>(`${this.apiUrl}/paginated`, { params: httpParams });
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
