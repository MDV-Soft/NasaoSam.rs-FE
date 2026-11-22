import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FoundReportForm } from './found-report-form';
import { CreateFoundReportRequest } from '../../../core/models/found-report.model';
import { formatLocalDate, formatLocalDateTime } from '../../../core/utils/moment';
import { MAX_PHOTO_BYTES } from '../../../core/utils/photo-file';
import { environment } from '../../../../environments/environment';

const CREATE_URL = environment.apiUrl + '/found-reports';

// Lokalno vreme u obliku "GGGG-MM-DDTHH:mm", pomereno za zadati broj sati
const localTime = (hoursFromNow: number): string =>
  formatLocalDateTime(new Date(Date.now() + hoursFromNow * 60 * 60 * 1000));

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
      if (component.currentStep().id === 'place') {
        fillPlace();
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
    await settle();
  });

  afterEach(() => {
    httpMock.verify();
    URL.createObjectURL = originalCreateUrl;
    URL.revokeObjectURL = originalRevokeUrl;
  });

  it('starts on the photo step', () => {
    expect(component).toBeTruthy();
    expect(component.stepIndex()).toBe(0);
    expect(component.currentStep().id).toBe('photo');
    expect(text()).toContain('Prijavi pronađeni predmet');
    expect(text()).toContain('Slikaj predmet');
  });

  it('does not ask for the lists of items (the item is described after the link from the email)', () => {
    httpMock.expectNone(environment.apiUrl + '/meta/options');
  });

  it('has no AI wording, no emoji, no icons and no floating tag on any step', async () => {
    const seen: string[] = [formText()];
    let icons = strayIcons();
    let tags = page().querySelectorAll('.tag').length;
    for (const step of [1, 2]) {
      await goToStep(step);
      seen.push(formText());
      icons += strayIcons();
      tags += page().querySelectorAll('.tag').length;
    }

    const all = seen.join(' ').toLowerCase();
    expect(all).not.toMatch(/\bai\b|veštačk|inteligencij/);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(icons).toBe(0);
    expect(tags).toBe(0);
    expect(all).not.toContain('našao sam'); // plutajući znak iznad naslova je uklonjen
  });

  // ===================== Traka napretka =====================

  describe('progress bar', () => {
    it('shows three steps and marks the current one', () => {
      const items = page().querySelectorAll('.progress li');
      expect(items.length).toBe(3);
      expect(items[0].classList).toContain('current');
      expect(text()).toContain('Fotografija');
      expect(text()).toContain('Mesto i vreme');
      expect(text()).toContain('Predaja i kontakt');
      expect(text()).toContain('Korak 1 od 3');
    });

    it('lets the user go back to a finished step but not jump ahead', async () => {
      await goToStep(2);

      const buttons = Array.from(page().querySelectorAll<HTMLButtonElement>('.progress button'));
      expect(buttons.map((b) => b.disabled)).toEqual([false, false, true]);

      buttons[0].click();
      await settle();
      expect(component.stepIndex()).toBe(0);

      component.goTo(2); // unapred se ne skače
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

    const dayButton = (label: string) =>
      Array.from(page().querySelectorAll<HTMLButtonElement>('.mp-chip')).find(
        (b) => b.textContent?.trim() === label,
      )!;

    it('picks the time with the picker, not with the native datetime field', () => {
      expect(component.currentStep().id).toBe('place');
      expect(page().querySelector('app-moment-picker')).not.toBeNull();
      expect(page().querySelector('input[type="datetime-local"]')).toBeNull();
      expect(text()).toContain('Kada si ga našao?');
    });

    it('starts with "today" and a time that is not in the future', () => {
      const value = component.placeForm.controls.foundAt.value;

      expect(value.slice(0, 10)).toBe(formatLocalDate(new Date()));
      expect(new Date(value).getTime()).toBeLessThanOrEqual(Date.now());
      expect(component.placeForm.controls.foundAt.valid).toBe(true);
    });

    it('takes the day chosen in the picker into the form (real click on "Juče")', async () => {
      const before = component.placeForm.controls.foundAt.value;

      dayButton('Juče').click();
      await settle();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const after = component.placeForm.controls.foundAt.value;
      expect(after.slice(0, 10)).toBe(formatLocalDate(yesterday));
      expect(after.slice(11)).toBe(before.slice(11)); // vreme ostaje isto
      expect(text()).toContain('Juče,');
    });

    it('shows the sentence that confirms what was chosen', () => {
      expect(page().querySelector('.mp-summary')?.textContent).toContain('Danas,');
    });

    it('shows the map with only a short instruction, no tools and no radius', () => {
      expect(text()).toContain('Što preciznije označite na mapi gde ste našli predmet.');
      expect(text()).not.toContain('Moja trenutna lokacija');
      expect(text()).not.toContain('Pin na sredinu mape');
      expect(page().querySelector('.lp-radius')).toBeNull();
      expect(page().querySelector('#latitude')).toBeNull();
    });

    it('offers "remove pin" only after a pin is placed', async () => {
      expect(page().querySelector('.lp-tool')).toBeNull();

      component.onLocationChange({ latitude: 44.8, longitude: 20.4, radiusMeters: 0 });
      await settle();

      expect(page().querySelector('.lp-tool')?.textContent).toContain('Ukloni pin');
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

  // ===================== Korak 3: predaja i kontakt =====================

  describe('step 3: handover and contact', () => {
    beforeEach(async () => {
      await goToStep(2);
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

      component.onSubmit();
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
      component.onSubmit();
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

      component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      expect((await readRequest(req)).report.finderEmail).toBe('nalazac@test.rs');
      req.flush({ message: 'ok', linkExpiresAt: new Date().toISOString() });
    });

    it('treats a question or an answer with only spaces as empty', async () => {
      fillHandover({ controlQuestion: '   ', controlAnswer: '  ' });

      component.onSubmit();
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

    it('sends multipart with the whole report and the photo, without a token and without items', async () => {
      await fillEverything();
      const foundAt = component.placeForm.controls.foundAt.value;

      component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.has('Authorization')).toBe(false);

      const { report, photo } = await readRequest(req);
      expect(report).toEqual({
        finderEmail: 'Nalazac@Test.rs',
        finderPhone: '064 123 4567',
        // vreme iz izbora je lokalno, a šalje se u UTC
        foundAt: new Date(foundAt).toISOString(),
        city: 'Beograd',
        placeDescription: 'ispred pošte',
        latitude: 44.8125,
        longitude: 20.4612,
        itemLocation: 'AT_POLICE',
        handoverInfo: 'PS Vračar, Njegoševa 20',
        controlQuestion: 'Šta piše na privesku?',
        controlAnswer: 'Mića',
      });
      expect('items' in report).toBe(false); // predmet se opisuje posle linka iz mejla
      expect(photo.name).toBe('novcanik.jpg');
      expect(photo.size).toBe(3000);

      req.flush({ message: 'ok', linkExpiresAt: new Date().toISOString() });
    });

    it('leaves out empty optional fields instead of sending empty text', async () => {
      await pickPhoto(photoFile());
      component.next();
      fillPlace({ placeDescription: '   ' });
      component.next();
      fillHandover({ itemLocation: 'WITH_FINDER', finderPhone: '   ' });

      component.onSubmit();

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
      // Upisano pa predomišljeno: predmet je ipak kod nalazača
      fillHandover({ itemLocation: 'WITH_FINDER', handoverInfo: 'PS Vračar' });

      component.onSubmit();

      const req = httpMock.expectOne(CREATE_URL);
      const { report } = await readRequest(req);
      expect(report.itemLocation).toBe('WITH_FINDER');
      expect('handoverInfo' in report).toBe(false);
      req.flush({ message: 'ok', linkExpiresAt: new Date().toISOString() });
    });

    it('shows "check your email" with the next steps after a successful send', async () => {
      await fillEverything();

      component.onSubmit();
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
      expect(text()).toContain('opiši predmet');
      expect(text()).toContain('Potvrdi nalaz');
      expect(page().querySelector('.card-done a[href="/"]')).not.toBeNull();
      expect(page().querySelector('.tag')).toBeNull();
      // naslov dobija fokus, da čitač ekrana pročita novi ekran
      expect(document.activeElement?.textContent).toContain('Proveri mejl');
    });

    it('sends only one request even if the button is pressed twice', async () => {
      await fillEverything();

      component.onSubmit();
      component.onSubmit();

      const requests = httpMock.match(CREATE_URL);
      expect(requests.length).toBe(1);
      requests[0].flush({ message: 'ok', linkExpiresAt: new Date().toISOString() });
    });

    it('disables the buttons and says "Slanje..." while sending', async () => {
      await fillEverything();

      component.onSubmit();
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

      component.onSubmit();
      httpMock
        .expectOne(CREATE_URL)
        .flush(
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

      component.onSubmit();
      httpMock
        .expectOne(CREATE_URL)
        .flush(
          { status: 413, message: 'Slika može imati najviše 5 MB', fieldErrors: {} },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(component.submitErrors()).toEqual(['Slika može imati najviše 5 MB']);
    });

    it('turns field errors of the backend into readable messages', async () => {
      await fillEverything();

      component.onSubmit();
      httpMock.expectOne(CREATE_URL).flush(
        {
          status: 400,
          message: 'Neispravni podaci',
          fieldErrors: { finderEmail: 'Unesi ispravnu mejl adresu', city: 'Grad je obavezan' },
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(component.submitErrors()).toEqual(['Unesi ispravnu mejl adresu', 'Grad je obavezan']);
    });

    it('says the server is unreachable', async () => {
      await fillEverything();

      component.onSubmit();
      httpMock.expectOne(CREATE_URL).error(new ProgressEvent('error'));

      expect(component.submitErrors()[0]).toContain('Server nije dostupan');
    });

    it('can be sent again after an error, and the old error disappears', async () => {
      await fillEverything();

      component.onSubmit();
      httpMock.expectOne(CREATE_URL).flush(null, { status: 500, statusText: 'Server Error' });
      expect(component.submitErrors()).toEqual(['Slanje nalaza nije uspelo. Pokušaj ponovo.']);

      component.onSubmit();
      expect(component.submitErrors()).toEqual([]);
      httpMock
        .expectOne(CREATE_URL)
        .flush({ message: 'ok', linkExpiresAt: '2026-11-22T10:00:00Z' });
      expect(component.submitted()).not.toBeNull();
    });

    it('goes back to the first broken step instead of sending (e.g. the photo is gone)', async () => {
      await fillEverything();
      component.photo.set(null);

      component.onSubmit();
      await settle();

      httpMock.expectNone(CREATE_URL);
      expect(component.stepIndex()).toBe(0);
      expect(text()).toContain('Dodaj fotografiju predmeta.');
    });
  });
});
