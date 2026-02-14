import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { map, take } from 'rxjs/operators';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.user$.pipe(
    take(1),
    map((user) => {
      const allowedRoles = ['ADMIN', 'RECEPTION'];
      if (user && allowedRoles.includes(user.role)) {
        return true;
      }
      router.navigate(['/dashboard']);
      return false;
    })
  );
};
