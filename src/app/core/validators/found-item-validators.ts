import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validator za jedan PREDMET nalaza (grupu polja). Ista pravila kao FoundItemFactory.validate
 * na backendu, a za razliku od oglasa izgubljenog predmeta, opis nije obavezan
 * (nalazač drži predmet u ruci, pa ga ne terajemo da piše 40 znakova):
 *
 *  - "Ostalo"   → mora da se upiše šta je predmet   (customCategoryRequired)
 *  - "Dokument" → mora vrsta dokumenta, ime i prezime (documentTypeRequired,
 *                                                      lastNameRequired, firstNameRequired)
 *
 * Prazna vrsta je posao Validators.required na samom polju.
 */
export function foundItemValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const text = (name: string): string => (group.get(name)?.value ?? '').toString().trim();

    const category: string = text('category');
    const errors: ValidationErrors = {};

    if (category === 'OTHER' && text('customCategory') === '') {
      errors['customCategoryRequired'] = true;
    }

    if (category === 'DOCUMENT') {
      if (text('documentType') === '') {
        errors['documentTypeRequired'] = true;
      }
      if (text('lastName') === '') {
        errors['lastNameRequired'] = true;
      }
      if (text('firstName') === '') {
        errors['firstNameRequired'] = true;
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}
