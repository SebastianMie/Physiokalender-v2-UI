import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  id: number;
  username: string;
  role: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  user: User;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/api';
  private userSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.userSubject.asObservable();
  public user$ = this.userSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.checkAuth();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap((response) => {
          localStorage.setItem('token', response.token);
          localStorage.setItem('token_expires', (Date.now() + response.expiresIn).toString());
          this.userSubject.next(response.user);
          this.isAuthenticatedSubject.next(true);
        })
      );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('token_expires');
    this.userSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isTokenExpired(): boolean {
    const expires = localStorage.getItem('token_expires');
    if (!expires) return true;
    return Date.now() > parseInt(expires);
  }

  checkAuth() {
    const token = this.getToken();
    if (token && !this.isTokenExpired()) {
      this.isAuthenticatedSubject.next(true);
      this.fetchCurrentUser();
    } else {
      this.isAuthenticatedSubject.next(false);
    }
  }

  private fetchCurrentUser() {
    this.http.get<User>(`${this.apiUrl}/auth/me`).subscribe(
      (user) => this.userSubject.next(user),
      () => this.logout()
    );
  }
}
