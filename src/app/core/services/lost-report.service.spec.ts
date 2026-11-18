import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LostReportService } from './lost-report.service';
import { CreateLostReportRequest, LostReport } from '../models/lost-report.model';
import { environment } from '../../../environments/environment';

describe('LostReportService', () => {
  let service: LostReportService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl + '/lost-reports';

  const request: CreateLostReportRequest = {
    lostFrom: '2026-11-14T08:00:00.000Z',
    lostTo: '2026-11-14T10:00:00.000Z',
    city: 'Beograd',
    items: [
      {
        category: 'WALLET',
        color: 'BLACK',
        description: 'Crni kožni novčanik sa iskrzanim ćoškom i crvenim koncem na šavu.',
      },
    ],
  };

  const savedReport: LostReport = {
    id: 12,
    status: 'ACTIVE',
    lostFrom: request.lostFrom,
    lostTo: request.lostTo,
    city: 'Beograd',
    placeDescription: null,
    latitude: null,
    longitude: null,
    locationRadiusMeters: null,
    privateDetails: null,
    completenessScore: 55,
    expiresAt: '2027-02-12T10:00:00Z',
    closedAt: null,
    createdAt: '2026-11-14T10:05:00Z',
    updatedAt: '2026-11-14T10:05:00Z',
    items: [
      {
        id: 30,
        category: 'WALLET',
        customCategory: null,
        documentType: null,
        color: 'BLACK',
        brand: null,
        material: null,
        description: 'Crni kožni novčanik sa iskrzanim ćoškom i crvenim koncem na šavu.',
        distinctiveMarks: null,
        hasNameHash: false,
        hasNameDobHash: false,
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(LostReportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('create: POSTs the request to /lost-reports and returns the saved report', () => {
    let result: LostReport | undefined;

    service.create(request).subscribe((report) => (result = report));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(savedReport, { status: 201, statusText: 'Created' });

    expect(result).toEqual(savedReport);
  });

  it('getMine: GETs /lost-reports', () => {
    let result: LostReport[] | undefined;

    service.getMine().subscribe((reports) => (result = reports));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([savedReport]);

    expect(result).toEqual([savedReport]);
  });

  it('getById: GETs /lost-reports/{id}', () => {
    let result: LostReport | undefined;

    service.getById(12).subscribe((report) => (result = report));

    const req = httpMock.expectOne(baseUrl + '/12');
    expect(req.request.method).toBe('GET');
    req.flush(savedReport);

    expect(result?.id).toBe(12);
  });

  it('update: PUTs the whole report to /lost-reports/{id}', () => {
    const changed: CreateLostReportRequest = {
      ...request,
      city: 'Novi Sad',
      items: [{ ...request.items[0], id: 30 }],
    };
    let result: LostReport | undefined;

    service.update(12, changed).subscribe((report) => (result = report));

    const req = httpMock.expectOne(baseUrl + '/12');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(changed);
    req.flush({ ...savedReport, city: 'Novi Sad' });

    expect(result?.city).toBe('Novi Sad');
  });

  it('close: POSTs to /lost-reports/{id}/close with no data', () => {
    let result: LostReport | undefined;

    service.close(12).subscribe((report) => (result = report));

    const req = httpMock.expectOne(baseUrl + '/12/close');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ...savedReport, status: 'CLOSED', closedAt: '2026-11-15T09:00:00Z' });

    expect(result?.status).toBe('CLOSED');
    expect(result?.closedAt).not.toBeNull();
  });

  it('passes the backend error on to the caller untouched', () => {
    let received: HttpErrorResponse | undefined;

    service.close(12).subscribe({ error: (error: HttpErrorResponse) => (received = error) });

    httpMock
      .expectOne(baseUrl + '/12/close')
      .flush(
        { status: 409, message: 'Oglas je već zatvoren', fieldErrors: {} },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(received?.error.message).toBe('Oglas je već zatvoren');
    expect(received?.error.status).toBe(409);
  });

  it('does not put an owner id anywhere in the URL (the backend reads it from the token)', () => {
    service.getMine().subscribe();
    service.create(request).subscribe();

    const requests = httpMock.match(() => true);
    requests.forEach((req) => {
      expect(req.request.url).toBe(baseUrl);
      req.flush([]);
    });
  });
});
