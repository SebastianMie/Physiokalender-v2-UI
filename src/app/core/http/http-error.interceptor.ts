import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { catchError, throwError } from 'rxjs';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 Unauthorized
      if (error.status === 401) {
        localStorage.removeItem('token');
        router.navigate(['/login']);
        toastService.error('Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
        return throwError(() => error);
      }

      // 403 Forbidden
      if (error.status === 403) {
        toastService.error('Sie haben keine Berechtigung für diese Aktion.');
        return throwError(() => error);
      }

      // 409 Conflict
      if (error.status === 409) {
        const conflicts = error.error?.extensions?.conflicts || [];
        const conflictMsg =
          conflicts.length > 0
            ? `Konflikt: ${conflicts.map((c: any) => c.reason).join(', ')}`
            : 'Termin-Konflikt erkannt.';
        toastService.error(conflictMsg);
        return throwError(() => error);
      }

      // 400 Bad Request / Validation
      if (error.status === 400) {
        const detail = error.error?.detail || 'Validierungsfehler';
        const invalidParams = error.error?.invalidParams || [];

        if (invalidParams.length > 0) {
          invalidParams.forEach((param: any) => {
            toastService.error(`${param.name}: ${param.reason}`);
          });
        } else {
          toastService.error(detail);
        }
        return throwError(() => error);
      }

      // 5xx Server Error
      if (error.status >= 500) {
        toastService.error(
          'Serverfehler aufgetreten. Bitte versuchen Sie es später erneut.'
        );
        console.error('[Server Error]', error);
        return throwError(() => error);
      }

      // Generic
      const msg = error.error?.message || error.message || 'Ein Fehler ist aufgetreten.';
      toastService.error(msg);
      return throwError(() => error);
    })
  );
};
