import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Obrnuto od authGuard: stranice za goste (login, registracija) ne treba da vidi
// neko ko je već prijavljen, pa ga šaljemo na njegove oglase.
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/moji-oglasi']);
};
