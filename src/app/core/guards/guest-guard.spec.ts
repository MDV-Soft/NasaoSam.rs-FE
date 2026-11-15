import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { guestGuard } from './guest-guard';
import { AuthService } from '../services/auth.service';

describe('guestGuard', () => {
  let authService: AuthService;
  let router: Router;

  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => guestGuard(...guardParameters));

  const runGuard = () => executeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot);

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('lets a guest through', () => {
    expect(runGuard()).toBe(true);
  });

  it('redirects a logged-in user to /moji-oglasi', () => {
    authService.saveToken('abc123');

    const result = runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/moji-oglasi');
  });
});
