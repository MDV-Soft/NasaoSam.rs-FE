import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { FinderSessionService } from '../services/finder-session.service';

// Putanje koje se zovu BEZ prijave. Tu ne šaljemo token, a 401 znači "pogrešna lozinka",
// pa korisnika ne smemo slati na /login (već je tamo).
// Prijava nalaza i otvaranje linka nalazača su javni: backend odbija i neispravan token
// (npr. istekao token vlasnika iz istog browsera) čak i na javnim rutama.
const PUBLIC_PATHS: string[] = [
  '/auth/login',
  '/auth/register',
  '/found-reports',
  '/finder/access',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const finderSession = inject(FinderSessionService);
  const router = inject(Router);

  // Token šaljemo samo našem backendu, nikad nekom tuđem serveru
  const isOurApi: boolean = req.url.startsWith(environment.apiUrl);
  const isPublic: boolean = PUBLIC_PATHS.some((path) => req.url.endsWith(path));

  if (!isOurApi || isPublic) {
    return next(req);
  }

  // Nalazač ima svoj token (iz linka u mejlu), a ne vlasnikov. Vlasnikov token se tamo ne šalje
  // (backend bi odbio ulogu), a istekao nalazačev token ne odjavljuje vlasnika.
  if (req.url.startsWith(environment.apiUrl + '/finder/')) {
    const finderToken: string | null = finderSession.getToken();
    const finderRequest = finderToken
      ? req.clone({ setHeaders: { Authorization: 'Bearer ' + finderToken } })
      : req;

    return next(finderRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // 401 = privremeni token je istekao (traje 2 sata): nalazač mora ponovo da otvori link
        if (error.status === 401) {
          finderSession.clear();
          router.navigate(['/nalaz']);
        }
        return throwError(() => error);
      }),
    );
  }

  const token: string | null = authService.getToken();

  // Zahtevi su nepromenljivi, zato se pravi kopija sa dodatim zaglavljem
  const authorizedRequest = token
    ? req.clone({ setHeaders: { Authorization: 'Bearer ' + token } })
    : req;

  return next(authorizedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 = token istekao ili je poništen: brišemo sesiju i vodimo na prijavu
      if (error.status === 401) {
        authService.clearSession();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
