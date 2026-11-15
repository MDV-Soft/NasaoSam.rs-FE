import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

// Putanje koje se zovu BEZ prijave. Tu ne šaljemo token, a 401 znači "pogrešna lozinka",
// pa korisnika ne smemo slati na /login (već je tamo).
const PUBLIC_PATHS: string[] = ['/auth/login', '/auth/register'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Token šaljemo samo našem backendu, nikad nekom tuđem serveru
  const isOurApi: boolean = req.url.startsWith(environment.apiUrl);
  const isPublic: boolean = PUBLIC_PATHS.some((path) => req.url.endsWith(path));

  if (!isOurApi || isPublic) {
    return next(req);
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
