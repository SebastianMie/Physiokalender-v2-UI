import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$ = this.toastSubject.asObservable();
  private idCounter = 0;

  constructor() {}

  show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 5000) {
    const id = `toast-${++this.idCounter}`;
    const toast: Toast = { id, message, type, duration };

    const current = this.toastSubject.value;
    this.toastSubject.next([...current, toast]);

    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  success(message: string, duration = 5000) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = 8000) {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration = 6000) {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration = 5000) {
    this.show(message, 'info', duration);
  }

  remove(id: string) {
    const current = this.toastSubject.value;
    this.toastSubject.next(current.filter((t) => t.id !== id));
  }
}
