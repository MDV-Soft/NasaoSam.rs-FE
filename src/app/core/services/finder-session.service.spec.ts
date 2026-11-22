import { TestBed } from '@angular/core/testing';
import { FinderSessionService } from './finder-session.service';

const inMinutes = (minutes: number): string =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString();

describe('FinderSessionService', () => {
  let service: FinderSessionService;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    service = TestBed.inject(FinderSessionService);
  });

  it('has no session at first', () => {
    expect(service.getToken()).toBeNull();
    expect(service.getExpiresAt()).toBeNull();
    expect(service.isActive()).toBe(false);
  });

  it('keeps the token and the expiry', () => {
    const expiresAt = inMinutes(120);
    service.save('finder-jwt', expiresAt);

    expect(service.getToken()).toBe('finder-jwt');
    expect(service.getExpiresAt()?.toISOString()).toBe(expiresAt);
    expect(service.isActive()).toBe(true);
  });

  it('forgets an expired token and clears it', () => {
    service.save('old-jwt', inMinutes(-1));

    expect(service.getToken()).toBeNull();
    expect(service.isActive()).toBe(false);
    expect(sessionStorage.getItem('finder_token')).toBeNull();
  });

  it('clears the session', () => {
    service.save('finder-jwt', inMinutes(120));
    service.clear();

    expect(service.getToken()).toBeNull();
    expect(service.getExpiresAt()).toBeNull();
  });

  it('ignores an unreadable expiry (the server decides then)', () => {
    sessionStorage.setItem('finder_token', 'finder-jwt');
    sessionStorage.setItem('finder_expires_at', 'nije datum');

    expect(service.getExpiresAt()).toBeNull();
    expect(service.getToken()).toBe('finder-jwt');
  });

  it('lives in sessionStorage only, separate from the owner session (localStorage)', () => {
    localStorage.setItem('api_token', 'owner-jwt');
    service.save('finder-jwt', inMinutes(120));

    expect(localStorage.getItem('finder_token')).toBeNull();
    expect(sessionStorage.getItem('api_token')).toBeNull();
    service.clear();
    expect(localStorage.getItem('api_token')).toBe('owner-jwt');
  });
});
