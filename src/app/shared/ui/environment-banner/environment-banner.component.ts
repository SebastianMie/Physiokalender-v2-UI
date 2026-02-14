import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EnvironmentService } from '../../../core/services/environment.service';

@Component({
  selector: 'app-environment-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (envService.showBanner()) {
      <div
        class="environment-banner"
        [style.background-color]="envService.banner()?.color || '#ff9800'"
      >
        <span class="banner-text">{{ envService.banner()?.text || envService.environment() }}</span>
        <span class="banner-hint">Umgebung</span>
      </div>
    }
  `,
  styles: [`
    .environment-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: white;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      z-index: 9999;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .banner-text {
      font-weight: 700;
    }

    .banner-hint {
      font-weight: 400;
      opacity: 0.8;
    }
  `]
})
export class EnvironmentBannerComponent {
  readonly envService = inject(EnvironmentService);
}
