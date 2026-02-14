import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="logo-section">
          <h1 class="app-title">Physiokalender</h1>
          <p class="app-subtitle">Praxis Meyer Kalender für Physiotherapie</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="username" class="form-label">Benutzername</label>
            <input
              id="username"
              type="text"
              class="form-input"
              [class.error]="isFieldInvalid('username')"
              formControlName="username"
              placeholder="max.mustermann"
              autocomplete="username"
            />
            <span class="error-message" *ngIf="isFieldInvalid('username')">
              Bitte geben Sie Ihren Benutzernamen ein.
            </span>
          </div>

          <div class="form-group">
            <label for="password" class="form-label">Passwort</label>
            <input
              id="password"
              type="password"
              class="form-input"
              [class.error]="isFieldInvalid('password')"
              formControlName="password"
              placeholder="Passwort eingeben"
              autocomplete="current-password"
            />
            <span class="error-message" *ngIf="isFieldInvalid('password')">
              Passwort ist erforderlich.
            </span>
          </div>

          <button
            type="submit"
            class="btn-primary"
            [disabled]="!form.valid || loading"
          >
            {{ loading ? 'Wird angemeldet...' : 'Anmelden' }}
          </button>
        </form>

        <div class="demo-info">
          <p>Demo-Zugangsdaten:</p>
          <p class="credentials">Benutzer: <strong>max.mustermann</strong></p>
          <p class="credentials">Passwort: <strong>password</strong></p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #0066CC 0%, #0099FF 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 2.5rem;
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    }

    .logo-section {
      text-align: center;
      margin-bottom: 2rem;
    }

    .app-title {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 700;
      color: #0066CC;
      letter-spacing: -0.5px;
    }

    .app-subtitle {
      margin: 0.5rem 0 0 0;
      font-size: 0.875rem;
      color: #6B7280;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #1F2937;
    }

    .form-input {
      padding: 0.75rem;
      border: 1px solid #E5E7EB;
      border-radius: 0.375rem;
      font-size: 1rem;
      font-family: inherit;
      transition: all 0.2s ease;

      &:focus {
        outline: none;
        border-color: #0066CC;
        box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
      }

      &.error {
        border-color: #EF4444;
        background-color: rgba(239, 68, 68, 0.05);
      }
    }

    .error-message {
      font-size: 0.75rem;
      color: #EF4444;
      margin-top: 0.25rem;
    }

    .btn-primary {
      padding: 0.875rem;
      background-color: #0066CC;
      color: white;
      border: none;
      border-radius: 0.375rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 0.5rem;

      &:hover:not(:disabled) {
        background-color: #0052A3;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
      }

      &:active:not(:disabled) {
        transform: translateY(0);
      }

      &:disabled {
        background-color: #D1D5DB;
        cursor: not-allowed;
      }
    }

    .demo-info {
      padding: 1rem;
      background-color: #E6F0FF;
      border-radius: 0.375rem;
      border-left: 4px solid #0066CC;
      font-size: 0.75rem;
      color: #1F2937;

      p {
        margin: 0.25rem 0;

        &:first-child {
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
      }

      .credentials {
        font-family: 'Courier New', monospace;
        background-color: rgba(255, 255, 255, 0.5);
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
      }
    }

    @media (max-width: 640px) {
      .login-container {
        padding: 1rem;
      }

      .login-card {
        padding: 1.5rem;
      }
    }
  `]
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  loading = false;
  returnUrl = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    this.loading = true;
    const { username, password } = this.form.value;

    this.authService.login({ username, password }).subscribe({
      next: (response) => {
        this.toastService.success('Erfolgreich angemeldet!');
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        this.loading = false;
        console.error('Login error:', error);
        // Toast is handled by httpErrorInterceptor
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
