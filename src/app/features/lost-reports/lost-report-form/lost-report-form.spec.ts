import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LostReportForm } from './lost-report-form';
import { ItemFormValue } from '../../../core/utils/lost-item-request';
import { ItemOptions } from '../../../core/models/item-options.model';
import { environment } from '../../../../environments/environment';

const OPTIONS_URL = environment.apiUrl + '/meta/options';
const CREATE_URL = environment.apiUrl + '/lost-reports';

const SAMPLE_OPTIONS: ItemOptions = {
  categories: [
    { value: 'WALLET', label: 'Novčanik' },
    { value: 'DOCUMENT', label: 'Dokument' },
    { value: 'KEYS', label: 'Ključevi' },
    { value: 'OTHER', label: 'Ostalo' },
  ],
  documentTypes: [
    { value: 'ID_CARD', label: 'Lična karta' },
    { value: 'BANK_CARD', label: 'Platna kartica' },
  ],
  colors: [
    { value: 'BLACK', label: 'Crna' },
    { value: 'BLUE', label: 'Plava' },
  ],
};

const LONG_DESCRIPTION = 'Crni kožni novčanik sa iskrzanim ćoškom i crvenim koncem na šavu.';

describe('LostReportForm', () => {
  let component: LostReportForm;
  let fixture: ComponentFixture<LostReportForm>;
  let httpMock: HttpTestingController;
  let router: Router;

  // ISO vreme pomereno za zadati broj sati od sada (negativno = u prošlosti)
  const hoursFromNow = (hours: number): string =>
    new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  // Popunjava prvi korak ispravnim podacima; pojedina polja se mogu prepisati
  const fillForm = (overrides: Record<string, unknown> = {}) => {
    component.reportForm.setValue({
      lostFrom: hoursFromNow(-5),
      lostTo: hoursFromNow(-3),
      city: 'Beograd',
      placeDescription: '',
      latitude: null,
      longitude: null,
      locationRadiusMeters: null,
      ...overrides,
    });
  };

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LostReportForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(LostReportForm);
    component = fixture.componentInstance;
    // Forma pri otvaranju traži liste (vrste, boje...) od servera
    httpMock.expectOne(OPTIONS_URL).flush(SAMPLE_OPTIONS);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create and start on the first step with an empty form', () => {
    expect(component).toBeTruthy();
    expect(component.step()).toBe('report');
    expect(component.draft()).toBeNull();
    expect(component.reportForm.invalid).toBe(true);
  });

  describe('validation', () => {
    it('stays on the first step and shows errors when the form is empty', async () => {
      component.onNext();
      await fixture.whenStable();

      expect(component.step()).toBe('report');
      expect(component.draft()).toBeNull();
      expect(text()).toContain('Unesi početak perioda.');
      expect(text()).toContain('Unesi kraj perioda.');
      expect(text()).toContain('Unesi grad.');
    });

    it('rejects a start that is after the end', async () => {
      fillForm({ lostFrom: hoursFromNow(-2), lostTo: hoursFromNow(-4) });
      component.onNext();
      await fixture.whenStable();

      expect(component.reportForm.errors?.['lostFromAfterLostTo']).toBe(true);
      expect(component.step()).toBe('report');
      expect(text()).toContain('Početak ne može biti posle kraja.');
    });

    it('rejects an end in the future', async () => {
      fillForm({ lostFrom: hoursFromNow(-1), lostTo: hoursFromNow(2) });
      component.onNext();
      await fixture.whenStable();

      expect(component.reportForm.errors?.['lostInFuture']).toBe(true);
      expect(text()).toContain('Vreme gubitka ne može biti u budućnosti.');
    });

    it('rejects a loss older than a year', async () => {
      fillForm({ lostFrom: hoursFromNow(-24 * 400), lostTo: hoursFromNow(-24 * 399) });
      component.onNext();
      await fixture.whenStable();

      expect(component.reportForm.errors?.['lostTooOld']).toBe(true);
      expect(text()).toContain('Gubitak ne može biti stariji od godinu dana.');
    });

    it('rejects a city that is only spaces', () => {
      fillForm({ city: '   ' });
      component.onNext();

      expect(component.reportForm.controls.city.errors?.['required']).toBe(true);
      expect(component.step()).toBe('report');
    });

    it('rejects too long texts', () => {
      fillForm({
        city: 'x'.repeat(101),
        placeDescription: 'x'.repeat(256),
      });

      expect(component.reportForm.controls.city.errors?.['maxlength']).toBeTruthy();
      expect(component.reportForm.controls.placeDescription.errors?.['maxlength']).toBeTruthy();
    });

    it('rejects coordinates outside the valid range', () => {
      fillForm({ latitude: 91, longitude: 181 });

      expect(component.reportForm.controls.latitude.errors?.['max']).toBeTruthy();
      expect(component.reportForm.controls.longitude.errors?.['max']).toBeTruthy();
    });

    it('requires latitude and longitude together', async () => {
      fillForm({ latitude: 44.8, longitude: null });
      component.onNext();
      await fixture.whenStable();

      expect(component.reportForm.errors?.['coordinatesPair']).toBe(true);
      expect(component.step()).toBe('report');
    });

    it('rejects a radius without a point', async () => {
      fillForm({ locationRadiusMeters: 500 });
      component.onNext();
      await fixture.whenStable();

      expect(component.reportForm.errors?.['radiusWithoutPoint']).toBe(true);
      expect(component.step()).toBe('report');
    });

    it('rejects a radius that is not a whole number or is out of range', () => {
      fillForm({ latitude: 44.8, longitude: 20.4, locationRadiusMeters: 100.5 });
      expect(component.reportForm.controls.locationRadiusMeters.errors?.['pattern']).toBeTruthy();

      fillForm({ latitude: 44.8, longitude: 20.4, locationRadiusMeters: 50001 });
      expect(component.reportForm.controls.locationRadiusMeters.errors?.['max']).toBeTruthy();

      fillForm({ latitude: 44.8, longitude: 20.4, locationRadiusMeters: -1 });
      expect(component.reportForm.controls.locationRadiusMeters.errors?.['min']).toBeTruthy();
    });
  });

  describe('going to the next step', () => {
    it('builds the draft with only the required fields', () => {
      const from = hoursFromNow(-5);
      const to = hoursFromNow(-3);
      fillForm({ lostFrom: from, lostTo: to, city: '  Beograd  ' });

      component.onNext();

      expect(component.step()).toBe('items');
      expect(component.draft()).toEqual({ lostFrom: from, lostTo: to, city: 'Beograd' });
    });

    it('leaves out empty optional fields instead of sending empty text', () => {
      fillForm({ placeDescription: '   ' });

      component.onNext();

      const draft = component.draft();
      expect(draft).not.toBeNull();
      expect('placeDescription' in draft!).toBe(false);
      expect('latitude' in draft!).toBe(false);
      expect('locationRadiusMeters' in draft!).toBe(false);
      expect('privateDetails' in draft!).toBe(false);
    });

    it('includes the optional fields that are filled in', () => {
      fillForm({
        placeDescription: ' autobus 26 ',
        latitude: 44.8125,
        longitude: 20.4612,
        locationRadiusMeters: 500,
      });

      component.onNext();

      expect(component.draft()).toMatchObject({
        placeDescription: 'autobus 26',
        latitude: 44.8125,
        longitude: 20.4612,
        locationRadiusMeters: 500,
      });
    });

    it('accepts 0 as a coordinate and as a radius', () => {
      fillForm({ latitude: 0, longitude: 0, locationRadiusMeters: 0 });

      component.onNext();

      expect(component.draft()).toMatchObject({
        latitude: 0,
        longitude: 0,
        locationRadiusMeters: 0,
      });
    });

    it('converts the local time of datetime-local into UTC text', () => {
      // Oblik koji daje <input type="datetime-local">: bez zone i sekundi
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const localText =
        `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}` +
        `T10:30`;
      fillForm({ lostFrom: localText, lostTo: localText });

      component.onNext();

      const sent = component.draft()!.lostFrom;
      expect(sent).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/); // ISO u UTC
      // Kad se pročita nazad, to je opet 10:30 po LOKALNOM vremenu
      const back = new Date(sent);
      expect(back.getHours()).toBe(10);
      expect(back.getMinutes()).toBe(30);
    });

    it('shows the second step', async () => {
      fillForm();
      component.onNext();
      await fixture.whenStable();

      expect(text()).toContain('Dodaj svaki predmet koji si izgubio.');
    });
  });

  describe('going back', () => {
    it('returns to the first step and keeps what was typed', async () => {
      fillForm({ city: 'Niš' });
      component.onNext();

      component.onBack();
      await fixture.whenStable();

      expect(component.step()).toBe('report');
      expect(component.reportForm.controls.city.value).toBe('Niš');
      expect((fixture.nativeElement as HTMLInputElement).querySelector('#city')).not.toBeNull();
    });
  });

  // ===================== Korak 2: predmeti =====================

  // Prelazi na drugi korak sa ispravnim podacima oglasa i vraća element stranice
  const goToItemsStep = async (): Promise<HTMLElement> => {
    fillForm();
    component.onNext();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  // Popunjava predmet na datom mestu; ostala polja ostaju prazna
  const fillItem = (index: number, values: Partial<ItemFormValue>) => {
    component.itemGroups[index].patchValue(values);
  };

  describe('the list of items', () => {
    it('loads the options and starts with one empty item', async () => {
      const page = await goToItemsStep();

      expect(component.options()).toEqual(SAMPLE_OPTIONS);
      expect(component.itemGroups.length).toBe(1);
      expect(page.querySelectorAll('.item-card').length).toBe(1);
    });

    it('fills the select with the labels that came from the server', async () => {
      const page = await goToItemsStep();

      const labels = Array.from(page.querySelectorAll('#category-0 option')).map((option) =>
        option.textContent?.trim(),
      );
      expect(labels).toEqual(['Izaberi vrstu', 'Novčanik', 'Dokument', 'Ključevi', 'Ostalo']);
    });

    it('adds items by clicking the button, up to 10, and then the button is disabled', async () => {
      const page = await goToItemsStep();
      const addButton = (): HTMLButtonElement =>
        Array.from(page.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Dodaj još jedan predmet'),
        ) as HTMLButtonElement;

      // Klikće se i posle 10. predmeta: dugme je tada onemogućeno i klik ne radi ništa
      for (let i = 0; i < 12; i++) {
        addButton().click();
        await fixture.whenStable();
      }

      expect(component.itemGroups.length).toBe(10);
      expect(page.querySelectorAll('.item-card').length).toBe(10);
      expect(addButton().disabled).toBe(true);
    });

    it('removes an item but never the last one', async () => {
      await goToItemsStep();
      component.addItem();
      fillItem(0, { category: 'WALLET' });
      fillItem(1, { category: 'KEYS' });

      component.removeItem(0);
      expect(component.itemGroups.length).toBe(1);
      expect(component.itemGroups[0].controls.category.value).toBe('KEYS');

      component.removeItem(0);
      expect(component.itemGroups.length).toBe(1);
    });

    it('shows the fields that belong to the chosen category', async () => {
      const page = await goToItemsStep();

      // Dok vrsta nije izabrana, nema dodatnih polja
      expect(page.querySelector('#description-0')).toBeNull();

      fillItem(0, { category: 'WALLET' });
      await fixture.whenStable();
      expect(page.querySelector('#description-0')).not.toBeNull();
      expect(page.querySelector('#color-0')).not.toBeNull();
      expect(page.querySelector('#lastName-0')).toBeNull();
      expect(page.querySelector('#customCategory-0')).toBeNull();

      fillItem(0, { category: 'OTHER' });
      await fixture.whenStable();
      expect(page.querySelector('#customCategory-0')).not.toBeNull();
      expect(page.querySelector('#description-0')).not.toBeNull();

      fillItem(0, { category: 'DOCUMENT' });
      await fixture.whenStable();
      expect(page.querySelector('#documentType-0')).not.toBeNull();
      expect(page.querySelector('#lastName-0')).not.toBeNull();
      expect(page.querySelector('#firstName-0')).not.toBeNull();
      expect(page.querySelector('#description-0')).toBeNull();
      expect(page.querySelector('#color-0')).toBeNull();
    });

    it('hides the date of birth for a bank card', async () => {
      const page = await goToItemsStep();
      fillItem(0, { category: 'DOCUMENT', documentType: 'ID_CARD' });
      await fixture.whenStable();
      expect(page.querySelector('#dateOfBirth-0')).not.toBeNull();

      fillItem(0, { documentType: 'BANK_CARD' });
      await fixture.whenStable();

      expect(page.querySelector('#dateOfBirth-0')).toBeNull();
    });

    it('counts the characters of the description (spaces at the ends do not count)', async () => {
      const page = await goToItemsStep();
      fillItem(0, { category: 'WALLET', description: '  abcde  ' });
      await fixture.whenStable();

      expect(component.descriptionLength(0)).toBe(5);
      expect(page.textContent).toContain('5 znakova (najmanje 40)');
    });
  });

  describe('validation of items', () => {
    it('does not send and shows errors when the item is empty', async () => {
      const page = await goToItemsStep();

      await component.onSubmit();
      await fixture.whenStable();

      httpMock.expectNone(CREATE_URL);
      expect(component.isSaving()).toBe(false);
      expect(page.textContent).toContain('Izaberi vrstu predmeta.');
    });

    it('asks for a description of at least 40 characters', async () => {
      const page = await goToItemsStep();
      fillItem(0, { category: 'WALLET', description: 'prekratko' });

      await component.onSubmit();
      await fixture.whenStable();

      httpMock.expectNone(CREATE_URL);
      expect(page.textContent).toContain('Opis mora imati najmanje 40 znakova.');
    });

    it('asks what the item is when the category is "Other"', async () => {
      const page = await goToItemsStep();
      fillItem(0, { category: 'OTHER', description: LONG_DESCRIPTION });

      await component.onSubmit();
      await fixture.whenStable();

      httpMock.expectNone(CREATE_URL);
      expect(page.textContent).toContain('Upiši šta je predmet.');
    });

    it('asks for the document type and the name when the category is "Document"', async () => {
      const page = await goToItemsStep();
      fillItem(0, { category: 'DOCUMENT' });

      await component.onSubmit();
      await fixture.whenStable();

      httpMock.expectNone(CREATE_URL);
      expect(page.textContent).toContain('Izaberi vrstu dokumenta.');
      expect(page.textContent).toContain('Unesi prezime.');
      expect(page.textContent).toContain('Unesi ime.');
      // Dokument ne traži opis
      expect(page.textContent).not.toContain('Opis mora imati');
    });

    it('checks every item, not only the first', async () => {
      await goToItemsStep();
      component.addItem();
      fillItem(0, { category: 'WALLET', description: LONG_DESCRIPTION });
      fillItem(1, { category: 'KEYS', description: 'kratko' });

      await component.onSubmit();

      httpMock.expectNone(CREATE_URL);
      expect(component.itemGroups[0].valid).toBe(true);
      expect(component.itemGroups[1].valid).toBe(false);
    });
  });

  describe('the map', () => {
    it('shows the map instead of the latitude and longitude fields', () => {
      const page = fixture.nativeElement as HTMLElement;

      expect(page.querySelector('app-location-picker')).not.toBeNull();
      expect(page.querySelector('#latitude')).toBeNull();
      expect(page.querySelector('#longitude')).toBeNull();
    });

    it('puts the pin from the map into the report fields', () => {
      fillForm();
      component.onLocationChange({ latitude: 44.8125, longitude: 20.4612, radiusMeters: 300 });

      expect(component.reportForm.getRawValue()).toMatchObject({
        latitude: 44.8125,
        longitude: 20.4612,
        locationRadiusMeters: 300,
      });
      expect(component.mapLocation()).toEqual({
        latitude: 44.8125,
        longitude: 20.4612,
        radiusMeters: 300,
      });

      component.onNext();
      expect(component.draft()).toMatchObject({ latitude: 44.8125, locationRadiusMeters: 300 });
    });

    it('clears all three fields when the pin is removed', () => {
      fillForm();
      component.onLocationChange({ latitude: 44.8, longitude: 20.4, radiusMeters: 100 });
      component.onLocationChange(null);

      expect(component.reportForm.getRawValue()).toMatchObject({
        latitude: null,
        longitude: null,
        locationRadiusMeters: null,
      });
      expect(component.mapLocation()).toBeNull();
    });
  });

  describe('precision of the report', () => {
    it('starts at 0 and lists what brings the most points', () => {
      expect(component.score()).toBe(0);
      expect(component.suggestions().map((s) => s.key)).toContain('coordinates');
      expect(text()).toContain('Preciznost oglasa');
    });

    it('rises live while the form is filled, with the same rules as the backend', async () => {
      fillForm({ placeDescription: 'autobus 26' });
      expect(component.score()).toBe(10);

      component.onLocationChange({ latitude: 44.8, longitude: 20.4, radiusMeters: 300 });
      expect(component.score()).toBe(20);

      component.onNext();
      await fixture.whenStable();
      expect(component.step()).toBe('items');
      fillItem(0, {
        category: 'WALLET',
        color: 'BLACK',
        brand: 'Guess',
        distinctiveMarks: 'ogrebotina',
        description: 'x'.repeat(120),
      });
      // Novčanik 15 + 15 + 20 + 30 = 80 → round(80 * 0,7) = 56
      expect(component.itemScores()).toEqual([80]);

      component.itemsForm.controls.details.setValue('Unutra lična karta i dve slike.');
      // Opis mesta (10) + mapa (10) + detaljan opis (10) + 56
      expect(component.score()).toBe(86);
    });

    it('shows the points next to the fields and a check mark when a field is done', async () => {
      const page = await goToItemsStep();
      fillItem(0, { category: 'KEYS', color: 'BLACK' });
      await fixture.whenStable();

      expect(component.pointsBadge('items.0.color')).toBe('✓');
      expect(component.pointsBadge('items.0.distinctiveMarks')).toBe('+14');
      expect(page.querySelector('label[for="distinctiveMarks-0"] .pts')?.textContent?.trim()).toBe(
        '+14',
      );
    });
  });

  describe('the detailed description', () => {
    it('is on the second step and is limited to 1000 characters', async () => {
      const page = await goToItemsStep();

      expect(page.querySelector('#details')).not.toBeNull();
      expect(page.textContent).toContain('Detaljan opis izgubljenog');
      expect(page.textContent).not.toContain('Privatni detalji');

      component.itemsForm.controls.details.setValue('x'.repeat(1001));
      expect(component.itemsForm.invalid).toBe(true);
    });
  });

  describe('saving', () => {
    it('sends the detailed description as privateDetails, trimmed', async () => {
      await goToItemsStep();
      fillItem(0, { category: 'WALLET', description: LONG_DESCRIPTION });
      component.itemsForm.controls.details.setValue('  U novčaniku je slika mog psa  ');

      await component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      expect(req.request.body.privateDetails).toBe('U novčaniku je slika mog psa');
      req.flush({}, { status: 201, statusText: 'Created' });
    });

    it('does not send an empty detailed description', async () => {
      await goToItemsStep();
      fillItem(0, { category: 'WALLET', description: LONG_DESCRIPTION });
      component.itemsForm.controls.details.setValue('   ');

      await component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      expect('privateDetails' in req.request.body).toBe(false);
      req.flush({}, { status: 201, statusText: 'Created' });
    });

    it('sends the whole report: the data of step 1 and the items (README example for the name)', async () => {
      await goToItemsStep();
      component.addItem();
      fillItem(0, { category: 'WALLET', color: 'BLACK', description: LONG_DESCRIPTION });
      fillItem(1, {
        category: 'DOCUMENT',
        documentType: 'ID_CARD',
        lastName: 'Петровић',
        firstName: 'Ђорђе',
        dateOfBirth: '1999-05-14',
      });
      const draft = component.draft()!;

      await component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        ...draft,
        items: [
          { category: 'WALLET', color: 'BLACK', description: LONG_DESCRIPTION },
          {
            category: 'DOCUMENT',
            documentType: 'ID_CARD',
            nameHash: '63a91cca7f4cd75979029696f860e2b51331fd66ea748a278a1866a5073798ed',
            nameDobHash: '13d3022879cde05143657d2bd87929c817d6a06e443b32363175ea05678f120d',
          },
        ],
      });
      expect(component.isSaving()).toBe(true);
      req.flush({}, { status: 201, statusText: 'Created' });
    });

    it('never sends the real name or the date of birth', async () => {
      await goToItemsStep();
      fillItem(0, {
        category: 'DOCUMENT',
        documentType: 'ID_CARD',
        lastName: 'Petrović',
        firstName: 'Đorđe',
        dateOfBirth: '1999-05-14',
      });

      await component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      const json = JSON.stringify(req.request.body);
      expect(json).not.toContain('Petrović');
      expect(json).not.toContain('Đorđe');
      expect(json).not.toContain('1999-05-14');
      req.flush({}, { status: 201, statusText: 'Created' });
    });

    it('goes to "my reports" after a successful save', async () => {
      await goToItemsStep();
      fillItem(0, { category: 'WALLET', description: LONG_DESCRIPTION });

      await component.onSubmit();
      httpMock.expectOne(CREATE_URL).flush({}, { status: 201, statusText: 'Created' });

      expect(component.isSaving()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/moji-oglasi']);
    });

    it('sends only one request even if the button is pressed twice', async () => {
      await goToItemsStep();
      fillItem(0, { category: 'WALLET', description: LONG_DESCRIPTION });

      const first = component.onSubmit();
      const second = component.onSubmit();
      await Promise.all([first, second]);

      const requests = httpMock.match(CREATE_URL);
      expect(requests.length).toBe(1);
      requests[0].flush({}, { status: 201, statusText: 'Created' });
    });

    it('shows the message of the backend and stays on the page', async () => {
      const page = await goToItemsStep();
      fillItem(0, { category: 'WALLET', description: LONG_DESCRIPTION });

      await component.onSubmit();
      httpMock
        .expectOne(CREATE_URL)
        .flush(
          { status: 400, message: 'Gubitak ne može biti stariji od godinu dana', fieldErrors: {} },
          { status: 400, statusText: 'Bad Request' },
        );
      await fixture.whenStable();

      expect(component.isSaving()).toBe(false);
      expect(component.submitErrors()).toEqual(['Gubitak ne može biti stariji od godinu dana']);
      expect(page.textContent).toContain('Gubitak ne može biti stariji od godinu dana');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('turns "items[1]" in field errors into "Predmet 2"', async () => {
      await goToItemsStep();
      fillItem(0, { category: 'WALLET', description: LONG_DESCRIPTION });

      await component.onSubmit();
      httpMock.expectOne(CREATE_URL).flush(
        {
          status: 400,
          message: 'Neispravni podaci',
          fieldErrors: {
            'items[1].brand': 'Marka može imati najviše 100 znakova',
            city: 'Grad je obavezan',
          },
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(component.submitErrors()).toEqual([
        'Predmet 2: Marka može imati najviše 100 znakova',
        'Grad je obavezan',
      ]);
    });

    it('says the server is unreachable', async () => {
      await goToItemsStep();
      fillItem(0, { category: 'WALLET', description: LONG_DESCRIPTION });

      await component.onSubmit();
      httpMock.expectOne(CREATE_URL).error(new ProgressEvent('error'));

      expect(component.submitErrors()[0]).toContain('Server nije dostupan');
    });

    it('can be submitted again after an error', async () => {
      await goToItemsStep();
      fillItem(0, { category: 'WALLET', description: LONG_DESCRIPTION });

      await component.onSubmit();
      httpMock.expectOne(CREATE_URL).flush(null, { status: 500, statusText: 'Server Error' });
      expect(component.submitErrors()[0]).toBe('Čuvanje oglasa nije uspelo. Pokušaj ponovo.');

      await component.onSubmit();
      expect(component.submitErrors()).toEqual([]);
      httpMock.expectOne(CREATE_URL).flush({}, { status: 201, statusText: 'Created' });
    });
  });
});

describe('LostReportForm when the lists cannot be loaded', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LostReportForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows an error and lets the user try again', async () => {
    const fixture = TestBed.createComponent(LostReportForm);
    const component = fixture.componentInstance;
    httpMock.expectOne(OPTIONS_URL).flush({}, { status: 500, statusText: 'Server Error' });

    expect(component.optionsFailed()).toBe(true);
    expect(component.options()).toBeNull();

    component.loadOptions();
    expect(component.optionsFailed()).toBe(false);
    httpMock.expectOne(OPTIONS_URL).flush(SAMPLE_OPTIONS);

    expect(component.options()).toEqual(SAMPLE_OPTIONS);
  });
});
