import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MetaService } from './meta.service';
import { ItemOptions } from '../models/item-options.model';
import { environment } from '../../../environments/environment';

describe('MetaService', () => {
  let service: MetaService;
  let httpMock: HttpTestingController;
  const optionsUrl = environment.apiUrl + '/meta/options';

  const sampleOptions: ItemOptions = {
    categories: [
      { value: 'WALLET', label: 'Novčanik' },
      { value: 'OTHER', label: 'Ostalo' },
    ],
    documentTypes: [{ value: 'ID_CARD', label: 'Lična karta' }],
    colors: [{ value: 'BLACK', label: 'Crna' }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(MetaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('sends no request until somebody subscribes', () => {
    service.getOptions();

    httpMock.expectNone(optionsUrl);
  });

  it('loads the options with GET /meta/options', () => {
    let result: ItemOptions | undefined;

    service.getOptions().subscribe((options) => (result = options));

    const req = httpMock.expectOne(optionsUrl);
    expect(req.request.method).toBe('GET');
    req.flush(sampleOptions);

    expect(result).toEqual(sampleOptions);
  });

  it('asks the server only once, even for several subscribers', () => {
    const results: ItemOptions[] = [];

    service.getOptions().subscribe((options) => results.push(options));
    httpMock.expectOne(optionsUrl).flush(sampleOptions);

    // Drugi i treći pretplatnik dobijaju zapamćen odgovor, bez novog zahteva
    service.getOptions().subscribe((options) => results.push(options));
    service.getOptions().subscribe((options) => results.push(options));
    httpMock.expectNone(optionsUrl);

    expect(results.length).toBe(3);
    expect(results[1]).toEqual(sampleOptions);
  });

  it('does not remember a failure: the next call tries again', () => {
    let failed = false;
    service.getOptions().subscribe({ error: () => (failed = true) });
    httpMock.expectOne(optionsUrl).flush({}, { status: 500, statusText: 'Server Error' });
    expect(failed).toBe(true);

    let result: ItemOptions | undefined;
    service.getOptions().subscribe((options) => (result = options));
    httpMock.expectOne(optionsUrl).flush(sampleOptions);

    expect(result).toEqual(sampleOptions);
  });
});
