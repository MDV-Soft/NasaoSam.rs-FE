import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MatchCard } from './match-card';
import { ItemOptions } from '../../../core/models/item-options.model';
import { LostMatch } from '../../../core/models/lost-match.model';
import { formatLocalDate, addDays } from '../../../core/utils/moment';
import { environment } from '../../../../environments/environment';

const BASE = environment.apiUrl + '/lost-reports/7/matches/12';

const OPTIONS: ItemOptions = {
  categories: [
    { value: 'WALLET', label: 'Novčanik' },
    { value: 'DOCUMENT', label: 'Dokument' },
    { value: 'OTHER', label: 'Ostalo' },
  ],
  documentTypes: [{ value: 'ID_CARD', label: 'Lična karta' }],
  colors: [{ value: 'BLACK', label: 'Crna' }],
};

const match = (values: Partial<LostMatch> = {}): LostMatch => ({
  matchId: 12,
  lostItemId: 31,
  confidence: 'MEDIUM',
  category: 'WALLET',
  customCategory: null,
  documentType: null,
  color: 'BLACK',
  city: 'Niš',
  foundDate: '2026-11-14',
  photoUrl: '/api/lost-reports/7/matches/12/photo',
  ...values,
});

describe('MatchCard', () => {
  let fixture: ComponentFixture<MatchCard>;
  let component: MatchCard;
  let httpMock: HttpTestingController;
  let dismissed: number[];
  // Zahtev za sliku; kad se čeka ('wait'), ostaje neodgovoren da test može da ga odgovori kasnije
  let photoRequest: TestRequest | null;

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => page().textContent?.replace(/\s+/g, ' ') ?? '';
  const settle = () => fixture.whenStable();
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(page().querySelectorAll('button')).find((b) => b.textContent?.includes(label));
  const click = async (label: string) => {
    button(label)!.click();
    await settle();
  };

  // Otvara karticu; photo = 'ok' | 'fail' | 'wait' (zahtev za sliku ostaje bez odgovora)
  const open = async (
    value: LostMatch = match(),
    photo: 'ok' | 'fail' | 'wait' = 'ok',
    options: ItemOptions | null = OPTIONS,
  ) => {
    URL.createObjectURL = vi.fn(() => 'blob:match-photo');
    URL.revokeObjectURL = vi.fn();

    fixture = TestBed.createComponent(MatchCard);
    component = fixture.componentInstance;
    dismissed = [];
    component.dismissed.subscribe((id) => dismissed.push(id));
    fixture.componentRef.setInput('match', value);
    fixture.componentRef.setInput('reportId', 7);
    fixture.componentRef.setInput('options', options);
    await settle();

    photoRequest = null;
    if (value.photoUrl !== null) {
      photoRequest = httpMock.expectOne(environment.apiUrl + '/lost-reports/7/matches/12/photo');
      if (photo === 'ok') {
        photoRequest.flush(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
      } else if (photo === 'fail') {
        photoRequest.flush(null, { status: 404, statusText: 'Not Found' });
      }
    }
    await settle();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchCard],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('what it shows', () => {
    it('shows what was found, the color, the place and the day', async () => {
      await open();

      expect(text()).toContain('Novčanik');
      const facts = page().querySelector('.facts')?.textContent?.replace(/\s+/g, ' ') ?? '';
      expect(facts).toContain('Boja');
      expect(facts).toContain('Crna');
      expect(facts).toContain('Pronađeno');
      expect(facts).toContain('Niš, 14. novembar 2026.');
    });

    it('says "danas" and "juče" for the last two days', async () => {
      await open(match({ foundDate: formatLocalDate(new Date()) }));
      expect(text()).toContain('Niš, danas');

      fixture.destroy();
      await open(match({ foundDate: formatLocalDate(addDays(new Date(), -1)) }));
      expect(text()).toContain('Niš, juče');
    });

    it('names a document and an "Other" item the way the lost report does', async () => {
      await open(match({ category: 'DOCUMENT', documentType: 'ID_CARD', color: null }));
      expect(text()).toContain('Dokument: Lična karta');
      expect(text()).not.toContain('Boja');

      fixture.destroy();
      await open(match({ category: 'OTHER', customCategory: 'Kišobran' }));
      expect(text()).toContain('Kišobran');
    });

    it('shows technical values when the lists from the server are missing', async () => {
      await open(match(), 'ok', null);

      expect(text()).toContain('WALLET');
      expect(text()).toContain('BLACK');
    });

    it('shows ONLY what the server gives: no contact, brand, description or question', async () => {
      await open();

      expect(text()).not.toMatch(/kontakt|mejl|telefon|marka|opis|pitanje|odgovor|adresa/i);
    });

    it('has no AI wording, no emoji and no icons', async () => {
      await open();

      expect(text().toLowerCase()).not.toMatch(/\bai\b|veštačk|inteligencij/);
      expect(text()).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(page().querySelector('svg')).toBeNull();
    });
  });

  describe('how likely it is', () => {
    const cases: [LostMatch['confidence'], string, number][] = [
      ['HIGH', 'Veoma verovatno', 3],
      ['MEDIUM', 'Verovatno', 2],
      ['LOW', 'Moguće', 1],
    ];

    cases.forEach(([confidence, label, filled]) => {
      it(`${confidence}: says "${label}" in words and fills ${filled} of 3 marks`, async () => {
        await open(match({ confidence }));

        expect(page().querySelector('.confidence-label')?.textContent?.trim()).toBe(label);
        expect(page().querySelectorAll('.bars i.on').length).toBe(filled);
        expect(page().querySelectorAll('.bars i').length).toBe(3);
        expect(page().querySelector('.confidence')?.getAttribute('aria-label')).toBe(
          'Verovatnoća poklapanja: ' + label,
        );
      });
    });
  });

  describe('the blurred photo', () => {
    it('is loaded from the address of the BACKEND and shown', async () => {
      await open();

      expect(page().querySelector('.photo img')?.getAttribute('src')).toBe('blob:match-photo');
      expect(page().querySelector('.photo img')?.getAttribute('alt')).toContain('Zamućena');
    });

    it('says it is loading while the photo is on its way', async () => {
      await open(match(), 'wait');

      expect(page().querySelector('.photo img')).toBeNull();
      expect(text()).toContain('Učitavanje fotografije');
      photoRequest!.flush(new Blob([new Uint8Array(1)]));
    });

    it('says so when the finder did not add a photo (and asks for nothing)', async () => {
      await open(match({ photoUrl: null }));

      expect(text()).toContain('Nalazač nije dodao fotografiju');
      httpMock.expectNone(BASE + '/photo');
    });

    it('says so when the photo cannot be loaded, and the card still works', async () => {
      await open(match(), 'fail');

      expect(page().querySelector('.photo img')).toBeNull();
      expect(text()).toContain('Fotografija trenutno nije dostupna');
      expect(button('Ovo nije moj predmet')).toBeDefined();
    });

    it('is freed when the card is closed', async () => {
      await open();
      fixture.destroy();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:match-photo');
    });
  });

  describe('"Ovo nije moj predmet"', () => {
    it('first asks to be sure and sends nothing', async () => {
      await open();

      await click('Ovo nije moj predmet');

      expect(text()).toContain('neće se ponovo prikazati');
      expect(text()).toContain('Da, nije moj predmet');
      httpMock.expectNone(BASE + '/dismiss');
    });

    it('can be cancelled', async () => {
      await open();
      await click('Ovo nije moj predmet');

      await click('Odustani');

      expect(button('Ovo nije moj predmet')).toBeDefined();
      expect(text()).not.toContain('Da, nije moj predmet');
      httpMock.expectNone(BASE + '/dismiss');
      expect(dismissed).toEqual([]);
    });

    it('sends POST without a body after the second click and tells the parent', async () => {
      await open();
      await click('Ovo nije moj predmet');

      await click('Da, nije moj predmet');

      const req = httpMock.expectOne(BASE + '/dismiss');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(dismissed).toEqual([12]);
    });

    it('sends only one request even if confirmed twice', async () => {
      await open();
      await click('Ovo nije moj predmet');

      component.dismiss();
      component.dismiss();

      const requests = httpMock.match(BASE + '/dismiss');
      expect(requests.length).toBe(1);
      requests[0].flush(null, { status: 204, statusText: 'No Content' });
    });

    it('disables the buttons and says what is going on while it works', async () => {
      await open();
      await click('Ovo nije moj predmet');

      await click('Da, nije moj predmet');

      expect(text()).toContain('Uklanjanje...');
      expect(button('Odustani')?.disabled).toBe(true);
      httpMock.expectOne(BASE + '/dismiss').flush(null, { status: 204, statusText: 'No Content' });
    });

    it('treats "not found" as done: the match is already gone (backend answers HTTP 400 with 404 in the body)', async () => {
      await open();
      await click('Ovo nije moj predmet');

      await click('Da, nije moj predmet');
      httpMock
        .expectOne(BASE + '/dismiss')
        .flush(
          { status: 404, message: 'Poklapanje nije pronađeno' },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(dismissed).toEqual([12]);
      expect(component.errors()).toEqual([]);
    });

    it('shows why it failed and goes back to the normal state', async () => {
      await open();
      await click('Ovo nije moj predmet');

      await click('Da, nije moj predmet');
      httpMock
        .expectOne(BASE + '/dismiss')
        .flush(
          { status: 500, message: 'Došlo je do greške na serveru' },
          { status: 500, statusText: 'Server Error' },
        );
      await settle();

      expect(dismissed).toEqual([]);
      expect(text()).toContain('Došlo je do greške na serveru');
      expect(component.busy()).toBe(false);
      expect(button('Ovo nije moj predmet')).toBeDefined();
    });

    it('says the server is unreachable and can be tried again', async () => {
      await open();
      await click('Ovo nije moj predmet');
      await click('Da, nije moj predmet');
      httpMock.expectOne(BASE + '/dismiss').error(new ProgressEvent('error'));
      await settle();
      expect(text()).toContain('Server nije dostupan');

      await click('Ovo nije moj predmet');
      await click('Da, nije moj predmet');
      httpMock.expectOne(BASE + '/dismiss').flush(null, { status: 204, statusText: 'No Content' });

      expect(dismissed).toEqual([12]);
    });
  });
});
