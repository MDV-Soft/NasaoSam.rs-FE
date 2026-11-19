import { FormControl, FormGroup } from '@angular/forms';
import {
  isValidSerbianMobile,
  passwordsMatchValidator,
  serbianMobileValidator,
} from './form-validators';

describe('isValidSerbianMobile', () => {
  it.each([
    '064 123 4567',
    '0641234567',
    '+381641234567',
    '+381 64 123 4567',
    '00381641234567',
    '381641234567',
    '064/123-45-67',
    '(064) 123.4567',
    '  064 123 4567  ',
    '065 123 456', // 8 cifara posle 6 je dozvoljeno (7 ili 8)
  ])('accepts %s', (phone) => {
    expect(isValidSerbianMobile(phone)).toBe(true);
  });

  it.each([
    '',
    'abc',
    '011 123 4567', // fiksni telefon, ne mobilni
    '0641234', // prekratko
    '06412345678901', // predugo
    '+387641234567', // Bosna, ne Srbija
    '+38164123456a',
  ])('rejects "%s"', (phone) => {
    expect(isValidSerbianMobile(phone)).toBe(false);
  });
});

describe('serbianMobileValidator', () => {
  const validator = serbianMobileValidator();

  it('returns null for an empty value (required handles that)', () => {
    expect(validator(new FormControl(''))).toBeNull();
  });

  it('returns null for a valid number', () => {
    expect(validator(new FormControl('064 123 4567'))).toBeNull();
  });

  it('returns an error for an invalid number', () => {
    expect(validator(new FormControl('123'))).toEqual({ serbianMobile: true });
  });
});

describe('passwordsMatchValidator', () => {
  const makeGroup = (password: string, confirm: string) =>
    new FormGroup(
      { password: new FormControl(password), confirmPassword: new FormControl(confirm) },
      { validators: passwordsMatchValidator() },
    );

  it('is valid when both passwords are equal', () => {
    expect(makeGroup('lozinka123', 'lozinka123').errors).toBeNull();
  });

  it('reports a mismatch when they differ', () => {
    expect(makeGroup('lozinka123', 'lozinka124').errors).toEqual({ passwordsMismatch: true });
  });

  it('re-checks when the confirmation is edited', () => {
    const group = makeGroup('lozinka123', 'x');
    expect(group.errors).not.toBeNull();

    group.controls['confirmPassword'].setValue('lozinka123');
    expect(group.errors).toBeNull();
  });
});
