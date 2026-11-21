import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessages, apiErrorStatus } from './api-error';

const httpError = (status: number, body: unknown) =>
  new HttpErrorResponse({ status, error: body, statusText: 'x' });

describe('apiErrorStatus', () => {
  it('prefers the code from the body (backend sends HTTP 400 for most errors)', () => {
    expect(apiErrorStatus(httpError(400, { status: 409, message: 'x' }))).toBe(409);
    expect(apiErrorStatus(httpError(400, { status: 413, message: 'x' }))).toBe(413);
  });

  it('falls back to the HTTP status when the body has none', () => {
    expect(apiErrorStatus(httpError(500, null))).toBe(500);
    expect(apiErrorStatus(httpError(502, '<html>Bad gateway</html>'))).toBe(502);
  });
});

describe('apiErrorMessages', () => {
  it('says the server is unreachable when there is no response', () => {
    expect(apiErrorMessages(httpError(0, null), 'x')[0]).toContain('Server nije dostupan');
  });

  it('turns field errors into messages and names the item for "items[n]" keys', () => {
    const messages = apiErrorMessages(
      httpError(400, {
        status: 400,
        message: 'Neispravni podaci',
        fieldErrors: {
          'items[1].brand': 'Marka može imati najviše 100 znakova',
          city: 'Grad je obavezan',
        },
      }),
      'x',
    );

    expect(messages).toEqual([
      'Predmet 2: Marka može imati najviše 100 znakova',
      'Grad je obavezan',
    ]);
  });

  it('uses the message of the server when there are no field errors', () => {
    expect(
      apiErrorMessages(
        httpError(400, { status: 413, message: 'Slika može imati najviše 5 MB' }),
        'x',
      ),
    ).toEqual(['Slika može imati najviše 5 MB']);
  });

  it('uses the fallback when the body is not readable (e.g. an HTML page from a proxy)', () => {
    expect(apiErrorMessages(httpError(502, '<html></html>'), 'Nije uspelo')).toEqual([
      'Nije uspelo',
    ]);
    expect(apiErrorMessages(httpError(500, null), 'Nije uspelo')).toEqual(['Nije uspelo']);
  });
});
