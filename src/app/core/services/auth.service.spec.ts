import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('login saves the token and the user', () => {
    service.login('a@b.rs', 'lozinka123').subscribe();

    httpMock
      .expectOne(environment.apiUrl + '/auth/login')
      .flush({ token: 'tok', userId: 7, email: 'a@b.rs', role: 'OWNER' });

    expect(service.getToken()).toBe('tok');
    expect(service.getUser()).toEqual({ id: 7, email: 'a@b.rs', role: 'OWNER' });
    expect(service.isLoggedIn()).toBe(true);
  });

  it('register posts the data and logs the user in', () => {
    service
      .register({ email: 'a@b.rs', password: 'lozinka123', phone: '064 123 4567' })
      .subscribe();

    const req = httpMock.expectOne(environment.apiUrl + '/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'a@b.rs',
      password: 'lozinka123',
      phone: '064 123 4567',
    });

    req.flush({ token: 'novi', userId: 9, email: 'a@b.rs', role: 'OWNER' });

    expect(service.getToken()).toBe('novi');
    expect(service.getUser()).toEqual({ id: 9, email: 'a@b.rs', role: 'OWNER' });
  });

  it('register does not log the user in when the backend refuses', () => {
    service
      .register({ email: 'a@b.rs', password: 'lozinka123', phone: '064 123 4567' })
      .subscribe({ error: () => undefined });

    httpMock
      .expectOne(environment.apiUrl + '/auth/register')
      .flush(
        { status: 409, message: 'Nalog sa ovim mejlov vec postoji' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(service.isLoggedIn()).toBe(false);
  });

  it('logout calls the backend and then clears the session', () => {
    service.saveToken('tok');
    let finished = false;

    service.logout().subscribe(() => (finished = true));

    const req = httpMock.expectOne(environment.apiUrl + '/auth/logout');
    expect(req.request.method).toBe('POST');
    // Dok server ne odgovori, sesija još postoji
    expect(service.getToken()).toBe('tok');

    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(finished).toBe(true);
    expect(service.isLoggedIn()).toBe(false);
  });

  it('logout clears the session even when the backend fails', () => {
    service.saveToken('tok');
    let finished = false;

    service.logout().subscribe(() => (finished = true));

    httpMock
      .expectOne(environment.apiUrl + '/auth/logout')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(finished).toBe(true);
    expect(service.getToken()).toBeNull();
  });

  it('getUser returns null when nothing is stored', () => {
    expect(service.getUser()).toBeNull();
  });
});
