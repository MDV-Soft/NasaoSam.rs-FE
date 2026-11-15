import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Pušta dalje samo prijavljenog korisnika. Ostale šalje na /login.
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // Umesto navigate() vraća se UrlTree: ruter sam preusmeri i nema duple navigacije
  return router.createUrlTree(['/login']);
};
