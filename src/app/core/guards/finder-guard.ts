import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FinderSessionService } from '../services/finder-session.service';

// Pušta dalje samo nalazača sa važećim privremenim tokenom (dobija se otvaranjem linka iz mejla).
// Ostale šalje na /nalaz, gde se objašnjava šta da urade.
export const finderGuard: CanActivateFn = () => {
  const session = inject(FinderSessionService);
  const router = inject(Router);

  if (session.isActive()) {
    return true;
  }

  return router.createUrlTree(['/nalaz']);
};
