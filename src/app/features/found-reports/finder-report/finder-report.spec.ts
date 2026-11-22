import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FinderReportPage } from './finder-report';
import { FinderReport } from '../../../core/models/found-report.model';
import { ItemOptions } from '../../../core/models/item-options.model';
import { environment } from '../../../../environments/environment';

const BASE = environment.apiUrl + '/finder/report';
const OPTIONS_URL = environment.apiUrl + '/meta/options';

const OPTIONS: ItemOptions = {
  categories: [
    { value: 'WALLET', label: 'Novčanik' },
    { value: 'DOCUMENT', label: 'Dokument' },
    { value: 'KEYS', label: 'Ključevi' },
  ],
  documentTypes: [{ value: 'ID_CARD', label: 'Lična karta' }],
  colors: [{ value: 'BLACK', label: 'Crna' }],
};

const report = (values: Partial<FinderReport> = {}): FinderReport => ({
  status: 'PENDING_REVIEW',
  foundAt: '2026-11-20T10:30:00Z',
  city: 'Beograd',
  placeDescription: 'na klupi ispred pošte',
  latitude: 44.8125,
  longitude: 20.4612,
  itemLocation: 'WITH_FINDER',
  handoverInfo: null,
  controlQuestion: 'Šta piše na privesku?',
  hasPhoto: true,
  activatedAt: null,
  expiresAt: '2026-11-22T10:30:00Z',
  items: [],
  ...values,
});

const wallet = {
  category: 'WALLET' as const,
  customCategory: null,
  documentType: null,
  color: 'BLACK' as const,
  brand: 'Guess',
  material: null,
  description: 'Crni, iskrzan',
  distinctiveMarks: 'crveni konac',
};

describe('FinderReportPage', () => {
  let fixture: ComponentFixture<FinderReportPage>;
  let component: FinderReportPage;
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

  // Izbor u listi u uređivaču predmeta, kao što bi uradio korisnik
  const choose = async (id: string, value: string) => {
    const field = page().querySelector<HTMLSelectElement | HTMLInputElement>('#' + id)!;
    field.value = value;
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
    await settle();
  };

  // Otvara stranicu: nalaz, liste i (ako postoji) slika stižu sa servera
  const open = async (
    value: FinderReport = report(),
    photo: 'ok' | 'fail' = 'ok',
    accessExpiresAt?: Date,
  ) => {
    sessionStorage.clear();
    if (accessExpiresAt) {
      sessionStorage.setItem('finder_expires_at', accessExpiresAt.toISOString());
    }
    URL.createObjectURL = vi.fn(() => 'blob:photo-1');
    URL.revokeObjectURL = vi.fn();

    await TestBed.configureTestingModule({
      imports: [FinderReportPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FinderReportPage);
    component = fixture.componentInstance;
    await settle();

    httpMock.expectOne(BASE).flush(value);
    httpMock.expectOne(OPTIONS_URL).flush(OPTIONS);
    if (value.hasPhoto) {
      const req = httpMock.expectOne(BASE + '/photo');
      if (photo === 'ok') {
        req.flush(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
      } else {
        req.flush(null, { status: 404, statusText: 'Not Found' });
      }
    }
    await settle();
  };

  // Ponovno učitavanje posle 409: stiže nalaz, a za njim i slika
  const flushReload = async (value: FinderReport) => {
    httpMock.expectOne(BASE).flush(value);
    httpMock.expectOne(BASE + '/photo').flush(new Blob([new Uint8Array(1)]));
    await settle();
  };

  afterEach(() => {
    httpMock.verify();
  });

  // ===================== Pregled =====================

  describe('while the report waits for confirmation', () => {
    beforeEach(async () => {
      await open(report({ itemLocation: 'AT_POLICE', handoverInfo: 'PS Vračar, Njegoševa 20' }));
    });

    it('shows the title, the facts and the control question', () => {
      expect(text()).toContain('Proveri nalaz');
      expect(text()).toContain('Beograd, na klupi ispred pošte');
      expect(text()).toContain('U policiji: PS Vračar, Njegoševa 20');
      expect(text()).toContain('Šta piše na privesku?');
      expect(text()).toMatch(/20\.11\.2026\. u \d{2}:\d{2}/);
    });

    it('shows the photo that came as a blob', () => {
      expect(page().querySelector('.photo')?.getAttribute('src')).toBe('blob:photo-1');
    });

    it('shows the item editor with the lists from the server', () => {
      expect(page().querySelector('app-found-items-editor')).not.toBeNull();
      expect(page().querySelector('#category-0')).not.toBeNull();
      expect(text()).toContain('Link iz mejla možeš da otvoriš ponovo dok ne potvrdiš nalaz');
    });

    it('offers to confirm, to save, to change the place and to withdraw', () => {
      expect(button('Potvrdi nalaz')).toBeDefined();
      expect(button('Sačuvaj predmete')).toBeDefined();
      expect(button('Promeni gde je predmet')).toBeDefined();
      expect(button('Povuci nalaz')).toBeDefined();
    });

    it('frees the photo when the page is left', () => {
      fixture.destroy();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
    });
  });

  it('shows the items that are already saved inside the editor', async () => {
    await open(report({ items: [wallet] }));

    expect(page().querySelector<HTMLSelectElement>('#category-0')?.value).toBe('WALLET');
    expect(page().querySelector<HTMLInputElement>('#brand-0')?.value).toBe('Guess');
  });

  it('says so when the photo cannot be shown', async () => {
    await open(report(), 'fail');

    expect(page().querySelector('.photo')).toBeNull();
    expect(text()).toContain('Fotografija trenutno nije dostupna');
  });

  it('does not ask for a photo when there is none', async () => {
    await open(report({ hasPhoto: false }));

    expect(page().querySelector('.photo')).toBeNull();
    expect(text()).not.toContain('Učitavanje fotografije');
  });

  describe('when the report cannot be loaded', () => {
    beforeEach(async () => {
      sessionStorage.clear();
      await TestBed.configureTestingModule({
        imports: [FinderReportPage],
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      }).compileComponents();
      httpMock = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(FinderReportPage);
      component = fixture.componentInstance;
      await settle();
    });

    it('shows what the server said and lets the user try again', async () => {
      httpMock
        .expectOne(BASE)
        .flush(
          { status: 404, message: 'Nalaz nije pronađen' },
          { status: 400, statusText: 'Bad Request' },
        );
      httpMock.expectOne(OPTIONS_URL).flush(OPTIONS);
      await settle();

      expect(text()).toContain('Nalaz nije učitan');
      expect(text()).toContain('Nalaz nije pronađen');

      await click('Pokušaj ponovo');
      httpMock.expectOne(BASE).flush(report());
      httpMock.expectOne(BASE + '/photo').flush(new Blob([new Uint8Array(1)]));
      await settle();

      expect(text()).toContain('Proveri nalaz');
    });

    it('says the server cannot be reached', async () => {
      httpMock.expectOne(BASE).error(new ProgressEvent('error'));
      httpMock.expectOne(OPTIONS_URL).flush(OPTIONS);
      await settle();

      expect(text()).toContain('Server nije dostupan');
    });
  });

  // ===================== Predmeti i potvrda =====================

  describe('saving and confirming', () => {
    beforeEach(async () => {
      await open();
    });

    it('does not send anything while the item is not filled in, and shows what is missing', async () => {
      await click('Potvrdi nalaz');

      httpMock.expectNone(BASE + '/items');
      httpMock.expectNone(BASE + '/confirm');
      expect(text()).toContain('Izaberi vrstu predmeta.');
    });

    it('saves the items without confirming and says so', async () => {
      await choose('category-0', 'KEYS');
      await choose('color-0', 'BLACK');

      await click('Sačuvaj predmete');
      await settle();

      const req = httpMock.expectOne(BASE + '/items');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ items: [{ category: 'KEYS', color: 'BLACK' }] });
      req.flush(report({ items: [{ ...wallet, category: 'KEYS' }] }));
      await settle();

      expect(text()).toContain('Predmeti su sačuvani.');
      expect(component.report()?.status).toBe('PENDING_REVIEW');
      httpMock.expectNone(BASE + '/confirm');
    });

    it('saves the items first and then confirms, and the page becomes the "active" page', async () => {
      await choose('category-0', 'KEYS');

      await click('Potvrdi nalaz');
      await settle();

      const save = httpMock.expectOne(BASE + '/items');
      expect(save.request.body).toEqual({ items: [{ category: 'KEYS' }] });
      httpMock.expectNone(BASE + '/confirm'); // tek kad se predmeti sačuvaju
      save.flush(report({ items: [{ ...wallet, category: 'KEYS' }] }));

      const confirm = httpMock.expectOne(BASE + '/confirm');
      expect(confirm.request.method).toBe('POST');
      confirm.flush(
        report({
          status: 'ACTIVE',
          activatedAt: '2026-11-21T10:00:00Z',
          expiresAt: '2027-01-20T10:00:00Z',
          items: [{ ...wallet, category: 'KEYS' }],
        }),
      );
      await settle();

      expect(text()).toContain('Nalaz je aktivan');
      expect(text()).toContain('20.01.2027.');
      expect(page().querySelector('app-found-items-editor')).toBeNull();
      expect(button('Potvrdi nalaz')).toBeUndefined();
    });

    it('does not confirm when saving the items failed, and shows why', async () => {
      await choose('category-0', 'KEYS');

      await click('Potvrdi nalaz');
      await settle();
      httpMock
        .expectOne(BASE + '/items')
        .flush(
          { status: 400, message: 'Nalaz mora imati bar jedan predmet' },
          { status: 400, statusText: 'Bad Request' },
        );
      await settle();

      httpMock.expectNone(BASE + '/confirm');
      expect(text()).toContain('Nalaz mora imati bar jedan predmet');
      expect(component.busy()).toBeNull();
      expect(component.report()?.status).toBe('PENDING_REVIEW');
    });

    it('reloads the report when the server says it is no longer waiting (409)', async () => {
      await choose('category-0', 'KEYS');

      await click('Potvrdi nalaz');
      await settle();
      httpMock.expectOne(BASE + '/items').flush(report());
      httpMock
        .expectOne(BASE + '/confirm')
        .flush(
          { status: 409, message: 'Nalaz nije na čekanju potvrde' },
          { status: 400, statusText: 'Bad Request' },
        );
      await settle();

      expect(text()).toContain('Nalaz nije na čekanju potvrde');
      // Prikaz je zastareo (npr. potvrđeno u drugoj kartici): učitava se ponovo
      await flushReload(report({ status: 'ACTIVE' }));
      expect(component.report()?.status).toBe('ACTIVE');
    });

    it('sends only one request chain even if the button is pressed twice', async () => {
      await choose('category-0', 'KEYS');

      const first = component.confirm();
      const second = component.confirm();
      await Promise.all([first, second]);

      const saves = httpMock.match(BASE + '/items');
      expect(saves.length).toBe(1);
      saves[0].flush(report());
      httpMock.expectOne(BASE + '/confirm').flush(report({ status: 'ACTIVE' }));
    });

    it('disables the buttons and says what is going on while it works', async () => {
      await choose('category-0', 'KEYS');

      await click('Potvrdi nalaz');
      await settle();

      expect(text()).toContain('Potvrđivanje...');
      expect(button('Sačuvaj predmete')?.disabled).toBe(true);
      httpMock.expectOne(BASE + '/items').flush(report());
      httpMock.expectOne(BASE + '/confirm').flush(report({ status: 'ACTIVE' }));
    });
  });

  // ===================== Aktivan nalaz =====================

  describe('after confirmation (the report is active)', () => {
    const active = (values: Partial<FinderReport> = {}) =>
      report({
        status: 'ACTIVE',
        activatedAt: '2026-11-21T10:00:00Z',
        expiresAt: '2027-01-20T10:00:00Z',
        items: [wallet, { ...wallet, category: 'DOCUMENT', documentType: 'ID_CARD', color: null }],
        ...values,
      });

    it('shows the items as a list with names from the server, without an editor', async () => {
      await open(active());

      expect(page().querySelector('app-found-items-editor')).toBeNull();
      expect(text()).toContain('Novčanik, Crna, Guess');
      expect(text()).toContain('Crni, iskrzan');
      expect(text()).toContain('Posebni znaci: crveni konac');
      expect(text()).toContain('Dokument: Lična karta');
      expect(button('Potvrdi nalaz')).toBeUndefined();
    });

    it('warns until when the page can be changed (the link does not work anymore after that)', async () => {
      await open(active(), 'ok', new Date(2026, 10, 21, 16, 45));

      expect(text()).toContain('Ovu stranicu možeš da menjaš do 16:45');
      expect(text()).toContain('link iz mejla više ne radi');
    });

    it('still lets the finder change the place and withdraw', async () => {
      await open(active());

      expect(button('Promeni gde je predmet')).toBeDefined();
      expect(button('Povuci nalaz')).toBeDefined();
    });
  });

  describe('when the report is finished', () => {
    const cases: [FinderReport['status'], string][] = [
      ['WITHDRAWN', 'Nalaz je povučen'],
      ['EXPIRED', 'Nalaz je istekao'],
      ['RETURNED', 'Predmet je vraćen'],
    ];

    cases.forEach(([status, title]) => {
      it(`only shows it (${status}) and offers no changes`, async () => {
        await open(report({ status, items: [wallet] }));

        expect(text()).toContain(title);
        expect(button('Promeni gde je predmet')).toBeUndefined();
        expect(button('Povuci nalaz')).toBeUndefined();
        expect(button('Potvrdi nalaz')).toBeUndefined();
        expect(page().querySelector('app-found-items-editor')).toBeNull();
      });
    });
  });

  // ===================== Mesto gde je predmet =====================

  describe('changing where the item is', () => {
    beforeEach(async () => {
      await open(report({ items: [wallet] }));
      await click('Promeni gde je predmet');
    });

    const radio = (index: number) =>
      page().querySelectorAll<HTMLInputElement>('.location-form .choice input')[index];
    const type = async (id: string, value: string) => {
      const input = page().querySelector<HTMLInputElement>('.location-form #' + id)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle();
    };

    it('starts from the current place', () => {
      expect(radio(0).checked).toBe(true);
      expect(page().querySelector('.location-form #handoverInfo')).toBeNull();
    });

    it('asks where the owner can pick the item up when it is not with the finder', async () => {
      radio(2).click();
      await settle();
      await click('Sačuvaj');

      httpMock.expectNone(BASE + '/item-location');
      expect(text()).toContain('Upiši gde vlasnik može da preuzme predmet.');
    });

    it('sends the new place with the handover info and closes the form', async () => {
      radio(2).click();
      await settle();
      await type('handoverInfo', '  PS Vračar, Njegoševa 20  ');

      await click('Sačuvaj');

      const req = httpMock.expectOne(BASE + '/item-location');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        itemLocation: 'AT_POLICE',
        handoverInfo: 'PS Vračar, Njegoševa 20',
      });
      req.flush(report({ itemLocation: 'AT_POLICE', handoverInfo: 'PS Vračar, Njegoševa 20' }));
      await settle();

      expect(page().querySelector('.location-form')).toBeNull();
      expect(text()).toContain('U policiji: PS Vračar, Njegoševa 20');
    });

    it('does not send handover info when the item is back with the finder', async () => {
      radio(1).click();
      await settle();
      await type('handoverInfo', 'Pošta Zvezdara');
      radio(0).click();
      await settle();

      await click('Sačuvaj');

      const req = httpMock.expectOne(BASE + '/item-location');
      expect(req.request.body).toEqual({ itemLocation: 'WITH_FINDER' });
      req.flush(report());
    });

    it('closes the form without sending anything when the finder gives up', async () => {
      await click('Odustani');

      httpMock.expectNone(BASE + '/item-location');
      expect(page().querySelector('.location-form')).toBeNull();
      expect(button('Promeni gde je predmet')).toBeDefined();
    });

    it('shows a failed change next to the form, and nowhere else', async () => {
      radio(1).click();
      await settle();
      await type('handoverInfo', 'Pošta Zvezdara');

      await click('Sačuvaj');
      httpMock
        .expectOne(BASE + '/item-location')
        .flush(
          { status: 400, message: 'Podaci o predaji mogu imati najviše 255 znakova' },
          { status: 400, statusText: 'Bad Request' },
        );
      await settle();

      expect(page().querySelector('.location-form')?.textContent).toContain(
        'Podaci o predaji mogu imati najviše 255 znakova',
      );
      expect(text().split('Podaci o predaji mogu imati najviše 255 znakova').length).toBe(2);
      expect(page().querySelector('.location-form')).not.toBeNull();
      expect(component.busy()).toBeNull();
    });

    it('tells at the top when the report changed in the meantime (409), and reloads it', async () => {
      radio(1).click();
      await settle();
      await type('handoverInfo', 'Pošta Zvezdara');

      await click('Sačuvaj');
      httpMock
        .expectOne(BASE + '/item-location')
        .flush(
          { status: 409, message: 'Nalaz više nije aktivan' },
          { status: 400, statusText: 'Bad Request' },
        );
      await flushReload(report({ status: 'WITHDRAWN' }));

      expect(page().querySelector('.stale')?.textContent).toContain('Nalaz više nije aktivan');
      expect(text()).toContain('Nalaz je povučen');
      expect(page().querySelector('.location-form')).toBeNull();
    });
  });

  // ===================== Povlačenje =====================

  describe('withdrawing', () => {
    beforeEach(async () => {
      await open(report({ items: [wallet] }));
    });

    it('asks to be sure first and can be cancelled', async () => {
      await click('Povuci nalaz');

      expect(text()).toContain('Da, povuci nalaz');
      httpMock.expectNone(BASE + '/withdraw');

      await click('Odustani');
      expect(text()).not.toContain('Da, povuci nalaz');
      httpMock.expectNone(BASE + '/withdraw');
    });

    it('withdraws after the second click and shows the report as withdrawn', async () => {
      await click('Povuci nalaz');
      await click('Da, povuci nalaz');

      const req = httpMock.expectOne(BASE + '/withdraw');
      expect(req.request.method).toBe('POST');
      req.flush(report({ status: 'WITHDRAWN', items: [wallet] }));
      await settle();

      expect(text()).toContain('Nalaz je povučen');
      expect(button('Povuci nalaz')).toBeUndefined();
      expect(button('Potvrdi nalaz')).toBeUndefined();
    });

    it('sends only one request even if the button is pressed twice', async () => {
      component.withdraw();
      component.withdraw();

      expect(httpMock.match(BASE + '/withdraw').length).toBe(1);
    });

    it('shows why withdrawing failed', async () => {
      await click('Povuci nalaz');
      await click('Da, povuci nalaz');

      httpMock
        .expectOne(BASE + '/withdraw')
        .flush(
          { status: 500, message: 'Došlo je do greške na serveru' },
          { status: 500, statusText: 'Error' },
        );
      await settle();

      expect(text()).toContain('Došlo je do greške na serveru');
      expect(component.busy()).toBeNull();
    });
  });
});
