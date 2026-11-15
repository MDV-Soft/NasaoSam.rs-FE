import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Register } from './register';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let httpMock: HttpTestingController;
  let router: Router;
  const registerUrl = environment.apiUrl + '/auth/register';

  // Popunjava formu ispravnim podacima; pojedina polja se mogu prepisati
  const fillForm = (overrides: Partial<Record<string, string>> = {}) => {
    component.registerForm.setValue({
      email: 'ana@primer.rs',
      displayName: '',
      phone: '064 123 4567',
      password: 'lozinka123',
      confirmPassword: 'lozinka123',
      ...overrides,
    });
  };

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('validation', () => {
    it('does not send an empty form and shows the errors', async () => {
      component.onSubmit();
      await fixture.whenStable();

      expect(component.registerForm.invalid).toBe(true);
      expect(component.isLoading()).toBe(false);
      const errors = (fixture.nativeElement as HTMLElement).querySelectorAll('.field-error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects a password shorter than 8 characters', () => {
      fillForm({ password: 'kratka1', confirmPassword: 'kratka1' });

      expect(component.registerForm.controls.password.errors?.['minlength']).toBeTruthy();
      component.onSubmit();
    });

    it('rejects a phone that is not a Serbian mobile number', () => {
      fillForm({ phone: '011 123 4567' });

      expect(component.registerForm.controls.phone.errors?.['serbianMobile']).toBe(true);
    });

    it('rejects different passwords and tells the user', async () => {
      fillForm({ confirmPassword: 'drugacija123' });
      component.registerForm.controls.confirmPassword.markAsTouched();
      await fixture.whenStable();

      expect(component.registerForm.errors?.['passwordsMismatch']).toBe(true);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Lozinke se ne poklapaju.',
      );

      component.onSubmit(); // ne sme da pošalje zahtev: afterEach/verify() bi pao
    });
  });

  describe('sending', () => {
    it('sends trimmed data, omits an empty name and goes to /moji-oglasi', () => {
      fillForm({ email: '  ana@primer.rs  ', phone: ' 064 123 4567 ' });

      component.onSubmit();
      expect(component.isLoading()).toBe(true);

      const req = httpMock.expectOne(registerUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'ana@primer.rs',
        password: 'lozinka123',
        phone: '064 123 4567',
      });
      // confirmPassword nikad ne ide na server
      expect(req.request.body.confirmPassword).toBeUndefined();

      req.flush({ token: 'tok', userId: 5, email: 'ana@primer.rs', role: 'OWNER' });

      expect(component.isLoading()).toBe(false);
      expect(TestBed.inject(AuthService).isLoggedIn()).toBe(true);
      expect(router.navigate).toHaveBeenCalledWith(['/moji-oglasi']);
    });

    it('sends the name when it is filled in', () => {
      fillForm({ displayName: '  Ana  ' });

      component.onSubmit();

      const req = httpMock.expectOne(registerUrl);
      expect(req.request.body.displayName).toBe('Ana');
      req.flush({ token: 'tok', userId: 5, email: 'ana@primer.rs', role: 'OWNER' });
    });
  });

  describe('server errors', () => {
    it('attaches field errors from the backend to the matching fields', () => {
      fillForm();
      component.onSubmit();

      httpMock.expectOne(registerUrl).flush(
        {
          status: 400,
          message: 'Neispravni podaci',
          fieldErrors: { email: 'Unesi ispravnu mejl adresu', password: 'Lozinka je prelaka' },
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(component.registerForm.controls.email.errors?.['server']).toBe(
        'Unesi ispravnu mejl adresu',
      );
      expect(component.registerForm.controls.password.errors?.['server']).toBe(
        'Lozinka je prelaka',
      );
      expect(component.isLoading()).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('shows "email already exists" on the email field (body says 409, HTTP says 400)', () => {
      fillForm();
      component.onSubmit();

      httpMock
        .expectOne(registerUrl)
        .flush(
          { status: 409, message: 'Nalog sa ovim mejlov vec postoji', fieldErrors: {} },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(component.registerForm.controls.email.errors?.['server']).toBe(
        'Nalog sa ovim mejlov vec postoji',
      );
    });

    it('also works when the backend one day returns a real HTTP 409', () => {
      fillForm();
      component.onSubmit();

      httpMock
        .expectOne(registerUrl)
        .flush({ message: 'Nalog već postoji' }, { status: 409, statusText: 'Conflict' });

      expect(component.registerForm.controls.email.errors?.['server']).toBe('Nalog već postoji');
    });

    it('clears the server error as soon as the user edits the field', () => {
      fillForm();
      component.onSubmit();
      httpMock
        .expectOne(registerUrl)
        .flush({ status: 409, message: 'Zauzeto' }, { status: 400, statusText: 'Bad Request' });
      expect(component.registerForm.controls.email.errors?.['server']).toBe('Zauzeto');

      component.registerForm.controls.email.setValue('druga@primer.rs');

      expect(component.registerForm.controls.email.errors).toBeNull();
    });

    it('shows a general message for errors that do not belong to a field', () => {
      fillForm();
      component.onSubmit();

      httpMock
        .expectOne(registerUrl)
        .flush(
          { status: 400, message: 'Unesi ispravan srpski mobilni broj', fieldErrors: {} },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(component.errorMessage()).toBe('Unesi ispravan srpski mobilni broj');
    });

    it('says the server is unreachable when the request never arrives', () => {
      fillForm();
      component.onSubmit();

      httpMock.expectOne(registerUrl).error(new ProgressEvent('error'));

      expect(component.errorMessage()).toContain('Server nije dostupan');
    });

    it('uses a generic message when the error has no body', () => {
      fillForm();
      component.onSubmit();

      httpMock.expectOne(registerUrl).flush(null, { status: 500, statusText: 'Server Error' });

      expect(component.errorMessage()).toBe('Registracija nije uspela. Pokušaj ponovo.');
    });
  });
});
