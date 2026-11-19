import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Ista pravila kao u LostReportService na backendu
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000; // vreme gubitka sme da bude najviše 5 minuta u budućnosti
const MAX_PAST_MS = 365 * 24 * 60 * 60 * 1000; // gubitak ne sme biti stariji od 365 dana

/**
 * Validator za CELU grupu (poredi dva polja: lostFrom i lostTo).
 * Vraća jednu ili više grešaka odjednom:
 *  - lostFromAfterLostTo: početak je posle kraja
 *  - lostInFuture: kraj je u budućnosti
 *  - lostTooOld: početak je stariji od godinu dana
 *
 * "Sada" se prosleđuje kao funkcija, da test može da zadrži fiksno vreme.
 */
export function lostTimeValidator(now: () => Date = () => new Date()): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const fromText: string | null = group.get('lostFrom')?.value ?? null;
    const toText: string | null = group.get('lostTo')?.value ?? null;

    // Prazno polje je posao Validators.required, a ne ovog validatora
    if (!fromText || !toText) {
      return null;
    }

    const from: number = new Date(fromText).getTime();
    const to: number = new Date(toText).getTime();
    if (Number.isNaN(from) || Number.isNaN(to)) {
      return null;
    }

    const current: number = now().getTime();
    const errors: ValidationErrors = {};

    if (from > to) {
      errors['lostFromAfterLostTo'] = true;
    }
    if (to > current + FUTURE_TOLERANCE_MS) {
      errors['lostInFuture'] = true;
    }
    if (from < current - MAX_PAST_MS) {
      errors['lostTooOld'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

/**
 * Validator za CELU grupu: širina i dužina idu zajedno, a radijus ima smisla samo uz tačku.
 *  - coordinatesPair: zadata je samo jedna od dve koordinate
 *  - radiusWithoutPoint: zadat je radijus, a nema tačke
 */
export function coordinatesValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const latitude: number | null = group.get('latitude')?.value ?? null;
    const longitude: number | null = group.get('longitude')?.value ?? null;
    const radius: number | null = group.get('locationRadiusMeters')?.value ?? null;

    const hasLatitude: boolean = latitude !== null;
    const hasLongitude: boolean = longitude !== null;
    const errors: ValidationErrors = {};

    if (hasLatitude !== hasLongitude) {
      errors['coordinatesPair'] = true;
    }
    if (radius !== null && !hasLatitude) {
      errors['radiusWithoutPoint'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}
