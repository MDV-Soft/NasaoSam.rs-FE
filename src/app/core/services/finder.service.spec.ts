import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FinderService } from './finder.service';
import { FinderSessionService } from './finder-session.service';
import { environment } from '../../../environments/environment';

const URL = environment.apiUrl + '/finder';

describe('FinderService', () => {
  let service: FinderService;
  let httpMock: HttpTestingController;
  let session: FinderSessionService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FinderService);
    session = TestBed.inject(FinderSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('exchanges the token from the link for a finder token and keeps it in the session', () => {
    const expiresAt = new Date(Date.now() + 120 * 60 * 1000).toISOString();
    let result: unknown;
    service.openLink('tajni-token').subscribe((access) => (result = access));

    const req = httpMock.expectOne(URL + '/access');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tajni-token' });
    req.flush({ accessToken: 'finder-jwt', expiresAt });

    expect(result).toEqual({ accessToken: 'finder-jwt', expiresAt });
    expect(session.getToken()).toBe('finder-jwt');
    expect(session.getExpiresAt()?.toISOString()).toBe(expiresAt);
  });

  it('does not touch the session when the link is refused', () => {
    service.openLink('los-token').subscribe({ error: () => undefined });

    httpMock
      .expectOne(URL + '/access')
      .flush(
        { status: 400, message: 'Link nije ispravan ili je istekao' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(session.getToken()).toBeNull();
  });

  it('loads the report with GET', () => {
    service.getReport().subscribe();

    const req = httpMock.expectOne(URL + '/report');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('loads the photo as a blob', () => {
    let blob: Blob | undefined;
    service.getPhoto().subscribe((result) => (blob = result));

    const req = httpMock.expectOne(URL + '/report/photo');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));

    expect(blob?.size).toBe(3);
  });

  it('replaces the items with the whole new list', () => {
    service.updateItems([{ category: 'KEYS', color: 'BLACK' }]).subscribe();

    const req = httpMock.expectOne(URL + '/report/items');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ items: [{ category: 'KEYS', color: 'BLACK' }] });
    req.flush({});
  });

  it('changes where the item is', () => {
    service
      .updateItemLocation({ itemLocation: 'AT_POLICE', handoverInfo: 'PS Vračar' })
      .subscribe();

    const req = httpMock.expectOne(URL + '/report/item-location');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ itemLocation: 'AT_POLICE', handoverInfo: 'PS Vračar' });
    req.flush({});
  });

  it('confirms and withdraws with an empty body', () => {
    service.confirm().subscribe();
    service.withdraw().subscribe();

    const confirm = httpMock.expectOne(URL + '/report/confirm');
    const withdraw = httpMock.expectOne(URL + '/report/withdraw');
    expect(confirm.request.method).toBe('POST');
    expect(withdraw.request.method).toBe('POST');
    expect(confirm.request.body).toEqual({});
    expect(withdraw.request.body).toEqual({});
    confirm.flush({});
    withdraw.flush({});
  });

  it('never sends an id of the report (the backend reads it from the token)', () => {
    service.getReport().subscribe();
    service.confirm().subscribe();

    const urls = [httpMock.expectOne(URL + '/report'), httpMock.expectOne(URL + '/report/confirm')];
    urls.forEach((req) => expect(req.request.urlWithParams).not.toMatch(/\/\d+/));
    urls.forEach((req) => req.flush({}));
  });
});
