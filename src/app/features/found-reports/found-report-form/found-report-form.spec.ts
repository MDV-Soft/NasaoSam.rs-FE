import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FoundReportForm } from './found-report-form';
import { ItemFormValue } from '../../../core/utils/lost-item-request';
import { ItemOptions } from '../../../core/models/item-options.model';
import { CreateFoundReportRequest } from '../../../core/models/found-report.model';
import { MAX_PHOTO_BYTES } from '../../../core/utils/photo-file';
import { environment } from '../../../../environments/environment';

const OPTIONS_URL = environment.apiUrl + '/meta/options';
const CREATE_URL = environment.apiUrl + '/found-reports';

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

const pad = (n: number): string => String(n).padStart(2, '0');

// Lokalno vreme u obliku <input type="datetime-local">, pomereno za zadati broj sati
const localTime = (hoursFromNow: number): string => {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

const photoFile = (size = 1000, name = 'kljucevi.jpg', type = 'image/jpeg'): File =>
  new File([new Uint8Array(size)], name, { type });

describe('FoundReportForm', () => {
  let component: FoundReportForm;
  let fixture: ComponentFixture<FoundReportForm>;
  let httpMock: HttpTestingController;

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => page().textContent ?? '';
  const settle = () => fixture.whenStable();

  // Izbor fotografije kao da ju je korisnik izabrao u dijalogu (input.files)
  const pickPhoto = async (file: File): Promise<{ value: string }> => {
    const input = { files: [file], value: 'C:\\fakepath\\' + file.name };
    await component.onPhotoSelected({ target: input } as unknown as Event);
    await settle();
    return input;
  };

  const fillPlace = (overrides: Record<string, unknown> = {}) => {
    component.placeForm.setValue({
      foundAt: localTime(-2),
      city: 'Beograd',
      placeDescription: '',
      latitude: 44.8125,
      longitude: 20.4612,
      ...overrides,
    } as never);
  };

  const fillItem = (index: number, values: Partial<ItemFormValue>) => {
    component.itemGroups[index].patchValue(values);
  };

  const fillHandover = (overrides: Record<string, unknown> = {}) => {
    component.handoverForm.setValue({
      itemLocation: 'WITH_FINDER',
      handoverInfo: '',
      controlQuestion: 'Šta piše na privesku?',
      controlAnswer: 'Mića',
      finderEmail: 'nalazac@test.rs',
      finderPhone: '',
      ...overrides,
    } as never);
  };

  // Prelazi korake redom, kao korisnik: popuni trenutni korak pa klikne "Dalje"
  const goToStep = async (index: number) => {
    if (component.photo() === null) {
      await pickPhoto(photoFile());
    }
    while (component.stepIndex() < index) {
      const id = component.currentStep().id;
      if (id === 'place') {
        fillPlace();
      }
      if (id === 'items') {
        fillItem(0, { category: 'KEYS' });
      }
      component.next();
    }
    await settle();
  };

  // Tekst forme bez mape: Leaflet sam dodaje atribuciju sa © i zastavicom (svg)
  const formText = (): string => {
    const copy = page().cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.leaflet-container').forEach((map) => map.remove());
    return copy.textContent ?? '';
  };

  // Ikonice (svg) koje forma sama crta
  const strayIcons = (): number =>
    Array.from(page().querySelectorAll('svg')).filter((icon) => !icon.closest('.leaflet-container'))
      .length;

  // Telo poslatog zahteva: JSON deo i slika
  const readRequest = async (req: { request: { body: unknown } }) => {
    const body = req.request.body as FormData;
    const report = JSON.parse(
      await (body.get('report') as Blob).text(),
    ) as CreateFoundReportRequest;
    return { report, photo: body.get('photo') as File };
  };

  const originalCreateUrl = URL.createObjectURL;
  const originalRevokeUrl = URL.revokeObjectURL;

  beforeEach(async () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview-1');
    URL.revokeObjectURL = vi.fn();

    await TestBed.configureTestingModule({
      imports: [FoundReportForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FoundReportForm);
    component = fixture.componentInstance;
    httpMock.expectOne(OPTIONS_URL).flush(SAMPLE_OPTIONS);
    await settle();
  });

  afterEach(() => {
    httpMock.verify();
    URL.createObjectURL = originalCreateUrl;
    URL.revokeObjectURL = originalRevokeUrl;
  });

  it('starts on the photo step and loads the option lists', () => {
    expect(component).toBeTruthy();
    expect(component.stepIndex()).toBe(0);
    expect(component.currentStep().id).toBe('photo');
    expect(component.options()).toEqual(SAMPLE_OPTIONS);
    expect(text()).toContain('Prijavi pronađeni predmet');
    expect(text()).toContain('Slikaj predmet');
  });

  it('has no AI wording, no emoji and no icons on any step', async () => {
    const seen: string[] = [formText()];
    let icons = strayIcons();
    for (const step of [1, 2, 3]) {
      await goToStep(step);
      seen.push(formText());
      icons += strayIcons();
    }

    const all = seen.join(' ').toLowerCase();
    expect(all).not.toMatch(/\bai\b|veštačk|inteligencij/);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(icons).toBe(0);
  });

  // ===================== Traka napretka =====================

  describe('progress bar', () => {
    it('shows four steps and marks the current one', async () => {
      const items = page().querySelectorAll('.progress li');
      expect(items.length).toBe(4);
      expect(items[0].classList).toContain('current');
      expect(text()).toContain('Fotografija');
      expect(text()).toContain('Mesto i vreme');
      expect(text()).toContain('Predmet');
      expect(text()).toContain('Predaja i kontakt');
      expect(text()).toContain('Korak 1 od 4');
    });

    it('lets the user go back to a finished step but not jump ahead', async () => {
      await goToStep(2);

      const buttons = Array.from(page().querySelectorAll<HTMLButtonElement>('.progress button'));
      expect(buttons.map((b) => b.disabled)).toEqual([false, false, true, true]);

      buttons[0].click();
      await settle();
      expect(component.stepIndex()).toBe(0);

      component.goTo(3); // unapred se ne skače
      expect(component.stepIndex()).toBe(0);
    });
  });

  // ===================== Korak 1: fotografija =====================

  describe('step 1: photo', () => {
    it('does not go on without a photo and says what to do', async () => {
      component.next();
      await settle();

      expect(component.stepIndex()).toBe(0);
      expect(text()).toContain('Dodaj fotografiju predmeta.');
    });

    it('accepts a JPEG, shows its name, size and preview, and goes on', async () => {
      await pickPhoto(photoFile(2048, 'kljucevi.jpg'));

      expect(component.photo()?.name).toBe('kljucevi.jpg');
      expect(component.photoError()).toBe('');
      expect(text()).toContain('kljucevi.jpg');
      expect(text()).toContain('2 KB');
      expect(page().querySelector('.photo img')?.getAttribute('src')).toBe('blob:preview-1');

      component.next();
      expect(component.stepIndex()).toBe(1);
    });

    it('accepts a PNG', async () => {
      await pickPhoto(photoFile(500, 'slika.png', 'image/png'));
      expect(component.photo()?.type).toBe('image/png');
    });

    it('rejects other formats and keeps the form without a photo', async () => {
      await pickPhoto(photoFile(500, 'slika.heic', 'image/heic'));

      expect(component.photo()).toBeNull();
      expect(text()).toContain('JPEG i PNG');
    });

    it('rejects a photo that is too big (and says so)', async () => {
      await pickPhoto(photoFile(MAX_PHOTO_BYTES + 1));

      expect(component.photo()).toBeNull();
      expect(text()).toContain('najviše 5 MB');
    });

    it('keeps the previous photo when the new one is not good', async () => {
      await pickPhoto(photoFile(500, 'prva.jpg'));
      await pickPhoto(photoFile(500, 'losa.gif', 'image/gif'));

      expect(component.photo()?.name).toBe('prva.jpg');
      expect(text()).toContain('JPEG i PNG');
    });

    it('replaces the photo and frees the old preview', async () => {
      await pickPhoto(photoFile(500, 'prva.jpg'));
      await pickPhoto(photoFile(600, 'druga.jpg'));

      expect(component.photo()?.name).toBe('druga.jpg');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    });

    it('lets the same file be chosen again (clears the input)', async () => {
      const input = await pickPhoto(photoFile());
      expect(input.value).toBe('');
    });

    it('does nothing when the dialog is closed without a file', async () => {
      await component.onPhotoSelected({ target: { files: [], value: '' } } as unknown as Event);
      expect(component.photo()).toBeNull();
      expect(component.photoError()).toBe('');
    });

    it('frees the preview when the form is destroyed', async () => {
      await pickPhoto(photoFile());
      fixture.destroy();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    });

    it('tells the owner will see only a blurred photo and that phone location is removed', () => {
      expect(text()).toContain('zamućenu verziju');
      expect(text()).toContain('Lokaciju telefona brišemo sa slike');
    });
  });

  // ===================== Korak 2: mesto i vreme =====================

  describe('step 2: place and time', () => {
    beforeEach(async () => {
      await goToStep(1);
    });

    it('starts with "now" as the time and shows the map without a radius choice', () => {
      expect(component.currentStep().id).toBe('place');
      expect(component.placeForm.controls.foundAt.value).not.toBe('');
      expect(page().querySelector('app-location-picker')).not.toBeNull();
      expect(page().querySelector('.lp-radius')).toBeNull();
      expect(page().querySelector('#latitude')).toBeNull();
    });

    it('asks for the city and for a pin on the map', async () => {
      component.next();
      await settle();

      expect(component.stepIndex()).toBe(1);
      expect(text()).toContain('Unesi grad.');
      expect(text()).toContain('Obeleži mesto na mapi.');
    });

    it('takes the pin from the map into the form (and clears it again)', () => {
      component.onLocationChange({ latitude: 44.8125, longitude: 20.4612, radiusMeters: 0 });
      expect(component.placeForm.getRawValue()).toMatchObject({
        latitude: 44.8125,
        longitude: 20.4612,
      });
      expect(component.mapLocation()).toEqual({
        latitude: 44.8125,
        longitude: 20.4612,
        radiusMeters: 0,
      });

      component.onLocationChange(null);
      expect(component.placeForm.getRawValue()).toMatchObject({ latitude: null, longitude: null });
    });

    it('rejects a time in the future', async () => {
      fillPlace({ foundAt: localTime(3) });
      component.next();
      await settle();

      expect(component.stepIndex()).toBe(1);
      expect(text()).toContain('Vreme nalaska ne može biti u budućnosti.');
    });

    it('rejects a find that is older than 30 days', async () => {
      fillPlace({ foundAt: localTime(-24 * 31) });
      component.next();
      await settle();

      expect(component.stepIndex()).toBe(1);
      expect(text()).toContain('pre više od 30 dana');
    });

    it('treats a city that is only spaces as empty', async () => {
      fillPlace({ city: '   ' });
      component.next();
      await settle();

      expect(component.stepIndex()).toBe(1);
      expect(component.placeForm.controls.city.value).toBe('');
      expect(text()).toContain('Unesi grad.');
    });

    it('rejects too long texts', () => {
      fillPlace({ city: 'x'.repeat(101), placeDescription: 'x'.repeat(256) });
      expect(component.placeForm.controls.city.errors?.['maxlength']).toBeTruthy();
      expect(component.placeForm.controls.placeDescription.errors?.['maxlength']).toBeTruthy();
    });

    it('goes on when everything is filled in, and back keeps what was typed', async () => {
      fillPlace({ city: 'Niš' });
      component.next();
      expect(component.stepIndex()).toBe(2);

      component.back();
      await settle();
      expect(component.currentStep().id).toBe('place');
      expect(component.placeForm.controls.city.value).toBe('Niš');
      expect(page().querySelector<HTMLInputElement>('#city')?.value).toBe('Niš');
    });
  });

  // ===================== Korak 3: predmeti =====================

  describe('step 3: items', () => {
    beforeEach(async () => {
      await goToStep(2);
    });

    it('starts with one empty item and the labels from the server', () => {
      expect(component.currentStep().id).toBe('items');
      expect(component.itemGroups.length).toBe(1);

      const labels = Array.from(page().querySelectorAll('#category-0 option')).map((o) =>
        o.textContent?.trim(),
      );
      expect(labels).toEqual(['Izaberi vrstu', 'Novčanik', 'Dokument', 'Ključevi', 'Ostalo']);
    });

    it('asks for the category', async () => {
      component.next();
      await settle();

      expect(component.stepIndex()).toBe(2);
      expect(text()).toContain('Izaberi vrstu predmeta.');
    });

    it('does not ask for a description (unlike a lost report)', () => {
      fillItem(0, { category: 'WALLET' });
      component.next();

      expect(component.stepIndex()).toBe(3);
    });

    it('shows the fields that belong to the chosen category', async () => {
      expect(page().querySelector('#description-0')).toBeNull();

      fillItem(0, { category: 'WALLET' });
      await settle();
      expect(page().querySelector('#description-0')).not.toBeNull();
      expect(page().querySelector('#color-0')).not.toBeNull();
      expect(page().querySelector('#lastName-0')).toBeNull();
      expect(page().querySelector('#customCategory-0')).toBeNull();

      fillItem(0, { category: 'OTHER' });
      await settle();
      expect(page().querySelector('#customCategory-0')).not.toBeNull();

      fillItem(0, { category: 'DOCUMENT' });
      await settle();
      expect(page().querySelector('#documentType-0')).not.toBeNull();
      expect(page().querySelector('#lastName-0')).not.toBeNull();
      expect(page().querySelector('#firstName-0')).not.toBeNull();
      expect(page().querySelector('#description-0')).toBeNull();
      expect(page().querySelector('#color-0')).toBeNull();
    });

    it('asks what the item is for "Other" and everything for a document', async () => {
      fillItem(0, { category: 'OTHER' });
      component.next();
      await settle();
      expect(text()).toContain('Upiši šta je predmet.');

      fillItem(0, { category: 'DOCUMENT' });
      component.next();
      await settle();
      expect(text()).toContain('Izaberi vrstu dokumenta.');
      expect(text()).toContain('Unesi prezime.');
      expect(text()).toContain('Unesi ime.');
      expect(component.stepIndex()).toBe(2);
    });

    it('hides the date of birth for a bank card', async () => {
      fillItem(0, { category: 'DOCUMENT', documentType: 'ID_CARD' });
      await settle();
      expect(page().querySelector('#dateOfBirth-0')).not.toBeNull();

      fillItem(0, { documentType: 'BANK_CARD' });
      await settle();
      expect(page().querySelector('#dateOfBirth-0')).toBeNull();
    });

    it('adds items up to 10, and then the button is disabled', async () => {
      const addButton = (): HTMLButtonElement =>
        Array.from(page().querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Dodaj još jedan predmet'),
        ) as HTMLButtonElement;

      for (let i = 0; i < 12; i++) {
        addButton().click();
        await settle();
      }

      expect(component.itemGroups.length).toBe(10);
      expect(page().querySelectorAll('.item-card').length).toBe(10);
      expect(addButton().disabled).toBe(true);
    });

    it('removes an item but never the last one', () => {
      component.addItem();
      fillItem(0, { category: 'WALLET' });
      fillItem(1, { category: 'KEYS' });

      component.removeItem(0);
      expect(component.itemGroups.length).toBe(1);
      expect(component.itemGroups[0].controls.category.value).toBe('KEYS');

      component.removeItem(0);
      expect(component.itemGroups.length).toBe(1);
    });

    it('checks every item, not only the first', () => {
      component.addItem();
      fillItem(0, { category: 'WALLET' });

      component.next();

      expect(component.stepIndex()).toBe(2);
      expect(component.itemGroups[0].valid).toBe(true);
      expect(component.itemGroups[1].valid).toBe(false);
    });
  });

  // ===================== Korak 4: predaja i kontakt =====================

  describe('step 4: handover and contact', () => {
    beforeEach(async () => {
      await goToStep(3);
    });

    it('offers three places for the item and no handover field until one is chosen', () => {
      expect(component.currentStep().id).toBe('handover');
      const titles = Array.from(page().querySelectorAll('.choice-title')).map((e) => e.textContent);
      expect(titles).toEqual(['Kod mene', 'U ustanovi ili lokalu', 'U policiji']);
      expect(page().querySelector('#handoverInfo')).toBeNull();
    });

    it('asks where the owner can pick the item up when it is not with the finder', async () => {
      fillHandover({ itemLocation: 'AT_POLICE', handoverInfo: '' });
      component.handoverForm.markAllAsTouched();
      await settle();

      expect(page().querySelector('#handoverInfo')).not.toBeNull();
      expect(text()).toContain('Upiši gde vlasnik može da preuzme predmet.');

      await component.onSubmit();
      httpMock.expectNone(CREATE_URL);
    });

    it('shows the handover field only while the item is not with the finder (real clicks)', async () => {
      const radio = (index: number) =>
        page().querySelectorAll<HTMLInputElement>('.choice input')[index];

      radio(1).click(); // ustanova
      await settle();
      expect(page().querySelector('#handoverInfo')).not.toBeNull();

      radio(0).click(); // kod mene
      await settle();
      expect(page().querySelector('#handoverInfo')).toBeNull();

      radio(2).click(); // policija
      await settle();
      expect(page().querySelector('#handoverInfo')).not.toBeNull();
    });

    it('asks for the question, the answer and an email, and says what is missing', async () => {
      await component.onSubmit();
      await settle();

      httpMock.expectNone(CREATE_URL);
      expect(text()).toContain('Izaberi gde se predmet nalazi.');
      expect(text()).toContain('Upiši kontrolno pitanje.');
      expect(text()).toContain('Upiši tačan odgovor.');
      expect(text()).toContain('Unesi mejl.');
    });

    it('rejects a wrong email and a wrong phone, but the phone is optional', async () => {
      fillHandover({ finderEmail: 'nije-mejl', finderPhone: '12345' });
      component.handoverForm.markAllAsTouched();
      await settle();

      expect(text()).toContain('Unesi ispravnu mejl adresu.');
      expect(text()).toContain('Unesi ispravan srpski mobilni broj');

      fillHandover({ finderPhone: '' });
      expect(component.handoverForm.valid).toBe(true);
    });

    it('accepts an email pasted with spaces around it (they are removed)', async () => {
      fillHandover({ finderEmail: '  nalazac@test.rs  ' });
      // Bez skraćivanja bi ovo bilo odbijeno kao neispravan mejl
      expect(component.handoverForm.controls.finderEmail.errors?.['email']).toBeTruthy();

      await component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      expect((await readRequest(req)).report.finderEmail).toBe('nalazac@test.rs');
      req.flush({ message: 'ok', linkExpiresAt: new Date().toISOString() });
    });

    it('treats a question or an answer with only spaces as empty', async () => {
      fillHandover({ controlQuestion: '   ', controlAnswer: '  ' });

      await component.onSubmit();
      await settle();

      httpMock.expectNone(CREATE_URL);
      expect(text()).toContain('Upiši kontrolno pitanje.');
      expect(text()).toContain('Upiši tačan odgovor.');
    });

    it('rejects too long texts', () => {
      fillHandover({
        itemLocation: 'AT_POLICE',
        handoverInfo: 'x'.repeat(256),
        controlQuestion: 'x'.repeat(256),
        controlAnswer: 'x'.repeat(501),
      });

      expect(component.handoverForm.controls.handoverInfo.errors?.['maxlength']).toBeTruthy();
      expect(component.handoverForm.controls.controlQuestion.errors?.['maxlength']).toBeTruthy();
      expect(component.handoverForm.controls.controlAnswer.errors?.['maxlength']).toBeTruthy();
    });

    it('says the contact is not shown publicly', () => {
      expect(text()).toContain('Tvoj kontakt se ne prikazuje javno');
    });
  });

  // ===================== Slanje =====================

  describe('sending', () => {
    const fillEverything = async () => {
      await pickPhoto(photoFile(3000, 'novcanik.jpg'));
      component.next();
      fillPlace({
        foundAt: localTime(-5),
        city: '  Beograd  ',
        placeDescription: ' ispred pošte ',
        latitude: 44.8125,
        longitude: 20.4612,
      });
      component.next();
      fillItem(0, { category: 'WALLET', color: 'BLACK', brand: 'Guess', description: '' });
      component.next();
      fillHandover({
        itemLocation: 'AT_POLICE',
        handoverInfo: ' PS Vračar, Njegoševa 20 ',
        controlQuestion: ' Šta piše na privesku? ',
        controlAnswer: ' Mića ',
        finderEmail: ' Nalazac@Test.rs ',
        finderPhone: ' 064 123 4567 ',
      });
      await settle();
    };

    it('sends multipart with the whole report and the photo, without a token', async () => {
      await fillEverything();
      const foundAt = component.placeForm.controls.foundAt.value;

      const sending = component.onSubmit();
      await sending;

      const req = httpMock.expectOne(CREATE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.has('Authorization')).toBe(false);

      const { report, photo } = await readRequest(req);
      expect(report).toEqual({
        finderEmail: 'Nalazac@Test.rs',
        finderPhone: '064 123 4567',
        // vreme iz datetime-local je lokalno, a šalje se u UTC
        foundAt: new Date(foundAt).toISOString(),
        city: 'Beograd',
        placeDescription: 'ispred pošte',
        latitude: 44.8125,
        longitude: 20.4612,
        itemLocation: 'AT_POLICE',
        handoverInfo: 'PS Vračar, Njegoševa 20',
        controlQuestion: 'Šta piše na privesku?',
        controlAnswer: 'Mića',
        items: [{ category: 'WALLET', color: 'BLACK', brand: 'Guess' }],
      });
      expect(photo.name).toBe('novcanik.jpg');
      expect(photo.size).toBe(3000);

      req.flush({ message: 'ok', linkExpiresAt: new Date().toISOString() });
    });

    it('leaves out empty optional fields instead of sending empty text', async () => {
      await pickPhoto(photoFile());
      component.next();
      fillPlace({ placeDescription: '   ' });
      component.next();
      fillItem(0, { category: 'KEYS' });
      component.next();
      fillHandover({ itemLocation: 'WITH_FINDER', finderPhone: '   ' });

      await component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      const { report } = await readRequest(req);
      expect('placeDescription' in report).toBe(false);
      expect('finderPhone' in report).toBe(false);
      expect('handoverInfo' in report).toBe(false);
      req.flush({ message: 'ok', linkExpiresAt: new Date().toISOString() });
    });

    it('does not send handover info when the item is with the finder (the backend would refuse it)', async () => {
      await pickPhoto(photoFile());
      component.next();
      fillPlace();
      component.next();
      fillItem(0, { category: 'KEYS' });
      component.next();
      // Upisano pa predomišljeno: predmet je ipak kod nalazača
      fillHandover({ itemLocation: 'WITH_FINDER', handoverInfo: 'PS Vračar' });

      await component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      const { report } = await readRequest(req);
      expect(report.itemLocation).toBe('WITH_FINDER');
      expect('handoverInfo' in report).toBe(false);
      req.flush({ message: 'ok', linkExpiresAt: new Date().toISOString() });
    });

    it('sends only the hash of the name of a document, never the name or the birth date', async () => {
      await pickPhoto(photoFile());
      component.next();
      fillPlace();
      component.next();
      fillItem(0, {
        category: 'DOCUMENT',
        documentType: 'ID_CARD',
        lastName: 'Петровић',
        firstName: 'Ђорђе',
        dateOfBirth: '1999-05-14',
      });
      component.next();
      fillHandover();

      await component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      const { report } = await readRequest(req);
      // Isti heševi kao u primeru iz README-a backenda ("petrovic|djordje|1999-05-14")
      expect(report.items).toEqual([
        {
          category: 'DOCUMENT',
          documentType: 'ID_CARD',
          nameHash: '63a91cca7f4cd75979029696f860e2b51331fd66ea748a278a1866a5073798ed',
          nameDobHash: '13d3022879cde05143657d2bd87929c817d6a06e443b32363175ea05678f120d',
        },
      ]);
      const raw = JSON.stringify(report);
      expect(raw).not.toContain('Петровић');
      expect(raw).not.toContain('Ђорђе');
      expect(raw).not.toContain('1999-05-14');
      req.flush({ message: 'ok', linkExpiresAt: new Date().toISOString() });
    });

    it('shows "check your email" after a successful send', async () => {
      await fillEverything();

      await component.onSubmit();
      const linkExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      httpMock
        .expectOne(CREATE_URL)
        .flush(
          { message: 'Nalaz je primljen.', linkExpiresAt },
          { status: 201, statusText: 'Created' },
        );
      await settle();

      expect(component.isSaving()).toBe(false);
      expect(component.submitted()?.linkExpiresAt).toBe(linkExpiresAt);
      expect(page().querySelector('.progress')).toBeNull();
      expect(text()).toContain('Proveri mejl');
      expect(text()).toContain('Nalazac@Test.rs');
      expect(text()).toContain('Potvrdi nalaz');
      expect(page().querySelector('.card-done a[href="/"]')).not.toBeNull();
      // naslov dobija fokus, da čitač ekrana pročita novi ekran
      expect(document.activeElement?.textContent).toContain('Proveri mejl');
    });

    it('sends only one request even if the button is pressed twice', async () => {
      await fillEverything();

      const first = component.onSubmit();
      const second = component.onSubmit();
      await Promise.all([first, second]);

      const requests = httpMock.match(CREATE_URL);
      expect(requests.length).toBe(1);
      requests[0].flush({ message: 'ok', linkExpiresAt: new Date().toISOString() });
    });

    it('disables the buttons and says "Slanje..." while sending', async () => {
      await fillEverything();

      await component.onSubmit();
      await settle();

      expect(component.isSaving()).toBe(true);
      expect(text()).toContain('Slanje...');
      page()
        .querySelectorAll<HTMLButtonElement>('.actions button')
        .forEach((button) => expect(button.disabled).toBe(true));
      httpMock
        .expectOne(CREATE_URL)
        .flush({ message: 'ok', linkExpiresAt: '2026-11-22T10:00:00Z' });
    });

    it('shows the message of the backend and stays on the form', async () => {
      await fillEverything();

      await component.onSubmit();
      httpMock.expectOne(CREATE_URL).flush(
        {
          status: 400,
          message: 'Predmet ne može biti pronađen pre više od 30 dana',
          fieldErrors: {},
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await settle();

      expect(component.isSaving()).toBe(false);
      expect(component.submitted()).toBeNull();
      expect(component.submitErrors()).toEqual([
        'Predmet ne može biti pronađen pre više od 30 dana',
      ]);
      expect(text()).toContain('Predmet ne može biti pronađen pre više od 30 dana');
    });

    it('explains a photo that is too big even though the backend answers with HTTP 400', async () => {
      await fillEverything();

      await component.onSubmit();
      httpMock
        .expectOne(CREATE_URL)
        .flush(
          { status: 413, message: 'Slika može imati najviše 5 MB', fieldErrors: {} },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(component.submitErrors()).toEqual(['Slika može imati najviše 5 MB']);
    });

    it('turns "items[1]" in field errors into "Predmet 2"', async () => {
      await fillEverything();

      await component.onSubmit();
      httpMock.expectOne(CREATE_URL).flush(
        {
          status: 400,
          message: 'Neispravni podaci',
          fieldErrors: {
            'items[1].brand': 'Marka može imati najviše 100 znakova',
            finderEmail: 'Unesi ispravnu mejl adresu',
          },
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(component.submitErrors()).toEqual([
        'Predmet 2: Marka može imati najviše 100 znakova',
        'Unesi ispravnu mejl adresu',
      ]);
    });

    it('says the server is unreachable', async () => {
      await fillEverything();

      await component.onSubmit();
      httpMock.expectOne(CREATE_URL).error(new ProgressEvent('error'));

      expect(component.submitErrors()[0]).toContain('Server nije dostupan');
    });

    it('can be sent again after an error, and the old error disappears', async () => {
      await fillEverything();

      await component.onSubmit();
      httpMock.expectOne(CREATE_URL).flush(null, { status: 500, statusText: 'Server Error' });
      expect(component.submitErrors()).toEqual(['Slanje nalaza nije uspelo. Pokušaj ponovo.']);

      await component.onSubmit();
      expect(component.submitErrors()).toEqual([]);
      httpMock
        .expectOne(CREATE_URL)
        .flush({ message: 'ok', linkExpiresAt: '2026-11-22T10:00:00Z' });
      expect(component.submitted()).not.toBeNull();
    });

    it('goes back to the first broken step instead of sending (e.g. the photo is gone)', async () => {
      await fillEverything();
      component.photo.set(null);

      await component.onSubmit();
      await settle();

      httpMock.expectNone(CREATE_URL);
      expect(component.stepIndex()).toBe(0);
      expect(text()).toContain('Dodaj fotografiju predmeta.');
    });
  });
});

describe('FoundReportForm when the lists cannot be loaded', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FoundReportForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows an error on the item step, blocks "Dalje", and lets the user try again', async () => {
    const fixture = TestBed.createComponent(FoundReportForm);
    const component = fixture.componentInstance;
    httpMock.expectOne(OPTIONS_URL).flush({}, { status: 500, statusText: 'Server Error' });
    expect(component.optionsFailed()).toBe(true);

    component.photo.set(new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' }));
    component.stepIndex.set(2);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Liste za izbor nisu učitane');
    expect(page.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);

    component.loadOptions();
    expect(component.optionsFailed()).toBe(false);
    httpMock.expectOne(OPTIONS_URL).flush(SAMPLE_OPTIONS);
    await fixture.whenStable();

    expect(component.options()).toEqual(SAMPLE_OPTIONS);
    expect(page.querySelector('#category-0')).not.toBeNull();
    expect(page.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(false);
  });
});
