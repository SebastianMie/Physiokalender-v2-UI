import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, of, catchError } from 'rxjs';
import { Router } from '@angular/router';
import { AppointmentCacheService } from '../services/appointment-cache.service';

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
  private apiUrl = '/api';
  private userSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.userSubject.asObservable();
  public user$ = this.userSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private appointmentCache = inject(AppointmentCacheService);

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
          localStorage.setItem('user', JSON.stringify(response.user));
          this.userSubject.next(response.user);
          this.isAuthenticatedSubject.next(true);

          // Preload appointment data for faster initial display
          this.appointmentCache.preloadData();
        })
      );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('token_expires');
    localStorage.removeItem('user');
    this.userSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    // Clear appointment cache on logout
    this.appointmentCache.clearCache();
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
      // Try to restore user from localStorage first
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          this.userSubject.next(JSON.parse(storedUser));
        } catch {
          this.fetchCurrentUser();
        }
      } else {
        this.fetchCurrentUser();
      }
    } else {
      this.isAuthenticatedSubject.next(false);
    }
  }

  private fetchCurrentUser() {
    this.http.get<User>(`${this.apiUrl}/auth/me`).pipe(
      catchError(() => {
        // If fetch fails, try localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          return of(JSON.parse(storedUser));
        }
        throw new Error('No user found');
      })
    ).subscribe({
      next: (user) => {
        this.userSubject.next(user);
        localStorage.setItem('user', JSON.stringify(user));
      },
      error: () => this.logout()
    });
  }
}
