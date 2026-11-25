import { environment } from '../../../environments/environment';

/**
 * Pretvara putanju koju daje backend (npr. photoUrl "/api/lost-reports/7/matches/12/photo")
 * u adresu koju HttpClient sme da zove.
 *
 * Backend šalje putanju BEZ adrese servera. Poslata kao takva, otišla bi na adresu frontenda
 * (localhost:4200), a ne backenda (localhost:8080), a authInterceptor joj ne bi dodao token, jer
 * token šalje samo adresama koje počinju sa environment.apiUrl.
 *
 *  - apiUrl je pun URL ("http://localhost:8080/api"): putanja se dopunjuje njegovom adresom
 *  - apiUrl je putanja ("/api", iza proxy-ja): putanja ostaje kakva jeste
 *  - putanja je već pun URL: ostaje kakva jeste
 */
export function resolveApiUrl(path: string, apiUrl: string = environment.apiUrl): string {
  try {
    return new URL(path, new URL(apiUrl)).href;
  } catch {
    return path;
  }
}
