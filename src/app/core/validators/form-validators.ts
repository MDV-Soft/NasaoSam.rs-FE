import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Isti postupak kao PhoneNumberNormalizer na backendu:
 * 1. uklone se razmaci i znaci - . / ( )
 * 2. "00381..." postaje "+381...", "381..." postaje "+381...", "06..." postaje "+3816..."
 * 3. mora da odgovara obliku +3816 i još 7 ili 8 cifara (srpski mobilni)
 */
export function isValidSerbianMobile(rawPhone: string): boolean {
  let cleaned: string = rawPhone.trim().replace(/[\s\-./()]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  if (cleaned.startsWith('381')) {
    cleaned = '+' + cleaned;
  }
  if (cleaned.startsWith('0')) {
    cleaned = '+381' + cleaned.substring(1);
  }

  return /^\+3816\d{7,8}$/.test(cleaned);
}

// Validator za jedno polje. Prazno polje propušta: za to je zadužen Validators.required.
export function serbianMobileValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';

    if (value.trim() === '') {
      return null;
    }

    return isValidSerbianMobile(value) ? null : { serbianMobile: true };
  };
}

// Validator za CELU grupu: poredi dva polja, zato se stavlja na FormGroup, ne na polje.
export function passwordsMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password: string | null = group.get('password')?.value ?? null;
    const confirm: string | null = group.get('confirmPassword')?.value ?? null;

    return password === confirm ? null : { passwordsMismatch: true };
  };
}
