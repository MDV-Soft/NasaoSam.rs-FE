import { Injectable } from '@angular/core';

const TOKEN_KEY = 'finder_token';
const EXPIRES_KEY = 'finder_expires_at';

/**
 * Sesija nalazača: privremeni token koji backend daje kad se otvori link iz mejla.
 *
 * ODVOJENO od sesije vlasnika (AuthService): to su dva različita tokena sa različitim ulogama,
 * a isti browser može imati oba. Čuva se u sessionStorage, pa nestaje sa zatvaranjem kartice
 * (token ionako traje samo dva sata).
 */
@Injectable({
  providedIn: 'root',
})
export class FinderSessionService {
  save(accessToken: string, expiresAt: string): void {
    sessionStorage.setItem(TOKEN_KEY, accessToken);
    sessionStorage.setItem(EXPIRES_KEY, expiresAt);
  }

  // Token, ili null ako ga nema ili je istekao (istekao se odmah briše)
  getToken(): string | null {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token === null) {
      return null;
    }

    const expiresAt = this.getExpiresAt();
    if (expiresAt !== null && expiresAt.getTime() <= Date.now()) {
      this.clear();
      return null;
    }
    return token;
  }

  getExpiresAt(): Date | null {
    const text = sessionStorage.getItem(EXPIRES_KEY);
    if (text === null) {
      return null;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  isActive(): boolean {
    return this.getToken() !== null;
  }

  clear(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRES_KEY);
  }
}
