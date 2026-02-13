import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { ToastService, Toast } from '../../../core/services/toast.service';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" [class]="'position-top-right'">
      <div
        *ngFor="let toast of toasts$ | async"
        [@toastAnimation]
        [class]="'toast ' + toast.type"
        [style.background-color]="getBackgroundColor(toast.type)"
        [style.border-left-color]="getBorderColor(toast.type)"
      >
        <div class="toast-content">
          <span class="toast-icon">{{ getIcon(toast.type) }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <button
            class="toast-close"
            (click)="onClose(toast.id)"
            type="button"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 9999;
      pointer-events: none;

      &.position-top-right {
        top: 1.5rem;
        right: 1.5rem;
      }
    }

    .toast {
      pointer-events: auto;
      margin-bottom: 1rem;
      padding: 1rem;
      border-radius: 0.375rem;
      border-left: 4px solid;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      background-color: white;
      min-width: 300px;
      max-width: 500px;
      font-size: 0.875rem;
      line-height: 1.5;

      &.success {
        background-color: #E8F5E9;
        border-left-color: #4CAF50;
      }

      &.error {
        background-color: #FFEBEE;
        border-left-color: #EF4444;
      }

      &.warning {
        background-color: #FFF3E0;
        border-left-color: #F59E0B;
      }

      &.info {
        background-color: #E3F2FD;
        border-left-color: #2196F3;
      }
    }

    .toast-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .toast-icon {
      flex-shrink: 0;
      font-weight: bold;
      font-size: 1.25rem;

      .success & {
        color: #4CAF50;
      }

      .error & {
        color: #EF4444;
      }

      .warning & {
        color: #F59E0B;
      }

      .info & {
        color: #2196F3;
      }
    }

    .toast-message {
      flex: 1;
      color: #1F2937;
    }

    .toast-close {
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      color: #6B7280;
      font-size: 1.25rem;
      padding: 0;
      width: 1.5rem;
      height: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s ease;

      &:hover {
        color: #1F2937;
      }
    }
  `],
  animations: [
    trigger('toastAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(500px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateX(500px)' }))
      ])
    ])
  ]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts$!: Observable<Toast[]>;

  private destroy$ = new Subject<void>();

  constructor(private toastService: ToastService) {
    this.toasts$ = this.toastService.toasts$;
  }

  ngOnInit(): void {
    // Toast service handles auto-dismiss
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onClose(id: string): void {
    this.toastService.remove(id);
  }

  getBackgroundColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      success: '#E8F5E9',
      error: '#FFEBEE',
      warning: '#FFF3E0',
      info: '#E3F2FD'
    };
    return colorMap[type] || '#FFFFFF';
  }

  getBorderColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      success: '#4CAF50',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#2196F3'
    };
    return colorMap[type] || '#E5E7EB';
  }

  getIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '•';
    }
  }
}
