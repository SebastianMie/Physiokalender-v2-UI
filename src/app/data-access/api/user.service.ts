import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserData {
  id: number;
  username: string;
  role: string;
  therapistId: number | null;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: string;
  therapistId?: number | null;
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  role?: string;
  therapistId?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = '/api/admin/users';

  constructor(private http: HttpClient) {}

  getAll(): Observable<UserData[]> {
    return this.http.get<UserData[]>(this.apiUrl);
  }

  getById(id: number): Observable<UserData> {
    return this.http.get<UserData>(`${this.apiUrl}/${id}`);
  }

  create(user: CreateUserRequest): Observable<UserData> {
    return this.http.post<UserData>(this.apiUrl, user);
  }

  update(id: number, user: UpdateUserRequest): Observable<UserData> {
    return this.http.put<UserData>(`${this.apiUrl}/${id}`, user);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
