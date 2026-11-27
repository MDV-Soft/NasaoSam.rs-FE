import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LostReportDetail } from './lost-report-detail';
import { ItemOptions } from '../../../core/models/item-options.model';
import { LostMatch } from '../../../core/models/lost-match.model';
import { LostReport, LostReportItem } from '../../../core/models/lost-report.model';
import { environment } from '../../../../environments/environment';

const API = environment.apiUrl;
const REPORT_URL = API + '/lost-reports/7';
const MATCHES_URL = REPORT_URL + '/matches';
const OPTIONS_URL = API + '/meta/options';

const OPTIONS: ItemOptions = {
  categories: [
    { value: 'WALLET', label: 'Novčanik' },
    { value: 'KEYS', label: 'Ključevi' },
    { value: 'DOCUMENT', label: 'Dokument' },
  ],
  documentTypes: [{ value: 'ID_CARD', label: 'Lična karta' }],
  colors: [{ value: 'BLACK', label: 'Crna' }],
};

const item = (values: Partial<LostReportItem>): LostReportItem => ({
  id: 31,
  category: 'WALLET',
  customCategory: null,
  documentType: null,
  color: 'BLACK',
  brand: null,
  material: null,
  description: null,
  distinctiveMarks: null,
  hasNameHash: false,
  hasNameDobHash: false,
  ...values,
});

const report = (values: Partial<LostReport> = {}): LostReport => ({
  id: 7,
  status: 'ACTIVE',
  lostFrom: '2026-11-24T08:00:00Z',
  lostTo: '2026-11-24T10:00:00Z',
  city: 'Niš',
  placeDescription: 'kod autobuske stanice',
  latitude: null,
  longitude: null,
  locationRadiusMeters: null,
  privateDetails: null,
  completenessScore: 60,
  expiresAt: '2027-02-22T10:00:00Z',
  closedAt: null,
  createdAt: '2026-11-24T10:05:00Z',
  updatedAt: '2026-11-24T10:05:00Z',
  items: [item({ id: 31 }), item({ id: 32, category: 'KEYS', color: null })],
  ...values,
});

const match = (id: number, values: Partial<LostMatch> = {}): LostMatch => ({
  matchId: id,
  lostItemId: 31,
  confidence: 'MEDIUM',
  category: 'WALLET',
  customCategory: null,
  documentType: null,
  color: 'BLACK',
  city: 'Niš',
  foundDate: '2026-11-25',
  photoUrl: `/api/lost-reports/7/matches/${id}/photo`,
  ...values,
});

describe('LostReportDetail', () => {
  let fixture: ComponentFixture<LostReportDetail>;
  let component: LostReportDetail;
  let httpMock: HttpTestingController;

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => page().textContent?.replace(/\s+/g, ' ') ?? '';
  const settle = () => fixture.whenStable();
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(page().querySelectorAll('button')).find((b) => b.textContent?.includes(label));
  const click = async (label: string) => {
    button(label)!.click();
    await settle();
  };

  // Slike poklapanja stižu kao blob (svako poklapanje traži svoju)
  const flushPhotos = async () => {
    httpMock
      .match((req) => req.url.endsWith('/photo'))
      .forEach((req) => req.flush(new Blob([new Uint8Array([1])], { type: 'image/jpeg' })));
    await settle();
  };

  /**
   * Otvara stranicu: oglas i liste stižu odmah, a poklapanja (ako se traže) zadate liste.
   * matches = 'wait': poklapanja ostaju bez odgovora.
   */
  const open = async (
    value: LostReport = report(),
    matches: LostMatch[] | 'wait' = [match(12)],
    routeId: string = '7',
  ) => {
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();

    await TestBed.configureTestingModule({
      imports: [LostReportDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: routeId }) } },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LostReportDetail);
    component = fixture.componentInstance;
    await settle();

    if (routeId !== '7') {
      return;
    }
    httpMock.expectOne(OPTIONS_URL).flush(OPTIONS);
    httpMock.expectOne(REPORT_URL).flush(value);
    if (value.status === 'ACTIVE' && matches !== 'wait') {
      httpMock.expectOne(MATCHES_URL).flush(matches);
    }
    await settle();
    await flushPhotos();
  };

  afterEach(() => {
    httpMock.verify();
  });

  describe('with matches', () => {
    it('says how many there are and that the photos are blurred', async () => {
      await open(report(), [match(12), match(13, { confidence: 'LOW' })]);

      expect(text()).toContain('Poklapanja');
      expect(text()).toContain('Za tvoj oglas postoji 2 poklapanja');
      expect(text()).toContain('Fotografije su zamućene');
      expect(page().querySelectorAll('app-match-card').length).toBe(2);
    });

    it('uses the right word for one match', async () => {
      await open(report(), [match(12)]);

      expect(text()).toContain('postoji 1 poklapanje');
    });

    it('shows each match next to the item of the report that it matches', async () => {
      await open(report(), [
        match(12, { lostItemId: 31 }),
        match(13, { lostItemId: 32, category: 'KEYS', color: null }),
        match(14, { lostItemId: 31, confidence: 'LOW' }),
      ]);

      const sections = Array.from(page().querySelectorAll('section.card')).filter((s) =>
        s.querySelector('app-match-card'),
      );
      expect(sections.length).toBe(2);
      expect(sections[0].querySelector('h2')?.textContent).toBe('Novčanik');
      expect(sections[0].querySelectorAll('app-match-card').length).toBe(2);
      expect(sections[1].querySelector('h2')?.textContent).toBe('Ključevi');
      expect(sections[1].querySelectorAll('app-match-card').length).toBe(1);
    });

    it('keeps the order of the server inside an item (the best first)', async () => {
      await open(report(), [
        match(12, { confidence: 'HIGH' }),
        match(13, { confidence: 'MEDIUM' }),
        match(14, { confidence: 'LOW' }),
      ]);

      const labels = Array.from(page().querySelectorAll('.confidence-label')).map((e) =>
        e.textContent?.trim(),
      );
      expect(labels).toEqual(['Veoma verovatno', 'Verovatno', 'Moguće']);
    });

    it('lists the items without matches in one line', async () => {
      await open(report(), [match(12, { lostItemId: 31 })]);

      expect(text()).toContain('Bez poklapanja za sada: Ključevi.');
    });

    it('loads one photo for each match, from the address of the backend', async () => {
      await open(report(), [match(12), match(13)]);

      expect(component.matches()?.length).toBe(2);
      // fotografije su već dostavljene u open(); ovde se samo proverava prikaz
      expect(page().querySelectorAll('.photo img').length).toBe(2);
    });

    it('says that confirming ownership and the contact come later, and has no "Ovo je moj" button', async () => {
      await open();

      expect(text()).toContain('Potvrda da je tvoj i kontakt nalazača stižu uskoro');
      expect(button('Ovo je moj')).toBeUndefined();
      expect(button('Ovo nije moj predmet')).toBeDefined();
    });

    it('does not show any private data of the finder', async () => {
      await open();

      expect(text()).not.toMatch(/telefon|marka|kontrolno pitanje|odgovor/i);
    });
  });

  describe('"Ovo nije moj predmet"', () => {
    it('removes the card, says so, and updates the count', async () => {
      await open(report(), [match(12), match(13)]);

      await click('Ovo nije moj predmet');
      await click('Da, nije moj predmet');
      httpMock
        .expectOne(MATCHES_URL + '/12/dismiss')
        .flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(page().querySelectorAll('app-match-card').length).toBe(1);
      expect(text()).toContain('Poklapanje je uklonjeno');
      expect(text()).toContain('postoji 1 poklapanje');
      // lista se ne učitava ponovo: kartica je samo sklonjena
      httpMock.expectNone(MATCHES_URL);
    });

    it('shows the "no matches" state after the last one is removed', async () => {
      await open(report(), [match(12)]);

      await click('Ovo nije moj predmet');
      await click('Da, nije moj predmet');
      httpMock
        .expectOne(MATCHES_URL + '/12/dismiss')
        .flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(page().querySelectorAll('app-match-card').length).toBe(0);
      expect(text()).toContain('Još nema poklapanja');
      expect(text()).toContain('Za sada nema poklapanja.');
    });
  });

  describe('without matches', () => {
    it('explains that they appear here as soon as somebody finds something, and that there is no email yet', async () => {
      await open(report(), []);

      expect(text()).toContain('Za sada nema poklapanja.');
      expect(text()).toContain('Još nema poklapanja');
      expect(text()).toContain('čim neko pronađe predmet koji liči na tvoj');
      expect(text()).toContain('Obaveštenja na mejl još nema');
      expect(page().querySelector('app-match-card')).toBeNull();
      expect(text()).not.toContain('Potvrda da je tvoj');
    });
  });

  describe('where the matches are searched', () => {
    const point = { latitude: 43.3209, longitude: 21.8958 };

    it('says the circle and the radius in the empty state, so the owner knows why nothing is shown', async () => {
      await open(report({ ...point, locationRadiusMeters: 300 }), []);

      expect(page().querySelector('.area')?.textContent).toContain(
        'Tražimo nalaze u krugu od 300 m oko tačke koju si označio.',
      );
    });

    it('says 5 km when the report has a point but no radius (as the backend does)', async () => {
      await open(report({ ...point, locationRadiusMeters: null }), []);

      expect(page().querySelector('.area')?.textContent).toContain('u krugu od 5 km');
    });

    it('says "anywhere in the city" when the report has no point', async () => {
      await open(report(), []);

      expect(page().querySelector('.area')?.textContent).toContain(
        'bilo gde u mestu Niš (oglas nema tačku na mapi)',
      );
    });

    it('shows the same in the table of the report, starting with a capital letter', async () => {
      await open(report({ ...point, locationRadiusMeters: 1000 }), [match(12)]);

      expect(page().querySelector('.search-area')?.textContent).toBe(
        'U krugu od 1 km oko tačke koju si označio',
      );
    });

    it('does not show the row for a report that is not active (nothing is searched)', async () => {
      await open(report({ status: 'CLOSED', closedAt: '2026-11-25T09:00:00Z' }));

      expect(page().querySelector('.search-area')).toBeNull();
    });
  });

  describe('"Proveri ponovo"', () => {
    it('asks the server again and shows the new matches', async () => {
      await open(report(), []);
      expect(page().querySelector('app-match-card')).toBeNull();

      await click('Proveri ponovo');
      httpMock.expectOne(MATCHES_URL).flush([match(15)]);
      await settle();
      await flushPhotos();

      expect(page().querySelectorAll('app-match-card').length).toBe(1);
      expect(text()).toContain('postoji 1 poklapanje');
    });

    it('is disabled while it works, so a double click sends one request', async () => {
      await open(report(), []);

      await click('Proveri ponovo');
      expect(button('Proveravam...')?.disabled).toBe(true);
      component.loadMatches();

      expect(httpMock.match(MATCHES_URL).length).toBe(1);
    });

    it('hides the "removed" notice, because it is about the old list', async () => {
      await open(report(), [match(12), match(13)]);
      await click('Ovo nije moj predmet');
      await click('Da, nije moj predmet');
      httpMock
        .expectOne(MATCHES_URL + '/12/dismiss')
        .flush(null, { status: 204, statusText: 'No Content' });
      await settle();
      expect(text()).toContain('Poklapanje je uklonjeno');

      await click('Proveri ponovo');
      httpMock.expectOne(MATCHES_URL).flush([match(13)]);
      await settle();
      await flushPhotos();

      expect(text()).not.toContain('Poklapanje je uklonjeno');
    });
  });

  describe('when matches cannot be loaded', () => {
    it('shows what the server said and lets the user try again', async () => {
      await open(report(), 'wait');
      httpMock
        .expectOne(MATCHES_URL)
        .flush(
          { status: 500, message: 'Došlo je do greške na serveru' },
          { status: 500, statusText: 'Error' },
        );
      await settle();

      expect(text()).toContain('Došlo je do greške na serveru');
      expect(page().querySelector('app-match-card')).toBeNull();

      await click('Pokušaj ponovo');
      httpMock.expectOne(MATCHES_URL).flush([match(12)]);
      await settle();
      await flushPhotos();

      expect(page().querySelectorAll('app-match-card').length).toBe(1);
      expect(text()).not.toContain('Došlo je do greške');
    });

    it('says the server cannot be reached', async () => {
      await open(report(), 'wait');
      httpMock.expectOne(MATCHES_URL).error(new ProgressEvent('error'));
      await settle();

      expect(text()).toContain('Server nije dostupan');
    });
  });

  describe('the report itself', () => {
    it('shows where, when, the status and the items, with names from the server', async () => {
      await open();

      expect(text()).toContain('Niš, kod autobuske stanice');
      expect(text()).toMatch(/24\.11\.2026\. \d{2}:\d{2} – 24\.11\.2026\. \d{2}:\d{2}/);
      expect(text()).toContain('Aktivan');
      expect(text()).toContain('Novčanik, Ključevi');
    });

    it('goes back to the list of reports', async () => {
      await open();

      const link = page().querySelector('.home-link');
      expect(link?.textContent?.trim()).toBe('← Moji oglasi');
      expect(link?.getAttribute('href')).toBe('/moji-oglasi');
    });
  });

  describe('a report that is not active', () => {
    it('does not ask for matches and says why', async () => {
      await open(report({ status: 'CLOSED', closedAt: '2026-11-25T09:00:00Z' }));

      httpMock.expectNone(MATCHES_URL);
      expect(text()).toContain('Oglas više nije aktivan (zatvoren), pa se poklapanja ne traže.');
      expect(button('Proveri ponovo')).toBeUndefined();
    });
  });

  describe('when the report cannot be shown', () => {
    it('says "not found" for a bad address, without calling the server', async () => {
      await open(report(), [], 'abc');

      httpMock.expectNone(REPORT_URL);
      expect(text()).toContain('Oglas nije pronađen');
      expect(page().querySelector('a[href="/moji-oglasi"]')).not.toBeNull();
    });

    it('says "not found" when the report is not the owner\'s (the backend answers 404 in the body)', async () => {
      await TestBed.configureTestingModule({
        imports: [LostReportDetail],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } },
          },
        ],
      }).compileComponents();
      httpMock = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(LostReportDetail);
      await settle();

      httpMock.expectOne(OPTIONS_URL).flush(OPTIONS);
      httpMock
        .expectOne(REPORT_URL)
        .flush(
          { status: 404, message: 'Oglas nije pronađen' },
          { status: 400, statusText: 'Bad Request' },
        );
      await settle();

      expect(text()).toContain('Oglas nije pronađen');
      httpMock.expectNone(MATCHES_URL);
    });

    it('shows an error and lets the user try again', async () => {
      await TestBed.configureTestingModule({
        imports: [LostReportDetail],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } },
          },
        ],
      }).compileComponents();
      httpMock = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(LostReportDetail);
      component = fixture.componentInstance;
      await settle();

      httpMock.expectOne(OPTIONS_URL).flush(OPTIONS);
      httpMock.expectOne(REPORT_URL).error(new ProgressEvent('error'));
      await settle();
      expect(text()).toContain('Oglas nije učitan');
      expect(text()).toContain('Server nije dostupan');

      await click('Pokušaj ponovo');
      httpMock.expectOne(REPORT_URL).flush(report());
      httpMock.expectOne(MATCHES_URL).flush([]);
      await settle();

      expect(text()).toContain('Tvoj oglas');
    });
  });

  it('still works when the lists with names cannot be loaded (technical values are shown)', async () => {
    await TestBed.configureTestingModule({
      imports: [LostReportDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } },
        },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LostReportDetail);
    await settle();

    httpMock.expectOne(OPTIONS_URL).flush({}, { status: 500, statusText: 'Server Error' });
    httpMock.expectOne(REPORT_URL).flush(report());
    httpMock.expectOne(MATCHES_URL).flush([]);
    await settle();

    expect(text()).toContain('WALLET, KEYS');
  });
});
