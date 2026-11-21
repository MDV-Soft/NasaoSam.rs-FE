import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth-interceptor';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('adds the Bearer token to requests to our API', () => {
    authService.saveToken('abc123');

    http.get(environment.apiUrl + '/lost-reports').subscribe();

    const req = httpMock.expectOne(environment.apiUrl + '/lost-reports');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush([]);
  });

  it('sends no Authorization header when there is no token', () => {
    http.get(environment.apiUrl + '/lost-reports').subscribe();

    const req = httpMock.expectOne(environment.apiUrl + '/lost-reports');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('does not add the token to the login request', () => {
    authService.saveToken('abc123');

    http.post(environment.apiUrl + '/auth/login', {}).subscribe();

    const req = httpMock.expectOne(environment.apiUrl + '/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not add the token to the public finder routes (found report and link opening)', () => {
    // Istekao token vlasnika iz istog browsera ne sme da obori javnu prijavu nalaza
    authService.saveToken('expired-owner-token');

    http.post(environment.apiUrl + '/found-reports', new FormData()).subscribe();
    http.post(environment.apiUrl + '/finder/access', { token: 'x' }).subscribe();

    const found = httpMock.expectOne(environment.apiUrl + '/found-reports');
    const access = httpMock.expectOne(environment.apiUrl + '/finder/access');
    expect(found.request.headers.has('Authorization')).toBe(false);
    expect(access.request.headers.has('Authorization')).toBe(false);
    found.flush({});
    access.flush({});
  });

  it('keeps the owner logged in when a public finder route returns 401', () => {
    authService.saveToken('abc123');

    http.post(environment.apiUrl + '/found-reports', new FormData()).subscribe({
      error: () => undefined,
    });
    httpMock
      .expectOne(environment.apiUrl + '/found-reports')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authService.getToken()).toBe('abc123');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not send the token to a foreign server', () => {
    authService.saveToken('abc123');

    http.get('https://example.com/data').subscribe();

    const req = httpMock.expectOne('https://example.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('clears the session and goes to /login on 401', () => {
    authService.saveToken('expired');

    http.get(environment.apiUrl + '/lost-reports').subscribe({ error: () => undefined });

    httpMock
      .expectOne(environment.apiUrl + '/lost-reports')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authService.getToken()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not redirect when login itself returns 401', () => {
    http.post(environment.apiUrl + '/auth/login', {}).subscribe({ error: () => undefined });

    httpMock
      .expectOne(environment.apiUrl + '/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('passes other errors through without logging out', () => {
    authService.saveToken('abc123');

    http.get(environment.apiUrl + '/lost-reports').subscribe({ error: () => undefined });

    httpMock
      .expectOne(environment.apiUrl + '/lost-reports')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(authService.getToken()).toBe('abc123');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
