import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Ista pravila kao FoundReportService na backendu
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000; // nalazak sme da bude najviše 5 minuta u budućnosti
export const MAX_FOUND_PAST_DAYS = 30; // predmet ne sme biti pronađen pre više od 30 dana
const MAX_PAST_MS = MAX_FOUND_PAST_DAYS * 24 * 60 * 60 * 1000;

/**
 * Validator za JEDNO polje (vreme nalaska iz <input type="datetime-local">).
 * Vraća jednu grešku:
 *  - foundInFuture: vreme je u budućnosti
 *  - foundTooOld: vreme je pre više od 30 dana
 *
 * "Sada" se prosleđuje kao funkcija, da test može da zadrži fiksno vreme.
 * Prazno polje propušta: za to je zadužen Validators.required.
 */
export function foundTimeValidator(now: () => Date = () => new Date()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const text: string = control.value ?? '';
    if (text === '') {
      return null;
    }

    const time: number = new Date(text).getTime();
    if (Number.isNaN(time)) {
      return null;
    }

    const current: number = now().getTime();
    if (time > current + FUTURE_TOLERANCE_MS) {
      return { foundInFuture: true };
    }
    if (time < current - MAX_PAST_MS) {
      return { foundTooOld: true };
    }
    return null;
  };
}

/**
 * Validator za CELU grupu: gde je predmet i podaci o predaji idu zajedno.
 *  - handoverRequired: predmet nije kod nalazača, a nije rečeno gde vlasnik može da ga preuzme
 *
 * Obrnut slučaj (predmet je kod nalazača, a upisani su podaci o predaji) backend odbija,
 * ali ga forma rešava tako što u tom slučaju polje ne prikazuje i ne šalje.
 */
export function handoverValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const location: string = group.get('itemLocation')?.value ?? '';
    const info: string = (group.get('handoverInfo')?.value ?? '').toString().trim();

    if (location !== '' && location !== 'WITH_FINDER' && info === '') {
      return { handoverRequired: true };
    }
    return null;
  };
}
