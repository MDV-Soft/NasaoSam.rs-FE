import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { finderGuard } from './finder-guard';
import { FinderSessionService } from '../services/finder-session.service';

describe('finderGuard', () => {
  let session: FinderSessionService;

  const run = () =>
    TestBed.runInInjectionContext(() =>
      finderGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    session = TestBed.inject(FinderSessionService);
  });

  it('lets a finder with a valid token through', () => {
    session.save('finder-jwt', new Date(Date.now() + 60 * 60 * 1000).toISOString());

    expect(run()).toBe(true);
  });

  it('sends everybody else to /nalaz', () => {
    const result = run() as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toBe('/nalaz');
  });

  it('sends a finder with an expired token to /nalaz', () => {
    session.save('old-jwt', new Date(Date.now() - 1000).toISOString());

    expect((run() as UrlTree).toString()).toBe('/nalaz');
  });

  it('does not let the owner in just because the owner is logged in', () => {
    localStorage.setItem('api_token', 'owner-jwt');

    expect((run() as UrlTree).toString()).toBe('/nalaz');
    localStorage.clear();
  });
});
