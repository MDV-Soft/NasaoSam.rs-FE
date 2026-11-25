import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LostReportList } from './lost-report-list';
import { AuthService } from '../../../core/services/auth.service';
import { ItemOptions } from '../../../core/models/item-options.model';
import { LostMatch } from '../../../core/models/lost-match.model';
import { LostReport, LostReportItem } from '../../../core/models/lost-report.model';
import { environment } from '../../../../environments/environment';

const LIST_URL = environment.apiUrl + '/lost-reports';
const OPTIONS_URL = environment.apiUrl + '/meta/options';
const LOGOUT_URL = environment.apiUrl + '/auth/logout';

const OPTIONS: ItemOptions = {
  categories: [
    { value: 'WALLET', label: 'Novčanik' },
    { value: 'DOCUMENT', label: 'Dokument' },
    { value: 'OTHER', label: 'Ostalo' },
  ],
  documentTypes: [{ value: 'ID_CARD', label: 'Lična karta' }],
  colors: [{ value: 'BLACK', label: 'Crna' }],
};

const item = (values: Partial<LostReportItem>): LostReportItem => ({
  id: 1,
  category: 'WALLET',
  customCategory: null,
  documentType: null,
  color: null,
  brand: null,
  material: null,
  description: null,
  distinctiveMarks: null,
  hasNameHash: false,
  hasNameDobHash: false,
  ...values,
});

const report = (values: Partial<LostReport>): LostReport => ({
  id: 1,
  status: 'ACTIVE',
  lostFrom: '2026-11-14T08:00:00Z',
  lostTo: '2026-11-14T10:00:00Z',
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
  items: [item({ id: 10, category: 'WALLET', color: 'BLACK', brand: 'Fossil' })],
  ...values,
});

const ACTIVE = report({
  id: 1,
  city: 'Beograd',
  placeDescription: 'autobus 26',
  items: [
    item({
      id: 10,
      category: 'WALLET',
      color: 'BLACK',
      brand: 'Fossil',
      description: 'Crni novčanik',
    }),
    item({ id: 11, category: 'DOCUMENT', documentType: 'ID_CARD', hasNameHash: true }),
    item({ id: 12, category: 'OTHER', customCategory: 'Kišobran' }),
  ],
});
const CLOSED = report({
  id: 2,
  status: 'CLOSED',
  city: 'Novi Sad',
  closedAt: '2026-11-15T09:00:00Z',
  completenessScore: 80,
});
const RETURNED = report({
  id: 3,
  status: 'RETURNED',
  city: 'Niš',
  closedAt: '2026-11-16T09:00:00Z',
});
const EXPIRED = report({
  id: 4,
  status: 'EXPIRED',
  city: 'Kragujevac',
  closedAt: '2026-11-17T09:00:00Z',
});

const lostMatch = (id: number, values: Partial<LostMatch> = {}): LostMatch => ({
  matchId: id,
  lostItemId: 10,
  confidence: 'MEDIUM',
  category: 'WALLET',
  customCategory: null,
  documentType: null,
  color: 'BLACK',
  city: 'Niš',
  foundDate: '2026-11-25',
  photoUrl: `/api/lost-reports/1/matches/${id}/photo`,
  ...values,
});

describe('LostReportList', () => {
  let fixture: ComponentFixture<LostReportList>;
  let component: LostReportList;
  let httpMock: HttpTestingController;
  let router: Router;

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;
  // Tekst stranice sa sabijenim razmacima i prelomima redova
  const text = (): string => (page().textContent ?? '').replace(/\s+/g, ' ');
  const cards = (): HTMLElement[] => Array.from(page().querySelectorAll('.report-card'));
  const buttonByText = (label: string): HTMLButtonElement =>
    Array.from(page().querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label),
    ) as HTMLButtonElement;

  // Poklapanja se traže samo za AKTIVNE oglase: odgovara na te zahteve ('fail' = server greši,
  // 'wait' = ne odgovara). Oglasi bez zadatih poklapanja imaju prazna.
  type MatchAnswers = Record<number, LostMatch[] | 'fail' | 'wait'>;
  const answerMatches = async (reports: LostReport[], answers: MatchAnswers = {}) => {
    reports
      .filter((r) => r.status === 'ACTIVE')
      .forEach((r) => {
        const req = httpMock.expectOne(LIST_URL + '/' + r.id + '/matches');
        const answer = answers[r.id] ?? [];
        if (answer === 'fail') {
          req.flush({}, { status: 500, statusText: 'Server Error' });
        } else if (answer !== 'wait') {
          req.flush(answer);
        }
      });
    await fixture.whenStable();
  };

  // Otvara stranicu i odgovara na zahteve koje ona šalje pri otvaranju (liste, oglasi, poklapanja).
  // reports = null: ne odgovara (stranica ostaje u stanju "učitavanje").
  const open = async (
    reports: LostReport[] | null = [ACTIVE, CLOSED, RETURNED, EXPIRED],
    options: ItemOptions | 'fail' = OPTIONS,
    matches: MatchAnswers = {},
  ) => {
    fixture = TestBed.createComponent(LostReportList);
    component = fixture.componentInstance;

    if (options === 'fail') {
      httpMock.expectOne(OPTIONS_URL).flush({}, { status: 500, statusText: 'Server Error' });
    } else {
      httpMock.expectOne(OPTIONS_URL).flush(options);
    }
    if (reports !== null) {
      httpMock.expectOne(LIST_URL).flush(reports);
      await answerMatches(reports, matches);
    }
    await fixture.whenStable();
  };

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [LostReportList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    TestBed.inject(AuthService).saveToken('tok');
    TestBed.inject(AuthService).saveUser({ id: 1, email: 'ana@primer.rs', role: 'OWNER' });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', async () => {
    await open();

    expect(component).toBeTruthy();
    expect(text()).toContain('ana@primer.rs');
  });

  describe('loading', () => {
    it('shows "loading" until the reports arrive', async () => {
      await open(null);
      expect(text()).toContain('Učitavanje oglasa...');

      httpMock.expectOne(LIST_URL).flush([ACTIVE]);
      await answerMatches([ACTIVE]);

      expect(text()).not.toContain('Učitavanje oglasa...');
      expect(cards().length).toBe(1);
    });

    it('shows a friendly message when there are no reports', async () => {
      await open([]);

      expect(cards().length).toBe(0);
      expect(text()).toContain('Još nemaš nijedan oglas.');
    });

    it('shows an error and lets the user try again', async () => {
      await open(null);
      httpMock.expectOne(LIST_URL).flush({}, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();
      expect(text()).toContain('Oglasi nisu učitani.');

      buttonByText('Pokušaj ponovo').click();
      httpMock.expectOne(LIST_URL).flush([ACTIVE]);
      await answerMatches([ACTIVE]);

      expect(cards().length).toBe(1);
      expect(text()).not.toContain('Oglasi nisu učitani.');
    });
  });

  describe('the cards', () => {
    it('shows one card per report with the city and the status', async () => {
      await open();

      expect(cards().length).toBe(4);
      expect(cards()[0].textContent).toContain('Beograd');
      expect(cards()[0].textContent).toContain('Aktivan');
      expect(cards()[1].textContent).toContain('Novi Sad');
      expect(cards()[1].textContent).toContain('Zatvoren');
      expect(cards()[2].textContent).toContain('Vraćen');
      expect(cards()[3].textContent).toContain('Istekao');
    });

    it('gives each status its own style', async () => {
      await open();

      const classes = Array.from(page().querySelectorAll('.status')).map((s) => s.className);
      expect(classes).toEqual([
        'status status-active',
        'status status-closed',
        'status status-returned',
        'status status-expired',
      ]);
    });

    it('shows the period and the place', async () => {
      await open([ACTIVE]);

      expect(text()).toMatch(
        /Izgubljeno: \d{2}\.\d{2}\.\d{4}\. \d{2}:\d{2} – \d{2}\.\d{2}\.\d{4}\. \d{2}:\d{2}/,
      );
      expect(text()).toContain('Mesto: autobus 26');
    });

    it('shows the items with names from the server lists', async () => {
      await open([ACTIVE]);

      const items = Array.from(cards()[0].querySelectorAll('.items li')).map((li) =>
        (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
      expect(items[0]).toContain('Novčanik');
      expect(items[0]).toContain('Crna'); // boja
      expect(items[0]).toContain('Fossil'); // marka
      expect(items[0]).toContain('Crni novčanik'); // opis
      expect(items[1]).toContain('Dokument: Lična karta');
      expect(items[1]).toContain('ime je zaštićeno šifrom');
      expect(items[2]).toContain('Kišobran'); // naziv koji je vlasnik upisao
    });

    it('still works when the lists cannot be loaded (shows technical values)', async () => {
      await open([ACTIVE], 'fail');

      expect(cards().length).toBe(1);
      expect(cards()[0].textContent).toContain('WALLET');
    });

    it('shows the completeness score as a number and as a bar', async () => {
      await open([CLOSED]);

      expect(text()).toContain('Preciznost oglasa: 80/100');
      const fill = page().querySelector('.fill') as HTMLElement;
      expect(fill.style.width).toBe('80%');
      expect(page().querySelector('.bar')?.getAttribute('aria-valuenow')).toBe('80');
    });

    it('shows the expiry date for active reports and the closing date for the others', async () => {
      await open();

      expect(cards()[0].textContent).toMatch(/Ističe: \d{2}\.\d{2}\.\d{4}\./);
      expect(cards()[1].textContent).toMatch(/Zatvoren: \d{2}\.\d{2}\.\d{4}\./);
      expect(cards()[2].textContent).toMatch(/Vraćen: \d{2}\.\d{2}\.\d{4}\./);
      expect(cards()[3].textContent).toMatch(/Istekao: \d{2}\.\d{2}\.\d{4}\./);
    });

    it('offers "close" only for active reports', async () => {
      await open();

      const closeButtons = page().querySelectorAll('.close-report');
      expect(closeButtons.length).toBe(1);
      expect(cards()[0].querySelector('.close-report')).not.toBeNull();
      expect(cards()[1].querySelector('.close-report')).toBeNull();
    });
  });

  describe('closing a report', () => {
    it('first asks for confirmation and sends nothing yet', async () => {
      await open([ACTIVE]);

      buttonByText('Zatvori oglas').click();
      await fixture.whenStable();

      expect(text()).toContain('Zatvoriti oglas?');
      httpMock.expectNone(LIST_URL + '/1/close');
    });

    it('can be cancelled', async () => {
      await open([ACTIVE]);
      buttonByText('Zatvori oglas').click();
      await fixture.whenStable();

      buttonByText('Odustani').click();
      await fixture.whenStable();

      expect(text()).not.toContain('Zatvoriti oglas?');
      expect(buttonByText('Zatvori oglas')).toBeTruthy();
      httpMock.expectNone(LIST_URL + '/1/close');
    });

    it('closes the report after confirmation and updates the card', async () => {
      await open([ACTIVE]);
      buttonByText('Zatvori oglas').click();
      await fixture.whenStable();

      buttonByText('Da, zatvori').click();
      const req = httpMock.expectOne(LIST_URL + '/1/close');
      expect(req.request.method).toBe('POST');
      req.flush({ ...ACTIVE, status: 'CLOSED', closedAt: '2026-11-18T09:00:00Z' });
      await fixture.whenStable();

      expect(cards()[0].textContent).toContain('Zatvoren');
      expect(cards()[0].textContent).not.toContain('Aktivan');
      expect(page().querySelector('.close-report')).toBeNull();
      expect(text()).not.toContain('Zatvoriti oglas?');
      expect(component.closingId()).toBeNull();
    });

    it('changes only the closed report, the others stay as they were', async () => {
      await open([ACTIVE, report({ id: 5, city: 'Subotica' })]);
      buttonByText('Zatvori oglas').click(); // prvo dugme: oglas 1
      await fixture.whenStable();
      buttonByText('Da, zatvori').click();

      httpMock
        .expectOne(LIST_URL + '/1/close')
        .flush({ ...ACTIVE, status: 'CLOSED', closedAt: '2026-11-18T09:00:00Z' });
      await fixture.whenStable();

      expect(cards()[0].textContent).toContain('Zatvoren');
      expect(cards()[1].textContent).toContain('Aktivan');
      expect(cards()[1].querySelector('.close-report')).not.toBeNull();
    });

    it('sends only one request even if confirmed twice', async () => {
      await open([ACTIVE]);

      component.confirmClose(1);
      component.confirmClose(1);

      const requests = httpMock.match(LIST_URL + '/1/close');
      expect(requests.length).toBe(1);
      requests[0].flush({ ...ACTIVE, status: 'CLOSED' });
    });

    it('shows the message of the backend when closing fails', async () => {
      await open([ACTIVE]);
      buttonByText('Zatvori oglas').click();
      await fixture.whenStable();
      buttonByText('Da, zatvori').click();

      httpMock
        .expectOne(LIST_URL + '/1/close')
        .flush(
          { status: 500, message: 'Greška na serveru' },
          { status: 500, statusText: 'Server Error' },
        );
      await fixture.whenStable();

      expect(text()).toContain('Greška na serveru');
      expect(cards()[0].textContent).toContain('Aktivan');
      expect(component.closingId()).toBeNull();
    });

    it('reloads the list when the backend says the report is already closed (409)', async () => {
      await open([ACTIVE]);
      component.confirmClose(1);

      // Backend greške iz servisa stižu kao HTTP 400, a pravi kod je u telu
      httpMock
        .expectOne(LIST_URL + '/1/close')
        .flush(
          { status: 409, message: 'Oglas je već zatvoren' },
          { status: 400, statusText: 'Bad Request' },
        );
      httpMock
        .expectOne(LIST_URL)
        .flush([{ ...ACTIVE, status: 'CLOSED', closedAt: '2026-11-18T09:00:00Z' }]);
      // zatvoren oglas više nema poklapanja: za njega se ne pita
      await fixture.whenStable();

      expect(text()).toContain('Oglas je već zatvoren');
      expect(cards()[0].textContent).toContain('Zatvoren');
    });

    it('says the server is unreachable', async () => {
      await open([ACTIVE]);
      component.confirmClose(1);

      httpMock.expectOne(LIST_URL + '/1/close').error(new ProgressEvent('error'));
      await fixture.whenStable();

      expect(text()).toContain('Server nije dostupan');
    });
  });

  describe('the matches', () => {
    const matchRow = (card: HTMLElement) => card.querySelector('.matches');

    it('asks for the matches of ACTIVE reports only', async () => {
      await open([ACTIVE, CLOSED, RETURNED, EXPIRED]);

      // answerMatches je već proverio da je zahtev samo za aktivan oglas; ostali ne šalju ništa
      expect(matchRow(cards()[0])).not.toBeNull();
      expect(matchRow(cards()[1])).toBeNull();
      expect(matchRow(cards()[2])).toBeNull();
      expect(matchRow(cards()[3])).toBeNull();
    });

    it('says "Proveravamo poklapanja..." until the answer comes', async () => {
      await open([ACTIVE], OPTIONS, { 1: 'wait' });

      expect(text()).toContain('Proveravamo poklapanja...');
      expect(text()).not.toContain('Još nema poklapanja');
      httpMock.expectNone(LIST_URL + '/1/matches');
    });

    it('shows how many matches a report has, the best level, and a link to them', async () => {
      await open([ACTIVE], OPTIONS, {
        1: [lostMatch(12, { confidence: 'LOW' }), lostMatch(13, { confidence: 'HIGH' })],
      });

      const row = matchRow(cards()[0]) as HTMLElement;
      expect(row.textContent?.replace(/\s+/g, ' ')).toContain(
        '2 poklapanja, najbolje: veoma verovatno',
      );
      expect(row.classList).toContain('has-matches');
      const link = row.querySelector('a');
      expect(link?.textContent?.trim()).toBe('Pogledaj poklapanja');
      expect(link?.getAttribute('href')).toBe('/moji-oglasi/1');
    });

    it('uses the singular for one match', async () => {
      await open([ACTIVE], OPTIONS, { 1: [lostMatch(12)] });

      const row = matchRow(cards()[0])?.textContent ?? '';
      expect(row).toContain('1 poklapanje');
      expect(row).not.toContain('1 poklapanja');
    });

    it('says there are no matches yet, and still links to the details', async () => {
      await open([ACTIVE], OPTIONS, { 1: [] });

      const row = matchRow(cards()[0]) as HTMLElement;
      expect(row.textContent).toContain('Još nema poklapanja.');
      expect(row.classList).not.toContain('has-matches');
      expect(row.querySelector('a')?.getAttribute('href')).toBe('/moji-oglasi/1');
      expect(row.querySelector('a')?.textContent?.trim()).toBe('Detalji');
    });

    it('shows nothing about matches when the server fails, and the list still works', async () => {
      await open([ACTIVE], OPTIONS, { 1: 'fail' });

      expect(matchRow(cards()[0])).toBeNull();
      expect(text()).not.toContain('Proveravamo poklapanja');
      expect(cards().length).toBe(1);
      expect(buttonByText('Zatvori oglas')).toBeDefined();
    });

    it('counts each report on its own', async () => {
      const second = report({ id: 5, city: 'Niš' });
      await open([ACTIVE, second], OPTIONS, {
        1: [lostMatch(12)],
        5: [lostMatch(20), lostMatch(21), lostMatch(22)],
      });

      expect(matchRow(cards()[0])?.textContent).toContain('1 poklapanje');
      expect(matchRow(cards()[1])?.textContent).toContain('3 poklapanja');
    });

    it('asks again when the list is loaded again', async () => {
      await open(null);
      httpMock.expectOne(LIST_URL).flush({}, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();

      buttonByText('Pokušaj ponovo').click();
      httpMock.expectOne(LIST_URL).flush([ACTIVE]);
      await answerMatches([ACTIVE], { 1: [lostMatch(12), lostMatch(13)] });

      expect(matchRow(cards()[0])?.textContent).toContain('2 poklapanja');
    });
  });

  describe('who is signed in', () => {
    it('shows the email, without the technical role', async () => {
      await open([ACTIVE]);

      expect(text()).toContain('Prijavljen si kao ana@primer.rs.');
      expect(text()).not.toContain('OWNER');
    });
  });

  describe('navigation', () => {
    it('has a link to the form for a new report', async () => {
      await open();

      const link = page().querySelector('a.new-report') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/novi-oglas');
    });

    it('logout calls the backend, clears the session and goes to the home page', async () => {
      await open();

      component.onLogout();

      httpMock.expectOne(LOGOUT_URL).flush(null, { status: 204, statusText: 'No Content' });

      expect(TestBed.inject(AuthService).isLoggedIn()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
