import { HttpErrorResponse } from '@angular/common/http';

// Telo greške koje backend uvek šalje: { status, message, timestamp, fieldErrors }
export interface ApiErrorBody {
  status?: number;
  message?: string;
  fieldErrors?: Record<string, string>;
}

function bodyOf(error: HttpErrorResponse): ApiErrorBody {
  const body: unknown = error.error;
  return typeof body === 'object' && body !== null ? (body as ApiErrorBody) : {};
}

/**
 * Pravi kod greške. Backend većinu grešaka šalje sa HTTP 400, a pravi kod (404, 409, 413...)
 * stavlja u telo, zato se prvo čita telo.
 */
export function apiErrorStatus(error: HttpErrorResponse): number {
  const status = bodyOf(error).status;
  return typeof status === 'number' ? status : error.status;
}

/**
 * Poruke greške za prikaz korisniku.
 *  - nema odgovora servera (status 0): poruka o vezi
 *  - greške po poljima: "items[1].brand" postaje "Predmet 2: ..."
 *  - inače poruka sa servera, a ako je nema, zadata rezervna poruka
 */
export function apiErrorMessages(error: HttpErrorResponse, fallback: string): string[] {
  if (error.status === 0) {
    return ['Server nije dostupan. Proveri internet vezu i pokušaj ponovo.'];
  }

  const body = bodyOf(error);
  const fieldErrors = body.fieldErrors ?? {};
  const messages = Object.keys(fieldErrors).map((key) => {
    const itemMatch = /^items\[(\d+)\]/.exec(key);
    return itemMatch
      ? 'Predmet ' + (Number(itemMatch[1]) + 1) + ': ' + fieldErrors[key]
      : fieldErrors[key];
  });

  if (messages.length > 0) {
    return messages;
  }
  return [body.message ?? fallback];
}
