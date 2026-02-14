import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface EnvironmentInfo {
  environment: string;
  applicationName: string;
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
  mailEnabled: boolean;
  seedDataEnabled: boolean;
  banner: {
    show: string;
    text: string;
    color: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  private readonly envInfo = signal<EnvironmentInfo | null>(null);
  private readonly urlEnvironment = signal<string>('');

  // Computed signals for easy access
  readonly environment = computed(() => this.envInfo()?.environment ?? 'UNKNOWN');
  readonly isDev = computed(() => this.urlEnvironment() === 'dev' || this.envInfo()?.isDevelopment === true);
  readonly isTest = computed(() => this.urlEnvironment() === 'test' || this.envInfo()?.isTest === true);
  readonly isProd = computed(() => !this.isDev() && !this.isTest());
  readonly banner = computed(() => this.envInfo()?.banner);
  readonly showBanner = computed(() => this.banner()?.show === 'true' || this.isDev() || this.isTest());

  // API base URL based on environment prefix in URL
  readonly apiBaseUrl = computed(() => {
    // When running locally, always use the same backend
    // The URL prefix is just for visual indication
    return '/api';
  });

  constructor(private http: HttpClient) {
    this.detectUrlEnvironment();
    this.loadEnvironmentInfo();
  }

  /**
   * Detect environment from URL path.
   * Supports: /dev/..., /test/..., or root (prod)
   */
  private detectUrlEnvironment(): void {
    const path = window.location.pathname;

    if (path.startsWith('/dev/') || path === '/dev') {
      this.urlEnvironment.set('dev');
    } else if (path.startsWith('/test/') || path === '/test') {
      this.urlEnvironment.set('test');
    } else {
      this.urlEnvironment.set('prod');
    }
  }

  /**
   * Load environment info from backend.
   */
  private loadEnvironmentInfo(): void {
    this.http.get<EnvironmentInfo>('/api/env').subscribe({
      next: (info) => {
        this.envInfo.set(info);
      },
      error: (err) => {
        console.warn('Could not load environment info:', err);
        // Set default for offline/error case
        this.envInfo.set({
          environment: this.urlEnvironment().toUpperCase() || 'UNKNOWN',
          applicationName: 'Physiokalendar',
          isDevelopment: this.urlEnvironment() === 'dev',
          isTest: this.urlEnvironment() === 'test',
          isProduction: this.urlEnvironment() === 'prod',
          mailEnabled: false,
          seedDataEnabled: false,
          banner: {
            show: this.urlEnvironment() !== 'prod' ? 'true' : 'false',
            text: this.urlEnvironment().toUpperCase(),
            color: this.urlEnvironment() === 'dev' ? '#4caf50' : '#ff9800'
          }
        });
      }
    });
  }

  /**
   * Get the URL prefix for the current environment.
   * Used for routing within the app.
   */
  getUrlPrefix(): string {
    const env = this.urlEnvironment();
    return env === 'prod' ? '' : `/${env}`;
  }

  /**
   * Get banner config for display.
   */
  getBannerConfig() {
    return this.banner();
  }
}
