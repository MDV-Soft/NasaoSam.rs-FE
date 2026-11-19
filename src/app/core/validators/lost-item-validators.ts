import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Isto kao MIN_DESCRIPTION_LENGTH u LostReportService na backendu
export const MIN_DESCRIPTION_LENGTH = 40;

/**
 * Validator za jedan PREDMET (grupu polja). Pravila zavise od vrste predmeta,
 * pa ih ne mogu proveriti ugrađeni validatori pojedinačnih polja:
 *
 *  - "Ostalo"   → mora da se upiše šta je predmet           (customCategoryRequired)
 *  - "Dokument" → mora vrsta dokumenta, ime i prezime       (documentTypeRequired,
 *                                                            lastNameRequired, firstNameRequired)
 *  - sve ostalo → opis od najmanje 40 znakova               (descriptionTooShort)
 *
 * Polja koja ne važe za izabranu vrstu se ne proveravaju (korisnik je mogao da ih popuni
 * pa da promeni vrstu; ona se ni ne šalju serveru).
 */
export function lostItemValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const text = (name: string): string => (group.get(name)?.value ?? '').toString().trim();

    const category: string = text('category');

    // Prazna vrsta je posao Validators.required na samom polju
    if (category === '') {
      return null;
    }

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
    } else {
      const length: number = text('description').length;
      if (length < MIN_DESCRIPTION_LENGTH) {
        errors['descriptionTooShort'] = { required: MIN_DESCRIPTION_LENGTH, actual: length };
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}
