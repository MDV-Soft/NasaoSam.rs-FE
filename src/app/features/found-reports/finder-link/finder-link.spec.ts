import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { FinderLink } from './finder-link';
import { FinderSessionService } from '../../../core/services/finder-session.service';
import { environment } from '../../../../environments/environment';

const ACCESS_URL = environment.apiUrl + '/finder/access';

describe('FinderLink', () => {
  let fixture: ComponentFixture<FinderLink>;
  let httpMock: HttpTestingController;
  let router: Router;
  let session: FinderSessionService;

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => page().textContent?.replace(/\s+/g, ' ') ?? '';
  const settle = () => fixture.whenStable();

  const open = async (query: Record<string, string> = {}) => {
    await TestBed.configureTestingModule({
      imports: [FinderLink],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    session = TestBed.inject(FinderSessionService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(FinderLink);
    await settle();
  };

  const accessResponse = () => ({
    accessToken: 'finder-jwt',
    expiresAt: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
  });

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('with a token from the link', () => {
    it('takes the token out of the address before anything else', async () => {
      await open({ token: 'tajni-token' });

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: {}, replaceUrl: true }),
      );
      httpMock.expectOne(ACCESS_URL).flush(accessResponse());
    });

    it('exchanges it for a finder token, keeps the session and opens the review page', async () => {
      await open({ token: 'tajni-token' });

      const req = httpMock.expectOne(ACCESS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ token: 'tajni-token' });
      req.flush(accessResponse());

      expect(session.getToken()).toBe('finder-jwt');
      expect(router.navigate).toHaveBeenCalledWith(['/nalaz/pregled'], { replaceUrl: true });
    });

    it('trims spaces around the token', async () => {
      await open({ token: '  tajni-token  ' });

      expect(httpMock.expectOne(ACCESS_URL).request.body).toEqual({ token: 'tajni-token' });
    });

    it('says it is opening while it waits', async () => {
      await open({ token: 'tajni-token' });

      expect(text()).toContain('Otvaramo nalaz');
      httpMock.expectOne(ACCESS_URL).flush(accessResponse());
    });

    it('explains a link that does not work, without offering a retry', async () => {
      await open({ token: 'los-token' });

      httpMock
        .expectOne(ACCESS_URL)
        .flush(
          { status: 400, message: 'Link nije ispravan ili je istekao' },
          { status: 400, statusText: 'Bad Request' },
        );
      await settle();

      expect(text()).toContain('Link ne radi');
      expect(text()).toContain('Link nije ispravan ili je istekao');
      expect(text()).toContain('Link važi 24 sata');
      expect(text()).toContain('Posle potvrde nalaza link više ne radi');
      expect(page().querySelector('a[href="/nasao-sam"]')).not.toBeNull();
      expect(page().querySelector('a[href="/"].btn')).not.toBeNull();
      expect(text()).not.toContain('Pokušaj ponovo');
      expect(session.getToken()).toBeNull();
      expect(router.navigate).not.toHaveBeenCalledWith(['/nalaz/pregled'], expect.anything());
    });

    it('offers a retry with the same link when the server cannot be reached', async () => {
      await open({ token: 'tajni-token' });

      httpMock.expectOne(ACCESS_URL).error(new ProgressEvent('error'));
      await settle();
      expect(text()).toContain('Server nije dostupan');
      expect(text()).toContain('Pokušaj ponovo');

      const retry = Array.from(page().querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Pokušaj ponovo'),
      ) as HTMLButtonElement;
      retry.click();
      await settle();

      const again = httpMock.expectOne(ACCESS_URL);
      expect(again.request.body).toEqual({ token: 'tajni-token' });
      again.flush(accessResponse());
      expect(router.navigate).toHaveBeenCalledWith(['/nalaz/pregled'], { replaceUrl: true });
    });
  });

  describe('without a token', () => {
    it('explains where the link comes from when there is no session', async () => {
      await open();

      httpMock.expectNone(ACCESS_URL);
      expect(text()).toContain('Otvori link iz mejla');
      expect(text()).toContain('dva sata');
      expect(page().querySelector('a[href="/nasao-sam"]')).not.toBeNull();
    });

    it('goes straight to the review page when the finder is still signed in', async () => {
      sessionStorage.setItem('finder_token', 'finder-jwt');
      sessionStorage.setItem(
        'finder_expires_at',
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      );
      await open();

      httpMock.expectNone(ACCESS_URL);
      expect(router.navigate).toHaveBeenCalledWith(['/nalaz/pregled'], { replaceUrl: true });
    });
  });
});
