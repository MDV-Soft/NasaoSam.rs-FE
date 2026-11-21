import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FoundReportService } from './found-report.service';
import { CreateFoundReportRequest } from '../models/found-report.model';
import { environment } from '../../../environments/environment';

const URL = environment.apiUrl + '/found-reports';

const REQUEST: CreateFoundReportRequest = {
  finderEmail: 'nalazac@test.rs',
  foundAt: '2026-11-20T10:30:00.000Z',
  city: 'Beograd',
  latitude: 44.8125,
  longitude: 20.4612,
  itemLocation: 'WITH_FINDER',
  controlQuestion: 'Šta piše na privesku?',
  controlAnswer: 'Mića',
  items: [{ category: 'KEYS', color: 'BLACK' }],
};

describe('FoundReportService', () => {
  let service: FoundReportService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FoundReportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts multipart: the report as an application/json part and the photo as a file', async () => {
    const photo = new File([new Uint8Array([1, 2, 3])], 'kljucevi.jpg', { type: 'image/jpeg' });

    service.create(REQUEST, photo).subscribe();

    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('POST');

    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);

    const report = body.get('report') as Blob;
    expect(report.type).toBe('application/json');
    expect(JSON.parse(await report.text())).toEqual(REQUEST);

    const sentPhoto = body.get('photo') as File;
    expect(sentPhoto.name).toBe('kljucevi.jpg');
    expect(sentPhoto.type).toBe('image/jpeg');
    expect(sentPhoto.size).toBe(3);

    req.flush({ message: 'ok', linkExpiresAt: '2026-11-21T10:30:00Z' });
  });

  it('does not set Content-Type by hand (the browser adds the multipart boundary)', () => {
    service
      .create(REQUEST, new File([new Uint8Array(1)], 'a.jpg', { type: 'image/jpeg' }))
      .subscribe();

    const req = httpMock.expectOne(URL);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush({});
  });

  it('returns the answer of the server', () => {
    let result: unknown;
    service
      .create(REQUEST, new File([new Uint8Array(1)], 'a.jpg', { type: 'image/jpeg' }))
      .subscribe((response) => (result = response));

    httpMock
      .expectOne(URL)
      .flush(
        { message: 'Nalaz je primljen.', linkExpiresAt: '2026-11-21T10:30:00Z' },
        { status: 201, statusText: 'Created' },
      );

    expect(result).toEqual({
      message: 'Nalaz je primljen.',
      linkExpiresAt: '2026-11-21T10:30:00Z',
    });
  });

  it('passes errors on to the component', () => {
    let status = 0;
    service
      .create(REQUEST, new File([new Uint8Array(1)], 'a.jpg', { type: 'image/jpeg' }))
      .subscribe({ error: (error) => (status = error.status) });

    httpMock.expectOne(URL).flush({}, { status: 400, statusText: 'Bad Request' });

    expect(status).toBe(400);
  });
});
