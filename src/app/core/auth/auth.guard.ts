import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  let isAuthenticated = false;

  // Subscribe to check authentication status
  authService.isAuthenticated$.subscribe(authenticated => {
    isAuthenticated = authenticated;
  }).unsubscribe();

  if (isAuthenticated) {
    return true;
  } else {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
};
